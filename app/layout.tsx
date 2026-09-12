import type { Metadata } from 'next'
import { Baloo_2, Nunito } from 'next/font/google'
import './globals.css'

// Font theo docs/design_handoff/README.md mục Typography.
// Bắt buộc có subset 'vietnamese' — toàn bộ text UI là tiếng Việt.
// Dùng bản variable để chỉ tải một file mà vẫn đủ mọi weight.

const baloo = Baloo_2({
  variable: '--font-display',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
})

const nunito = Nunito({
  variable: '--font-body',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Warikan',
  description: 'Ghi chép chi tiêu buổi đi chơi và tự động quyết toán ai trả ai bao nhiêu.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={`${baloo.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
