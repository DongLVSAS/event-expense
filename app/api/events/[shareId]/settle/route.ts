import { prisma } from '@/lib/prisma'
import { computeTransfers, syncSettledAt } from '@/lib/settle-state'

// POST /api/events/{shareId}/settle
//
// Dùng cho trường hợp biên: mọi người đều có số dư 0 nên KHÔNG phát sinh giao
// dịch nào — không có checkbox nào để tick, mà sự kiện vẫn phải được coi là
// đã xong (hiện "Mọi người đã chia đều rồi!", bắn pháo hoa, badge Đã xong ở Home).
// Xem docs/screens/04-settlement.md §5.3.
//
// Server tự tính lại để xác minh đúng là không có giao dịch nào — không tin client.

export async function POST(_request: Request, ctx: RouteContext<'/api/events/[shareId]/settle'>) {
  const { shareId } = await ctx.params

  const event = await prisma.event.findUnique({
    where: { shareId },
    select: {
      id: true,
      dataVersion: true,
      settledAt: true,
      participants: { select: { id: true, sortOrder: true } },
      expenses: { select: { amount: true, payerId: true } },
    },
  })
  if (!event) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  if (event.participants.length === 0) {
    return Response.json({ error: 'Sự kiện chưa có người tham gia.' }, { status: 400 })
  }

  const transfers = computeTransfers(event)
  if (transfers.length > 0) {
    // Có giao dịch thì phải tick từng dòng, không được đánh dấu xong hàng loạt.
    return Response.json(
      { error: 'Sự kiện này còn giao dịch cần chuyển tiền.' },
      { status: 400 }
    )
  }

  const settledAt = await prisma.$transaction((tx) =>
    syncSettledAt(tx, event, transfers, new Set())
  )

  return Response.json({ settledAt: settledAt?.toISOString() ?? null })
}
