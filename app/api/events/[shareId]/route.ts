import { z } from 'zod'
import { getEventByShareId } from '@/lib/get-event'
import { prisma } from '@/lib/prisma'

// GET / PATCH / DELETE /api/events/{shareId}
// Client island ở màn 03 và 04 poll GET endpoint này ~10s một lần.

export async function GET(_request: Request, ctx: RouteContext<'/api/events/[shareId]'>) {
  const { shareId } = await ctx.params

  const event = await getEventByShareId(shareId)
  if (!event) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  return Response.json(event, {
    // Link chia sẻ ai cũng mở được nhưng dữ liệu thay đổi liên tục —
    // không cho cache ở bất kỳ tầng nào.
    headers: { 'Cache-Control': 'no-store' },
  })
}

// Sửa tên / ngày. KHÔNG đụng tới dataVersion: hai trường này không ảnh hưởng
// phép tính quyết toán, nên đánh dấu Done hiện có vẫn còn giá trị.
// Xem docs/screens/02-event-form.md §8.
const UpdateEventInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Hãy nhập tên sự kiện.')
    .max(100, 'Tên sự kiện tối đa 100 ký tự.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Hãy chọn ngày diễn ra.'),
})

export async function PATCH(request: Request, ctx: RouteContext<'/api/events/[shareId]'>) {
  const { shareId } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 })
  }

  const parsed = UpdateEventInput.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' },
      { status: 400 }
    )
  }

  const [y, m, d] = parsed.data.date.split('-').map(Number)
  const parsedDate = new Date(Date.UTC(y, m - 1, d))
  if (
    parsedDate.getUTCFullYear() !== y ||
    parsedDate.getUTCMonth() !== m - 1 ||
    parsedDate.getUTCDate() !== d
  ) {
    return Response.json({ error: 'Ngày không hợp lệ.' }, { status: 400 })
  }

  const existing = await prisma.event.findUnique({ where: { shareId }, select: { id: true } })
  if (!existing) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  await prisma.event.update({
    where: { id: existing.id },
    data: { name: parsed.data.name, date: parsedDate },
  })

  return Response.json({ ok: true })
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/events/[shareId]'>) {
  const { shareId } = await ctx.params

  const existing = await prisma.event.findUnique({ where: { shareId }, select: { id: true } })
  if (!existing) {
    // Người khác vừa xóa trước — trạng thái mong muốn đã đạt.
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  // Participant / Expense / TransferStatus đều ON DELETE CASCADE nên dọn theo.
  await prisma.event.delete({ where: { id: existing.id } })

  return new Response(null, { status: 204 })
}
