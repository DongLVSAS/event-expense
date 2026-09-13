'use client'

import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import useSWR from 'swr'
import { CharacterAvatar } from '@/components/CharacterAvatar'
import type { EventDTO } from '@/lib/event-dto'
import {
  getLocalEventIdsServerSnapshot,
  getLocalEventIdsSnapshot,
  isLocalStorageAvailable,
  removeLocalEvent,
  subscribeLocalEvents,
} from '@/lib/local-events'
import { formatYen } from '@/lib/settlement'

// Màn 01 — Home.
// Nghiệp vụ: docs/screens/01-home.md · Giao diện: handoff mục "1. Home"
//
// Không có tài khoản nên không có danh sách phía server: màn này dựng từ các
// shareId lưu trong localStorage của CHÍNH máy này.

type Row =
  | { shareId: string; state: 'ok'; event: EventDTO }
  | { shareId: string; state: 'missing' } // người khác đã xóa hẳn
  | { shareId: string; state: 'error' }

const MAX_AVATARS = 4

/**
 * Nạp tóm tắt từng sự kiện, gọi song song. Một máy thường chỉ có vài sự kiện
 * nên không cần endpoint gộp — xem docs/screens/01-home.md §1.
 */
async function loadRows(ids: string[]): Promise<Row[]> {
  const loaded = await Promise.all(
    ids.map(async (shareId): Promise<Row> => {
      try {
        const res = await fetch(`/api/events/${shareId}`)
        if (res.status === 404) return { shareId, state: 'missing' }
        if (!res.ok) return { shareId, state: 'error' }
        return { shareId, state: 'ok', event: await res.json() }
      } catch {
        return { shareId, state: 'error' }
      }
    })
  )

  // Sắp theo ngày diễn ra giảm dần; cùng ngày thì giữ thứ tự trong localStorage
  // (mới tạo/mới mở đứng trước). Item hỏng đẩy xuống cuối.
  const rank = new Map(ids.map((id, i) => [id, i]))
  loaded.sort((a, b) => {
    if (a.state !== 'ok' || b.state !== 'ok') {
      if (a.state === 'ok') return -1
      if (b.state === 'ok') return 1
      return 0
    }
    if (a.event.date !== b.event.date) return a.event.date < b.event.date ? 1 : -1
    return (rank.get(a.shareId) ?? 0) - (rank.get(b.shareId) ?? 0)
  })

  return loaded
}

