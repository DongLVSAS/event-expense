import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// POST /api/events/{shareId}/todos — thêm một món cần mua.
// Spec: docs/screens/03-event-detail.md §5
//
// ⚠ TUYỆT ĐỐI KHÔNG dùng mutateEventData() ở file này.
// Todo không có số tiền, không có người chi, không vào phép tính quyết toán.
// Gọi nhầm helper đó sẽ tăng dataVersion và xóa sạch đánh dấu Done của cả nhóm.

export const TodoTitleInput = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Hãy nhập tên món cần mua.')
    .max(120, 'Tên món tối đa 120 ký tự.'),
})

export async function POST(request: Request, ctx: RouteContext<'/api/events/[shareId]/todos'>) {
  const { shareId } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 })
  }

  const parsed = TodoTitleInput.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' },
      { status: 400 }
    )
  }

  const event = await prisma.event.findUnique({
    where: { shareId },
    select: {
      id: true,
      todos: { orderBy: { sortOrder: 'desc' }, take: 1, select: { sortOrder: true } },
    },
  })
  if (!event) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  const todo = await prisma.todo.create({
    data: {
      eventId: event.id,
      title: parsed.data.title,
      sortOrder: (event.todos[0]?.sortOrder ?? -1) + 1,
    },
    select: { id: true, title: true, bought: true, sortOrder: true },
  })

  return Response.json(todo, { status: 201 })
}
