import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// PATCH / DELETE /api/events/{shareId}/todos/{todoId}
//
// ⚠ TUYỆT ĐỐI KHÔNG dùng mutateEventData() ở file này — xem ../route.ts.
//
// Tick "đã mua" là toggle thuần: không tạo khoản chi, không tăng dataVersion,
// không xóa TransferStatus, không reset settledAt.

const UpdateTodoInput = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  bought: z.boolean().optional(),
})

async function findTodoInEvent(shareId: string, todoId: string) {
  return prisma.todo.findFirst({
    where: { id: todoId, event: { shareId } },
    select: { id: true },
  })
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/events/[shareId]/todos/[todoId]'>
) {
  const { shareId, todoId } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 })
  }

  const parsed = UpdateTodoInput.safeParse(body)
  if (!parsed.success || (parsed.data.title === undefined && parsed.data.bought === undefined)) {
    return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 })
  }

  const todo = await findTodoInEvent(shareId, todoId)
  if (!todo) {
    return Response.json({ error: 'Món này vừa bị xóa.' }, { status: 404 })
  }

  // Hai người cùng tick một món → last-write-wins, không cần 409.
  // `bought` là boolean nên sau một vòng polling ai cũng thấy cùng giá trị.
  const updated = await prisma.todo.update({
    where: { id: todo.id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.bought !== undefined && { bought: parsed.data.bought }),
    },
    select: { id: true, title: true, bought: true, sortOrder: true },
  })

  return Response.json(updated)
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/events/[shareId]/todos/[todoId]'>
) {
  const { shareId, todoId } = await ctx.params

  const todo = await findTodoInEvent(shareId, todoId)
  if (!todo) {
    // Người khác vừa xóa trước — trạng thái mong muốn đã đạt.
    return Response.json({ error: 'Món này vừa bị xóa.' }, { status: 404 })
  }

  await prisma.todo.delete({ where: { id: todo.id } })

  return new Response(null, { status: 204 })
}
