import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

// Quy tắc dataVersion — phần dễ sai nhất của app.
// Nguồn: CLAUDE.md mục "dataVersion" · docs/screens/03-event-detail.md §7
//
// Kết quả quyết toán KHÔNG lưu DB, luôn tính lại từ participants + expenses.
// Chỉ trạng thái Done của từng giao dịch được lưu, khóa bằng transferKey.
// Nên mỗi khi dữ liệu gốc đổi, mọi Done cũ phải bị vô hiệu — nếu không người
// dùng sẽ thấy giao dịch "đã xong" trỏ vào những con số không còn tồn tại.

/**
 * Chạy `work` trong MỘT transaction, kèm ba việc bắt buộc sau mọi thay đổi
 * participants hoặc expenses:
 *
 *   1. tăng `event.dataVersion`
 *   2. xóa toàn bộ `TransferStatus` của sự kiện
 *   3. đặt `event.settledAt = null`
 *
 * Gói chung ở đây để không nơi nào sót một trong ba. Mọi route handler sửa
 * participants/expenses đều PHẢI đi qua hàm này, đừng gọi prisma trực tiếp.
 */
export async function mutateEventData<T>(
  eventId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const result = await work(tx)

    await tx.transferStatus.deleteMany({ where: { eventId } })
    await tx.event.update({
      where: { id: eventId },
      data: {
        dataVersion: { increment: 1 },
        settledAt: null,
      },
    })

    return result
  })
}
