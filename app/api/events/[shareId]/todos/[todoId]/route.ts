import { z } from 'zod'
import { eventQuery, toEventDTO } from '@/lib/get-event'
import { prisma } from '@/lib/prisma'

// PATCH / DELETE /api/events/{shareId}/todos/{todoId}
//
// ⚠ TUYỆT ĐỐI KHÔNG dùng mutateEventData() ở file này — xem ../route.ts.
//
// Tick "đã mua" là toggle thuần: không tạo khoản chi, không tăng dataVersion,
// không xóa TransferStatus, không reset settledAt.
//
// Cả hai handler chỉ tốn MỘT lượt đi-về DB: dùng updateMany/deleteMany với
// `where` lồng quan hệ (thay cho findFirst kiểm tra trước rồi mới ghi), rồi
// đọc lại sự kiện ngay trong cùng transaction. `count === 0` nghĩa là món không
// tồn tại hoặc không thuộc sự kiện này — chưa có gì bị ghi, trả 404 là an toàn.

const UpdateTodoInput = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  bought: z.boolean().optional(),
})

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

  // Hai người cùng tick một món → last-write-wins, không cần 409.
  // `bought` là boolean nên sau một vòng polling ai cũng thấy cùng giá trị.
  const [written, row] = await prisma.$transaction([
    prisma.todo.updateMany({
      where: { id: todoId, event: { shareId } },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.bought !== undefined && { bought: parsed.data.bought }),
      },
    }),
    eventQuery(shareId),
  ])

  if (written.count === 0) {
    return Response.json({ error: 'Món này vừa bị xóa.' }, { status: 404 })
  }
  if (!row) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  return Response.json(toEventDTO(row))
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/events/[shareId]/todos/[todoId]'>
) {
  const { shareId, todoId } = await ctx.params

  const [written, row] = await prisma.$transaction([
    prisma.todo.deleteMany({ where: { id: todoId, event: { shareId } } }),
    eventQuery(shareId),
  ])

  if (written.count === 0) {
    // Người khác vừa xóa trước — trạng thái mong muốn đã đạt.
    return Response.json({ error: 'Món này vừa bị xóa.' }, { status: 404 })
  }
  if (!row) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  return Response.json(toEventDTO(row))
}
