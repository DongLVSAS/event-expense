import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
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
 * Quyết `settledAt` mới dựa trên thực tế: xong hết thì ghi mốc thời gian, còn
 * sót thì đưa về null. Trả về giá trị mới kèm lệnh ghi cần thực hiện (rỗng khi
 * không có gì đổi).
 *
 * Trả về *lệnh chưa await* thay vì tự ghi, để caller nhét chung vào một
 * `$transaction([...])` với các lệnh khác — cả nhóm đi trong một lượt mạng.
 *
 * Quy tắc "pháo hoa chỉ bắn một lần" dựa vào đúng chỗ này: client chỉ bắn khi
 * thấy settledAt chuyển từ null sang có giá trị.
 */
export function settledAtChange(
  event: EventForSettle,
  transfers: Transfer[],
  doneKeys: Set<string>
): { settledAt: Date | null; ops: Prisma.PrismaPromise<unknown>[] } {
  const allDone = transfers.every((t) => doneKeys.has(t.transferKey))

  if (allDone && event.settledAt === null) {
    const settledAt = new Date()
    return {
      settledAt,
      ops: [prisma.event.update({ where: { id: event.id }, data: { settledAt } })],
    }
  }

  if (!allDone && event.settledAt !== null) {
    return {
      settledAt: null,
      ops: [prisma.event.update({ where: { id: event.id }, data: { settledAt: null } })],
    }
  }

  return { settledAt: event.settledAt, ops: [] }
}
