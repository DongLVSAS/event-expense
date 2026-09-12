import type { Metadata } from 'next'
import Link from 'next/link'
import { CharacterAvatar } from '@/components/CharacterAvatar'

// Màn 05 — không tìm thấy sự kiện.
// Nghiệp vụ: docs/screens/05-not-found.md
//
// Hiện khi `shareId` không tồn tại, sai định dạng, hoặc sự kiện đã bị xóa hẳn.
// Trả HTTP 404 thật — đây là not-found boundary của App Router, không phải
// trang 200 giả 404.

export const metadata: Metadata = {
  title: 'Không tìm thấy sự kiện · Warikan',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <div className="flex items-end justify-center">
        <span className="-mr-2 inline-block -rotate-6 opacity-70">
          <CharacterAvatar characterId="koala" size={56} />
        </span>
        <span className="animate-wk-bob z-10 inline-block">
          <CharacterAvatar characterId="bear" size={76} />
        </span>
      </div>

      <h1 className="mt-5 font-display text-[24px] leading-tight font-extrabold text-ink">
        Không tìm thấy sự kiện này
      </h1>

      <p className="mx-auto mt-2 max-w-[280px] text-[13.5px] leading-relaxed text-muted">
        Link có thể đã hết hiệu lực hoặc sự kiện đã bị xóa.
      </p>

      <Link
        href="/"
        className="mt-6 inline-flex h-[52px] items-center justify-center rounded-full bg-primary px-7 text-[16px] font-extrabold text-white transition-colors hover:bg-primary-hover"
      >
        Về trang chủ
      </Link>
    </main>
  )
}
