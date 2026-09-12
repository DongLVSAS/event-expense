'use client'

import Link from 'next/link'

// Lỗi hệ thống (500) — KHÁC với màn 404.
// docs/screens/05-not-found.md §3: shareId không tồn tại thì ra 404;
// còn server lỗi hay DB không kết nối được thì ra màn này, vì người dùng
// thử lại là có thể được, không phải link hỏng.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="font-display text-[24px] leading-tight font-extrabold text-ink">
        Có lỗi xảy ra
      </h1>

      <p className="mx-auto mt-2 max-w-[280px] text-[13.5px] leading-relaxed text-muted">
        Không tải được dữ liệu. Thử lại giúp mình nhé — dữ liệu của bạn vẫn còn nguyên.
      </p>

      {/* digest là mã Next sinh ra để tra log phía server; hiện nhỏ để người
          dùng đọc lại cho mình khi báo lỗi. Không lộ chi tiết lỗi thật. */}
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-faintest">Mã lỗi: {error.digest}</p>
      )}

      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-[52px] items-center justify-center rounded-full bg-primary px-7 text-[16px] font-extrabold text-white transition-colors hover:bg-primary-hover"
      >
        Thử lại
      </button>

      <Link
        href="/"
        className="mt-3 inline-flex h-11 items-center text-[13.5px] font-bold text-muted transition-colors hover:text-ink"
      >
        Về trang chủ
      </Link>
    </main>
  )
}
