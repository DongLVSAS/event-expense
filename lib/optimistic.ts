import type { EventDTO } from '@/lib/event-dto'

// Chạy một thao tác ghi theo kiểu optimistic: vẽ ngay trạng thái mong muốn,
// gửi request, thành công thì thay bằng EventDTO server trả về, hỏng thì
// rollback + báo lỗi.
//
// Spec: docs/screens/03-event-detail.md §12 và §11.1
//
// Dùng chung cho màn 03 và 04 để hai màn không lệch cách xử lý lỗi.

type Mutate = (
  data: Promise<EventDTO>,
  opts: {
    optimisticData: EventDTO
    rollbackOnError: true
    populateCache: true
    revalidate: false
  }
) => Promise<unknown>

export type WriteResult =
  /** Xong xuôi. */
  | { ok: true }
  /** Có lỗi cần báo cho người dùng; giao diện đã được rollback. */
  | { ok: false; message: string; status?: number }

/**
 * @param mutate       hàm `mutate` của SWR cho key sự kiện
 * @param optimistic   EventDTO sau khi áp thay đổi ở phía client
 * @param request      lời gọi fetch tới endpoint ghi
 * @param notFoundMessage  câu chữ khi server trả 404 (bản ghi vừa bị người khác xóa)
 */
export async function optimisticWrite(
  mutate: Mutate,
  optimistic: EventDTO,
  request: () => Promise<Response>,
  notFoundMessage?: string
): Promise<WriteResult> {
  let failure: WriteResult = { ok: true }

  const send = async (): Promise<EventDTO> => {
    const res = await request()

    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null)
      const message =
        res.status === 404 && notFoundMessage
          ? notFoundMessage
          : ((body as { error?: string } | null)?.error ?? 'Không lưu được. Thử lại nhé.')

      failure = { ok: false, message, status: res.status }
      // Ném lỗi để SWR rollback về dữ liệu trước đó.
      throw new Error(message)
    }

    return res.json() as Promise<EventDTO>
  }

  try {
    await mutate(send(), {
      optimisticData: optimistic,
      rollbackOnError: true,
      // Server đã trả về EventDTO mới nhất, đọc trong cùng transaction đã ghi —
      // không cần gọi GET lại.
      populateCache: true,
      revalidate: false,
    })
  } catch {
    if (failure.ok) {
      // Không phải lỗi từ server mà là đứt mạng.
      failure = { ok: false, message: 'Không kết nối được máy chủ.' }
    }
  }

  return failure
}