export default function HomePage() {
  const [confirmRemove, setConfirmRemove] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // localStorage là external store, đọc bằng useSyncExternalStore chứ không phải
  // useEffect + setState: không thừa một vòng render, và tự cập nhật khi tab khác
  // thêm/bớt sự kiện.
  const ids = useSyncExternalStore(
    subscribeLocalEvents,
    getLocalEventIdsSnapshot,
    getLocalEventIdsServerSnapshot
  )

  // Key đổi theo danh sách id → xóa một sự kiện là SWR tự nạp lại.
  const { data: rows, mutate } = useSWR(['home', ids.join(',')], () => loadRows(ids), {
    revalidateOnFocus: true,
  })

  // Chỉ xét sau khi SWR nạp xong. Nếu tính ngay lúc render đầu, server luôn ra
  // false còn client có thể ra true → hydration mismatch.
  const storageBlocked = rows !== undefined && !isLocalStorageAvailable()

  /**
   * Gỡ khỏi máy này thôi. Chỉ dùng cho thẻ đã 404 hoặc lỗi mạng (§6.3) —
   * sự kiện không còn trên server nên chẳng có gì để DELETE.
   */
  function removeFromDevice(shareId: string) {
    removeLocalEvent(shareId)
    setConfirmRemove(null)
  }

  /**
   * Xóa hẳn: mọi người giữ link đều mất sự kiện. Không hoàn tác được.
   * Spec: docs/screens/01-home.md §4.1
   */
  async function deleteEverywhere(shareId: string) {
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/events/${shareId}`, { method: 'DELETE' })
      // 404 = người khác vừa xóa trước. Trạng thái mong muốn đã đạt, coi là xong.
      if (!res.ok && res.status !== 404) {
        const body: unknown = await res.json().catch(() => null)
        setDeleteError((body as { error?: string } | null)?.error ?? 'Không xóa được. Thử lại nhé.')
        return
      }
      // Chỉ gỡ khỏi localStorage SAU khi server đã xóa thật. Làm ngược lại thì
      // một lần xóa hụt sẽ khiến người dùng mất luôn đường vào sự kiện còn sống.
      removeLocalEvent(shareId)
      setConfirmRemove(null)
    } catch {
      setDeleteError('Không kết nối được máy chủ. Thử lại nhé.')
    } finally {
      setDeleting(false)
    }
  }

  function closeConfirm() {
    setConfirmRemove(null)
    setDeleteError('')
  }

  return (
    <>
      <main className="mx-auto w-full max-w-[430px] flex-1 px-5 pt-[54px] pb-[110px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold tracking-[.1em] text-fainter uppercase">
              Chào bạn 👋
            </p>
            <h1 className="mt-0.5 font-display text-[28px] leading-[1.1] font-extrabold text-ink">
              Đi chơi cùng XV
            </h1>
          </div>
          <span className="animate-wk-bob mt-1 shrink-0">
            <CharacterAvatar characterId="fox" size={52} />
          </span>
        </div>

        {storageBlocked && (
          <p className="mt-4 rounded-[14px] bg-danger-soft px-3 py-2.5 text-[12.5px] font-semibold text-danger-text">
            Trình duyệt đang chặn lưu dữ liệu nên máy này không nhớ được danh sách sự kiện. Bạn vẫn
            tạo và mở sự kiện bằng link được, nhớ lưu lại link.
          </p>
        )}

        {rows === undefined ? (
          // Skeleton đúng hình dạng thẻ thật, không dùng spinner toàn trang.
          <ul className="mt-5 flex flex-col gap-3">
            {[0, 1].map((i) => (
              <li
                key={i}
                className="h-[148px] animate-pulse rounded-[22px] border border-border-card bg-surface"
              />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="mt-14 text-center">
            <div className="flex items-end justify-center">
              <span className="-mr-3 inline-block -rotate-8">
                <CharacterAvatar characterId="penguin" size={64} />
              </span>
              <span className="animate-wk-bob z-10 inline-block">
                <CharacterAvatar characterId="bunny" size={76} />
              </span>
              <span className="-ml-3 inline-block rotate-8">
                <CharacterAvatar characterId="frog" size={64} />
              </span>
            </div>
            <h2 className="mt-5 font-display text-[22px] font-extrabold text-ink">
              Chưa có sự kiện nào
            </h2>
            <p className="mx-auto mt-2 max-w-[260px] text-[13.5px] leading-relaxed text-muted">
              Tạo sự kiện đầu tiên của bạn — ghi chi tiêu chung, app tự tính ai trả cho ai.
            </p>
            <Link
              href="/new"
              className="mt-5 inline-flex h-[52px] items-center justify-center rounded-full bg-primary px-6 text-[16px] font-extrabold text-white transition-colors hover:bg-primary-hover"
            >
              ＋ Tạo sự kiện
            </Link>
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {rows.map((row) => {
              if (row.state !== 'ok') {
                return (
                  <li
                    key={row.shareId}
                    className="rounded-[22px] border border-border-card bg-surface p-4 opacity-70"
                  >
                    <p className="text-[13.5px] text-muted italic">
                      {row.state === 'missing'
                        ? 'Sự kiện này đã bị xóa.'
                        : 'Không tải được sự kiện này.'}
                    </p>
                    <div className="mt-3 flex gap-2">
                      {row.state === 'error' && (
                        <button
                          type="button"
                          onClick={() => void mutate()}
                          className="h-11 flex-1 rounded-[14px] bg-cream-deep text-[13.5px] font-extrabold text-muted"
                        >
                          Thử lại
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFromDevice(row.shareId)}
                        className="h-11 flex-1 rounded-[14px] bg-cream-deep text-[13.5px] font-extrabold text-muted transition-colors hover:text-danger"
                      >
                        Gỡ khỏi danh sách
                      </button>
                    </div>
                  </li>
                )
              }

              const { event } = row
              const total = event.expenses.reduce((s, e) => s + e.amount, 0)
              const settled = event.settledAt !== null
              const shown = event.participants.slice(0, MAX_AVATARS)
              const rest = event.participants.length - shown.length

              return (
                <li
                  key={row.shareId}
                  className="animate-wk-rise rounded-[22px] border border-border-card bg-surface p-4 shadow-[0_3px_0_var(--color-shadow-flat)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-[18px] leading-[1.25] font-bold text-ink">
                        {event.name}
                      </h2>
                      <p className="mt-0.5 text-[12.5px] text-faint">
                        {event.date.split('-').reverse().join('/')} · {event.participants.length}{' '}
                        người
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] leading-[1.2] font-extrabold whitespace-nowrap ${
                        settled
                          ? 'bg-success-badge text-success-text'
                          : 'bg-primary-badge text-primary-deep'
                      }`}
                    >
                      {settled ? 'Đã xong' : 'Chưa quyết toán'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className="flex items-center">
                      {shown.map((p) => (
                        <span key={p.id} className="-mr-1.5 inline-block">
                          <CharacterAvatar characterId={p.characterId} size={34} />
                        </span>
                      ))}
                      {rest > 0 && (
                        <span className="ml-3 text-[12px] font-bold text-faint">+{rest}</span>
                      )}
                    </span>
                    <span className="text-right">
                      <span className="block text-[10px] font-extrabold tracking-[.07em] text-fainter uppercase">
                        Tổng chi
                      </span>
                      <span className="block font-display text-[20px] leading-none font-extrabold text-primary">
                        {formatYen(total)}
                      </span>
                    </span>
                  </div>

                  <div className="mt-3.5 flex gap-2">
                    <Link
                      href={`/e/${row.shareId}`}
                      className="flex h-11 flex-1 items-center justify-center rounded-[14px] bg-dark text-[14px] font-extrabold text-white transition-colors hover:bg-dark-hover"
                    >
                      Mở sự kiện
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError('')
                        setConfirmRemove(row)
                      }}
                      aria-label={`Xóa hẳn "${event.name}"`}
                      className="h-11 w-11 shrink-0 rounded-[14px] bg-[#FFF8F1] text-[15px] font-bold text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {/* FAB — chỉ hiện khi đã có sự kiện; trạng thái rỗng đã có nút chính riêng */}
      {rows !== undefined && rows.length > 0 && (
        <Link
          href="/new"
          className="fixed right-5 bottom-[max(28px,env(safe-area-inset-bottom))] z-20 flex h-14 items-center justify-center rounded-full bg-primary px-5 text-[16px] font-extrabold text-white shadow-[0_10px_22px_-6px_rgba(255,107,74,.7)] transition-colors hover:bg-primary-hover"
        >
          ＋ Tạo sự kiện
        </Link>
      )}

      {/* Xác nhận xóa hẳn. Phải nói thẳng là người khác cũng mất — spec §4.1. */}
      {confirmRemove?.state === 'ok' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button
            type="button"
            aria-label="Hủy"
            onClick={closeConfirm}
            disabled={deleting}
            className="absolute inset-0 bg-[rgba(46,42,59,.42)]"
          />
          <div className="animate-wk-pop relative w-full max-w-[340px] rounded-[22px] bg-surface p-5">
            <h2 className="font-display text-[19px] leading-snug font-extrabold text-ink text-center">
              Xóa hẳn &quot;{confirmRemove.event.name}&quot;?
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted text-center">
              Sự kiện sẽ bị xóa ở <strong className="font-extrabold text-danger-text">mọi nơi</strong> —
              những người khác đang giữ link chia sẻ cũng sẽ không mở được nữa. Toàn bộ khoản chi
              và kết quả quyết toán sẽ mất. Không khôi phục lại được.
            </p>

            {deleteError && (
              <p
                role="alert"
                className="mt-3 rounded-[14px] bg-danger-soft px-3 py-2.5 text-center text-[13px] font-semibold text-danger-text"
              >
                {deleteError}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={deleting}
                className="h-11 flex-1 rounded-[14px] bg-cream-deep text-[14px] font-extrabold text-muted disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void deleteEverywhere(confirmRemove.shareId)}
                disabled={deleting}
                className="h-11 flex-1 rounded-[14px] bg-danger text-[14px] font-extrabold text-white transition-colors hover:bg-danger-strong disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xóa hẳn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
