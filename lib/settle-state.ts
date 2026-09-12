import type { Prisma } from '@/generated/prisma/client'
import { settle, type Transfer } from '@/lib/settlement'

// Trạng thái "đã quyết toán xong" do SERVER quyết, không phải client.
// Client chỉ bật/tắt Done từng dòng; việc suy ra settledAt nằm ở đây để
// hai đường (tick dòng cuối, và trường hợp không có giao dịch nào) dùng chung
// một logic, không lệch nhau.

type EventForSettle = {
  id: string
  dataVersion: number
  settledAt: Date | null
  participants: { id: string; sortOrder: number }[]
  expenses: { amount: number; payerId: string }[]
}

export function computeTransfers(event: EventForSettle): Transfer[] {
  return settle(event.participants, event.expenses).transfers
}

/**
 * Đồng bộ `settledAt` với thực tế: xong hết thì ghi mốc thời gian, còn sót
 * thì đưa về null. Trả về giá trị mới.
 *
 * Quy tắc "pháo hoa chỉ bắn một lần" dựa vào đúng chỗ này: client chỉ bắn khi
 * thấy settledAt chuyển từ null sang có giá trị.
 */
export async function syncSettledAt(
  tx: Prisma.TransactionClient,
  event: EventForSettle,
  transfers: Transfer[],
  doneKeys: Set<string>
): Promise<Date | null> {
  const allDone = transfers.every((t) => doneKeys.has(t.transferKey))

  if (allDone && event.settledAt === null) {
    const settledAt = new Date()
    await tx.event.update({ where: { id: event.id }, data: { settledAt } })
    return settledAt
  }

  if (!allDone && event.settledAt !== null) {
    await tx.event.update({ where: { id: event.id }, data: { settledAt: null } })
    return null
  }

  return event.settledAt
}
