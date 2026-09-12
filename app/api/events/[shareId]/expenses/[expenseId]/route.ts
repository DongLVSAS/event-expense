import { mutateEventData } from '@/lib/event-mutations'
import { prisma } from '@/lib/prisma'
import { ExpenseInput } from '../route'

// PATCH / DELETE /api/events/{shareId}/expenses/{expenseId}
// Cả hai đều đi qua mutateEventData → reset quyết toán trong cùng transaction.

/** Kiểm khoản chi có thật và đúng thuộc sự kiện này. Chặn sửa chéo sự kiện. */
async function findExpenseInEvent(shareId: string, expenseId: string) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, event: { shareId } },
    select: { id: true, eventId: true },
  })
  return expense
}

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
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }, { status: 400 })
  }

  const expense = await findExpenseInEvent(shareId, expenseId)
  if (!expense) {
    return Response.json({ error: 'Khoản chi này vừa bị xóa.' }, { status: 404 })
  }

  const payerBelongs = await prisma.participant.findFirst({
    where: { id: parsed.data.payerId, eventId: expense.eventId },
    select: { id: true },
  })
  if (!payerBelongs) {
    return Response.json({ error: 'Người đã chi không thuộc sự kiện này.' }, { status: 400 })
  }

  const updated = await mutateEventData(expense.eventId, (tx) =>
    tx.expense.update({
      where: { id: expense.id },
      data: {
        title: parsed.data.title,
        amount: parsed.data.amount,
        payerId: parsed.data.payerId,
      },
      select: { id: true, title: true, amount: true, payerId: true, sortOrder: true },
    })
  )

  return Response.json(updated)
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/events/[shareId]/expenses/[expenseId]'>
) {
  const { shareId, expenseId } = await ctx.params

  const expense = await findExpenseInEvent(shareId, expenseId)
  if (!expense) {
    // Người khác vừa xóa trước — coi như đã đạt trạng thái mong muốn.
    return Response.json({ error: 'Khoản chi này vừa bị xóa.' }, { status: 404 })
  }

  await mutateEventData(expense.eventId, (tx) => tx.expense.delete({ where: { id: expense.id } }))

  // STT hiển thị được sinh lại lúc render nên không cần đánh số lại sortOrder,
  // lỗ hổng trong dãy sortOrder là vô hại.
  return new Response(null, { status: 204 })
}
