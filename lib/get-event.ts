import { type EventDTO, toDateString } from '@/lib/event-dto'
import { prisma } from '@/lib/prisma'

// Đọc toàn bộ dữ liệu một sự kiện theo shareId.
// Dùng chung cho Server Component (màn 03, 04) và route handler GET,
// để hai đường không bao giờ trả về hình dạng khác nhau.
//
// CHỈ gọi từ phía server. Không import vào file có 'use client'.

export async function getEventByShareId(shareId: string): Promise<EventDTO | null> {
  const event = await prisma.event.findUnique({
    where: { shareId },
    select: {
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
    },
  })

  if (!event) return null

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
