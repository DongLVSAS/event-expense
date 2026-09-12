import type { Prisma } from '@/generated/prisma/client'
import { type EventDTO, toDateString } from '@/lib/event-dto'
import { prisma } from '@/lib/prisma'

// Đọc toàn bộ dữ liệu một sự kiện theo shareId.
// Dùng chung cho Server Component (màn 03, 04) và route handler GET,
// để hai đường không bao giờ trả về hình dạng khác nhau.
//
// CHỈ gọi từ phía server. Không import vào file có 'use client'.
//
// Tách làm ba phần — `eventQuery` (chưa await), `toEventDTO` (thuần) và
// `getEventByShareId` (tiện dụng) — để endpoint ghi có thể nhét `eventQuery`
// vào CUỐI cùng một `$transaction([...])` với các lệnh ghi. Nhờ vậy client
// nhận luôn dữ liệu mới mà không tốn thêm một lượt đi-về mạng nào.
// Xem CLAUDE.md mục "Đếm số lượt đi-về DB mỗi khi viết route".

const eventSelect = {
  shareId: true,
  name: true,
  date: true,
  dataVersion: true,
  settledAt: true,
  participants: {
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, characterId: true, sortOrder: true },
  },
  expenses: {
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true, amount: true, payerId: true, sortOrder: true },
  },
  todos: {
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true, bought: true, sortOrder: true },
  },
  transferStatuses: {
    where: { done: true },
    select: { transferKey: true },
  },
} satisfies Prisma.EventSelect

export type EventRow = Prisma.EventGetPayload<{ select: typeof eventSelect }>

/** Truy vấn chưa await — để gọi trực tiếp hoặc ghép vào `$transaction([...])`. */
export function eventQuery(shareId: string) {
  return prisma.event.findUnique({ where: { shareId }, select: eventSelect })
}

export function toEventDTO(event: EventRow): EventDTO {
  return {
    shareId: event.shareId,
    name: event.name,
    date: toDateString(event.date),
    dataVersion: event.dataVersion,
    settledAt: event.settledAt?.toISOString() ?? null,
    participants: event.participants,
    expenses: event.expenses,
    todos: event.todos,
    doneTransferKeys: event.transferStatuses.map((t) => t.transferKey),
  }
}

export async function getEventByShareId(shareId: string): Promise<EventDTO | null> {
  const event = await eventQuery(shareId)
  return event ? toEventDTO(event) : null
}
