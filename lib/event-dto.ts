// Hình dạng dữ liệu sự kiện mà server trả về và client tiêu thụ.
// Khai ở một chỗ để route handler, Server Component và client island không lệch nhau.

export type EventParticipantDTO = {
  id: string
  name: string
  characterId: string
  sortOrder: number
}

export type EventExpenseDTO = {
  id: string
  title: string
  /** JPY, số nguyên > 0. */
  amount: number
  payerId: string
  sortOrder: number
}

/**
 * Món cần mua ở tab "Cần chi". Cố ý KHÔNG có amount và payerId —
 * xem docs/screens/03-event-detail.md §1.1.
 */
export type EventTodoDTO = {
  id: string
  title: string
  bought: boolean
  sortOrder: number
}

export type EventDTO = {
  shareId: string
  name: string
  /** `YYYY-MM-DD`, không có giờ. */
  date: string
  dataVersion: number
  settledAt: string | null
  participants: EventParticipantDTO[]
  expenses: EventExpenseDTO[]
  todos: EventTodoDTO[]
  /** transferKey của các giao dịch đã đánh dấu Done ở version hiện tại. */
  doneTransferKeys: string[]
}

/** Prisma trả DATE về dạng Date lúc nửa đêm UTC — cắt lấy phần ngày. */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}
