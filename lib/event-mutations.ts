import type { Prisma } from '@/generated/prisma/client'
import type { EventDTO } from '@/lib/event-dto'
import { type EventRow, eventQuery, toEventDTO } from '@/lib/get-event'
import { prisma } from '@/lib/prisma'

// Quy tắc dataVersion — phần dễ sai nhất của app.
// Nguồn: CLAUDE.md mục "dataVersion" · docs/screens/03-event-detail.md §7
//
// Kết quả quyết toán KHÔNG lưu DB, luôn tính lại từ participants + expenses.
// Chỉ trạng thái Done của từng giao dịch được lưu, khóa bằng transferKey.
// Nên mỗi khi dữ liệu gốc đổi, mọi Done cũ phải bị vô hiệu — nếu không người
// dùng sẽ thấy giao dịch "đã xong" trỏ vào những con số không còn tồn tại.

/**
 * Chạy `writes` trong MỘT transaction, kèm ba việc bắt buộc sau mọi thay đổi
 * participants hoặc expenses:
 *
 *   1. tăng `event.dataVersion`
 *   2. xóa toàn bộ `TransferStatus` của sự kiện
 *   3. đặt `event.settledAt = null`
 *
 * Gói chung ở đây để không nơi nào sót một trong ba. Mọi route handler sửa
 * participants/expenses đều PHẢI đi qua hàm này, đừng gọi prisma trực tiếp.
 *
 * Trả về `EventDTO` mới nhất, đọc trong cùng transaction đó — endpoint chỉ việc
 * `Response.json(...)` và client không phải GET lại.
 *
 * `writes` là mảng lệnh CHƯA await (`prisma.x.create({...})`), không phải
 * callback. Dạng mảng được gửi trong một lượt đi-về mạng duy nhất mà vẫn nguyên
 * tử; dạng callback `$transaction(async tx => ...)` gửi từng câu lệnh riêng nên
 * tốn 5 lượt cho 3 lệnh — đắt gấp bội khi function và DB ở xa nhau.
 */
export async function mutateEventData(
  shareId: string,
  writes: Prisma.PrismaPromise<unknown>[]
): Promise<EventDTO | null> {
  const results = await prisma.$transaction([
    ...writes,
    prisma.transferStatus.deleteMany({ where: { event: { shareId } } }),
    prisma.event.update({
      where: { shareId },
      data: {
        dataVersion: { increment: 1 },
        settledAt: null,
      },
    }),
    eventQuery(shareId),
  ])

  // $transaction trả mảng kết quả đúng thứ tự mảng đầu vào, nên phần tử cuối
  // luôn là kết quả của eventQuery. TS không suy ra được kiểu qua spread nên
  // phải nói rõ ở đây.
  const row = results.at(-1) as EventRow | null

  return row ? toEventDTO(row) : null
}

/**
 * Ghi rồi đọc lại sự kiện trong MỘT transaction, **không** đụng tới
 * `dataVersion` / `TransferStatus` / `settledAt`.
 *
 * Dùng cho những thay đổi KHÔNG ảnh hưởng phép chia tiền:
 *   - `Todo` (tab "Cần chi") — không có số tiền, không có người chi
 *   - tên / ngày sự kiện
 *   - bật/tắt Done một giao dịch (chính nó là trạng thái quyết toán)
 *
 * Không phải bản "nhẹ hơn" của `mutateEventData` — chọn nhầm là sai nghiệp vụ.
 * Sửa participants hoặc expenses thì BẮT BUỘC dùng `mutateEventData`.
 */
export async function writeEventNoReset(
  shareId: string,
  writes: Prisma.PrismaPromise<unknown>[]
): Promise<EventDTO | null> {
  const results = await prisma.$transaction([...writes, eventQuery(shareId)])
  const row = results.at(-1) as EventRow | null

  return row ? toEventDTO(row) : null
}
