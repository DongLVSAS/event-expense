import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { EventDetail } from '@/components/EventDetail'
import { getEventByShareId } from '@/lib/get-event'

// Màn 03 — chi tiết sự kiện. Vỏ trang là Server Component (đọc DB qua Prisma);
// phần danh sách chi tiêu là client island vì cần state, sheet và polling.

// cache() gộp hai lần gọi trong cùng một request (generateMetadata + page)
// thành một truy vấn DB.
const getEvent = cache(getEventByShareId)

export async function generateMetadata(props: PageProps<'/e/[shareId]'>): Promise<Metadata> {
  const { shareId } = await props.params
  const event = await getEvent(shareId)

  return {
    title: event ? `${event.name} · Warikan` : 'Không tìm thấy sự kiện · Warikan',
    // Link chia sẻ không được search engine đánh chỉ mục.
    robots: { index: false, follow: false },
  }
}

export default async function EventPage(props: PageProps<'/e/[shareId]'>) {
  const { shareId } = await props.params
  const event = await getEvent(shareId)

  if (!event) notFound()

  return <EventDetail initialEvent={event} />
}
