import { z } from 'zod'
import { eventQuery, toEventDTO } from '@/lib/get-event'
import { prisma } from '@/lib/prisma'
import { computeTransfers, settledAtChange } from '@/lib/settle-state'

// PUT /api/events/{shareId}/transfers/{transferKey} — bật/tắt Done một giao dịch.
// Spec: docs/screens/04-settlement.md §4.3
//
// Kết quả quyết toán KHÔNG lưu DB. Server tính lại settle() ở mỗi request để
// xác minh transferKey có thật ở version hiện tại — không tin key từ client.
//
// Hai lượt đi-về DB: một lượt đọc để tính, một lượt ghi + đọc lại. Việc quyết
// settledAt là phép tính thuần trên dữ liệu vừa đọc nên không cần truy vấn
// thêm — settledAtChange() trả về lệnh ghi để nhét chung vào transaction.

const ToggleInput = z.object({
  done: z.boolean(),
  /** Version client đang nhìn thấy. Lệch với DB => 409, client phải reload. */
  dataVersion: z.number().int().nonnegative(),
})

export async function PUT(
  request: Request,
  ctx: RouteContext<'/api/events/[shareId]/transfers/[transferKey]'>
) {
  const { shareId, transferKey: rawKey } = await ctx.params
  const transferKey = decodeURIComponent(rawKey)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 })
  }

  const parsed = ToggleInput.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 })
  }

  const event = await prisma.event.findUnique({
    where: { shareId },
    select: {
      id: true,
      dataVersion: true,
      settledAt: true,
      participants: { select: { id: true, sortOrder: true } },
      expenses: { select: { amount: true, payerId: true } },
      transferStatuses: { where: { done: true }, select: { transferKey: true } },
    },
  })
  if (!event) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  // Người khác vừa sửa chi tiêu/người tham gia → con số client đang nhìn đã cũ.
  if (parsed.data.dataVersion !== event.dataVersion) {
    return Response.json(
      {
        error: 'Dữ liệu vừa được người khác cập nhật.',
        dataVersion: event.dataVersion,
      },
      { status: 409 }
    )
  }

  const transfers = computeTransfers(event)
  if (!transfers.some((t) => t.transferKey === transferKey)) {
    return Response.json(
      { error: 'Giao dịch này không còn trong kết quả quyết toán.' },
      { status: 409 }
    )
  }

  const doneKeys = new Set(event.transferStatuses.map((t) => t.transferKey))
  if (parsed.data.done) doneKeys.add(transferKey)
  else doneKeys.delete(transferKey)

  const { ops } = settledAtChange(event, transfers, doneKeys)

  const results = await prisma.$transaction([
    prisma.transferStatus.upsert({
      where: { eventId_transferKey: { eventId: event.id, transferKey } },
      create: {
        eventId: event.id,
        transferKey,
        dataVersion: event.dataVersion,
        done: parsed.data.done,
      },
      update: { done: parsed.data.done, dataVersion: event.dataVersion },
    }),
    ...ops,
    eventQuery(shareId),
  ])

  // Phần tử cuối luôn là kết quả của eventQuery — $transaction giữ nguyên thứ tự.
  const row = results.at(-1) as Awaited<ReturnType<typeof eventQuery>>
  if (!row) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  return Response.json(toEventDTO(row))
}
