import { mutateEventData } from '@/lib/event-mutations'
import { prisma } from '@/lib/prisma'
import { ExpenseInput } from '../route'

// PATCH / DELETE /api/events/{shareId}/expenses/{expenseId}
// Cả hai đều đi qua mutateEventData → reset quyết toán trong cùng transaction.
//
// Mỗi handler tốn đúng HAI lượt đi-về DB: một lượt đọc để kiểm tra, một lượt
// ghi + đọc lại. Phần kiểm tra gộp vào MỘT truy vấn (lọc thẳng trong select
// của quan hệ) thay vì tra từng bảng một.
//
// Vì sao vẫn giữ lượt đọc kiểm tra: mutateEventData tăng dataVersion và xóa
// sạch đánh dấu Done. Nếu gộp cả kiểm tra vào lệnh ghi thì một request nhắm
// vào khoản chi không tồn tại vẫn kịp xóa Done của cả nhóm rồi mới trả 404.

export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/events/[shareId]/expenses/[expenseId]'>
) {
  const { shareId, expenseId } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 })
  }

  const parsed = ExpenseInput.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' },
      { status: 400 }
    )
  }

  // Một truy vấn trả lời cả hai câu hỏi: khoản chi có đúng thuộc sự kiện này
  // không, và người đã chi có đúng là người trong sự kiện này không.
  const event = await prisma.event.findUnique({
    where: { shareId },
    select: {
      expenses: { where: { id: expenseId }, select: { id: true } },
      participants: { where: { id: parsed.data.payerId }, select: { id: true } },
    },
  })
  if (!event) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }
  if (event.expenses.length === 0) {
    return Response.json({ error: 'Khoản chi này vừa bị xóa.' }, { status: 404 })
  }
  // Không tin payerId từ client — phải thuộc CHÍNH sự kiện này.
  if (event.participants.length === 0) {
    return Response.json({ error: 'Người đã chi không thuộc sự kiện này.' }, { status: 400 })
  }

  const updated = await mutateEventData(shareId, [
    prisma.expense.update({
      where: { id: expenseId },
      data: {
        title: parsed.data.title,
        amount: parsed.data.amount,
        payerId: parsed.data.payerId,
      },
    }),
  ])
  if (!updated) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  return Response.json(updated)
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/events/[shareId]/expenses/[expenseId]'>
) {
  const { shareId, expenseId } = await ctx.params

  const event = await prisma.event.findUnique({
    where: { shareId },
    select: { expenses: { where: { id: expenseId }, select: { id: true } } },
  })
  if (!event || event.expenses.length === 0) {
    // Người khác vừa xóa trước — coi như đã đạt trạng thái mong muốn.
    return Response.json({ error: 'Khoản chi này vừa bị xóa.' }, { status: 404 })
  }

  const updated = await mutateEventData(shareId, [
    prisma.expense.delete({ where: { id: expenseId } }),
  ])
  if (!updated) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  // STT hiển thị được sinh lại lúc render nên không cần đánh số lại sortOrder,
  // lỗ hổng trong dãy sortOrder là vô hại.
  return Response.json(updated)
}
