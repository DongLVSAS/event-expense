import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { SettlementView } from '@/components/SettlementView'
import { getEventByShareId } from '@/lib/get-event'

// Màn 04 — quyết toán. Vỏ trang là Server Component; bảng số dư và danh sách
// giao dịch là client island vì cần tick Done và polling.

export const metadata: Metadata = {
  title: 'Quyết toán · Warikan',
  robots: { index: false, follow: false },
}

export default async function SettlementPage(props: PageProps<'/e/[shareId]/settlement'>) {
  const { shareId } = await props.params
  const event = await getEventByShareId(shareId)

  if (!event) notFound()

  // Vào thẳng bằng URL khi chưa có khoản chi nào thì không có gì để quyết toán —
  // đẩy về màn chi tiêu, nơi nút Quyết toán đang disable. Spec §6.
  if (event.expenses.length === 0) redirect(`/e/${shareId}`)

  return <SettlementView initialEvent={event} />
}
