import { z } from 'zod'
import { mutateEventData } from '@/lib/event-mutations'
import { prisma } from '@/lib/prisma'

// POST /api/events/{shareId}/expenses — thêm một khoản chi.
// Spec: docs/screens/03-event-detail.md §5.4 (validate) và §7 (hệ quả dataVersion).

export const ExpenseInput = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Hãy nhập tên đồ/việc đã chi.')
    .max(120, 'Tên khoản chi tối đa 120 ký tự.'),
  // JPY luôn là số nguyên. Chặn số thực ngay ở đây, đừng để lọt vào phép tính.
  amount: z
    .number({ message: 'Hãy nhập số tiền.' })
    .int('Chỉ nhập số nguyên (JPY).')
    .positive('Số tiền phải lớn hơn 0.')
    .max(Number.MAX_SAFE_INTEGER),
  payerId: z.string().min(1, 'Hãy chọn người đã chi.'),
})

export async function POST(request: Request, ctx: RouteContext<'/api/events/[shareId]/expenses'>) {
  const { shareId } = await ctx.params

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

  const event = await prisma.event.findUnique({
    where: { shareId },
    select: {
      id: true,
      participants: { select: { id: true } },
      expenses: { orderBy: { sortOrder: 'desc' }, take: 1, select: { sortOrder: true } },
    },
  })
  if (!event) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  // Người đã chi phải thuộc CHÍNH sự kiện này — không tin payerId từ client.
  if (!event.participants.some((p) => p.id === parsed.data.payerId)) {
    return Response.json(
      { error: 'Người đã chi không thuộc sự kiện này.' },
      { status: 400 }
    )
  }

  const nextSortOrder = (event.expenses[0]?.sortOrder ?? -1) + 1

  const expense = await mutateEventData(event.id, (tx) =>
    tx.expense.create({
      data: {
        eventId: event.id,
        title: parsed.data.title,
        amount: parsed.data.amount,
        payerId: parsed.data.payerId,
        sortOrder: nextSortOrder,
      },
      select: { id: true, title: true, amount: true, payerId: true, sortOrder: true },
    })
  )

  return Response.json(expense, { status: 201 })
}
