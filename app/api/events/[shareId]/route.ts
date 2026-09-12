import { z } from 'zod'
import { writeEventNoReset } from '@/lib/event-mutations'
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

  // Một lượt đi-về DB: ghi rồi đọc lại trong cùng transaction, client không
  // phải GET lại. Tên/ngày không đụng phép chia tiền nên KHÔNG dùng
  // mutateEventData — xem chú thích trên đầu UpdateEventInput.
  const updated = await writeEventNoReset(shareId, [
    prisma.event.update({
      where: { shareId },
      data: { name: parsed.data.name, date: parsedDate },
    }),
  ]).catch(() => null)
  if (!updated) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  return Response.json(updated)
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/events/[shareId]'>) {
  const { shareId } = await ctx.params

  // Participant / Expense / Todo / TransferStatus đều ON DELETE CASCADE nên dọn
  // theo. deleteMany thay cho findUnique-rồi-delete: một lượt đi-về thay vì hai,
  // và count === 0 đã đủ để biết là không tìm thấy.
  const { count } = await prisma.event.deleteMany({ where: { shareId } })
  if (count === 0) {
    // Người khác vừa xóa trước — trạng thái mong muốn đã đạt.
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  return new Response(null, { status: 204 })
}
