import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EventEditForm } from '@/components/EventEditForm'
import { getEventByShareId } from '@/lib/get-event'

// Màn 02 ở chế độ sửa. Vào từ nút ⋯ trên header màn chi tiết sự kiện
// (xem docs/screens/03-event-detail.md §3.1).

export const metadata: Metadata = {
  title: 'Sửa sự kiện · Warikan',
  robots: { index: false, follow: false },
}

export default async function EditEventPage(props: PageProps<'/e/[shareId]/edit'>) {
  const { shareId } = await props.params
  const event = await getEventByShareId(shareId)

  if (!event) notFound()

  return <EventEditForm initialEvent={event} />
}
