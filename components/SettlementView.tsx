'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { CharacterAvatar } from '@/components/CharacterAvatar'
import { Confetti } from '@/components/Confetti'
import type { EventDTO } from '@/lib/event-dto'
import { optimisticWrite } from '@/lib/optimistic'
import {
  formatBalance,
  formatYen,
  isParticipantDone,
  settle,
  sortBalancesForDisplay,
} from '@/lib/settlement'

// Màn 04 — quyết toán (client island).
// Nghiệp vụ: docs/screens/04-settlement.md · Giao diện: handoff mục "4. Settlement"
//
// Kết quả quyết toán KHÔNG lấy từ server: tính lại tại chỗ bằng lib/settlement.ts
// từ participants + expenses. Chỉ trạng thái Done là dữ liệu thật từ DB.

const POLL_MS = 10_000

async function fetcher(url: string): Promise<EventDTO> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

export function SettlementView({ initialEvent }: { initialEvent: EventDTO }) {
  const { shareId } = initialEvent

  const { data, mutate } = useSWR<EventDTO>(`/api/events/${shareId}`, fetcher, {
    fallbackData: initialEvent,
    refreshInterval: POLL_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
  })

  const event = data ?? initialEvent

  const [toast, setToast] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)

  // Pháo hoa chỉ bắn đúng lúc CHUYỂN sang hoàn tất, không bắn lại khi mở lại màn.
  const prevSettledAt = useRef<string | null>(initialEvent.settledAt)
  const settleRequested = useRef(false)

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 2200)
  }, [])

  const result = useMemo(
    () => settle(event.participants, event.expenses),
    [event.participants, event.expenses]
  )
  const { total, transfers } = result
  const balances = useMemo(() => sortBalancesForDisplay(result.balances), [result.balances])

  const doneKeys = useMemo(() => new Set(event.doneTransferKeys), [event.doneTransferKeys])
  const participantById = useMemo(
    () => new Map(event.participants.map((p) => [p.id, p])),
    [event.participants]
  )

  const n = event.participants.length
  const base = n > 0 ? Math.floor(total / n) : 0
  const hasRemainder = n > 0 && total - base * n > 0

  useEffect(() => {
    if (prevSettledAt.current === null && event.settledAt !== null) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 4200)
    }
    prevSettledAt.current = event.settledAt
  }, [event.settledAt])

  // Trường hợp biên: không ai phải chuyển tiền cho ai. Không có checkbox nào để
  // tick nên phải nhờ server ghi settledAt một lần. Xem spec §5.3.
  useEffect(() => {
    if (transfers.length > 0 || event.settledAt !== null || settleRequested.current) return
    if (event.expenses.length === 0) return
    settleRequested.current = true
    void fetch(`/api/events/${shareId}/settle`, { method: 'POST' })
      .then((res) => (res.ok ? (res.json() as Promise<EventDTO>) : null))
      .then((updated) => (updated ? mutate(updated, { revalidate: false }) : mutate()))
  }, [transfers.length, event.settledAt, event.expenses.length, shareId, mutate])

  // Spec §4.3: tick hiện ra NGAY, không đợi server; hỏng thì rollback + toast.
  // Nút cũng không bị disabled trong lúc chờ.
  async function toggleDone(transferKey: string, next: boolean) {
    const nextKeys = next
      ? [...event.doneTransferKeys, transferKey]
      : event.doneTransferKeys.filter((k) => k !== transferKey)

    // settledAt do server quyết (xem lib/settle-state.ts). Ảnh optimistic chỉ
    // đoán phần checkbox, cố ý GIỮ NGUYÊN settledAt để pháo hoa không bắn sớm
    // rồi bắn lại lần nữa khi response về.
    const optimistic: EventDTO = { ...event, doneTransferKeys: nextKeys }

    const written = await optimisticWrite(mutate, optimistic, () =>
      fetch(`/api/events/${shareId}/transfers/${encodeURIComponent(transferKey)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: next, dataVersion: event.dataVersion }),
      })
    )

    if (written.ok) return

    if (written.status === 409) {
      // Người khác vừa sửa dữ liệu gốc — không retry mù, nạp lại rồi để người
      // dùng tick lại trên con số mới.
      showToast('Dữ liệu vừa được người khác cập nhật')
      await mutate()
      return
    }
    showToast(written.message)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/e/${shareId}`)
      showToast('Đã sao chép link')
    } catch {
      showToast('Trình duyệt không cho sao chép')
    }
  }

  const allDone = transfers.length > 0 && transfers.every((t) => doneKeys.has(t.transferKey))
  const nothingToTransfer = transfers.length === 0 && event.expenses.length > 0

  return (
    <>
      <main className="mx-auto w-full max-w-[430px] flex-1 px-5 pt-[54px] pb-[120px]">
        <Link
          href={`/e/${shareId}`}
          className="-ml-1 inline-flex h-11 max-w-full items-center rounded-[14px] px-1 text-[13.5px] font-bold text-muted transition-colors hover:text-ink"
        >
          <span className="truncate">← {event.name}</span>
        </Link>

        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="font-display text-[28px] leading-[1.1] font-extrabold text-ink">
            Quyết toán
          </h1>
          <button
            type="button"
            onClick={copyLink}
            className="h-11 shrink-0 rounded-full bg-primary-soft px-3.5 text-[12.5px] font-extrabold whitespace-nowrap text-primary-text transition-colors hover:bg-primary-badge"
          >
            🔗 Link
          </button>
        </div>

        <p className="mt-1 text-[12.5px] text-faint">
          Tổng {formatYen(total)} · {n} người · mỗi người gánh{' '}
          {hasRemainder ? `${formatYen(base)}–${(base + 1).toLocaleString('en-US')}` : formatYen(base)}
        </p>

        {/* ---- PHẦN A: bảng số dư ---- */}
        <div className="mt-4 overflow-hidden rounded-[22px] border border-border-card bg-surface">
          <div className="grid grid-cols-[26px_1fr_92px_50px] bg-cream-deep px-3.5 py-2 text-[10px] font-extrabold tracking-[.07em] text-on-cream-deep uppercase">
            <span>#</span>
            <span>Người</span>
            <span className="text-right">Số dư</span>
            <span className="text-right">TT</span>
          </div>

          {balances.map((b, index) => {
            const person = participantById.get(b.participantId)
            const done = isParticipantDone(b.participantId, transfers, doneKeys)
            return (
              <div
                key={b.participantId}
                className="grid grid-cols-[26px_1fr_92px_50px] items-center border-t border-hairline px-3.5 py-2.5"
              >
                <span className="text-[12px] font-bold text-faintest">{index + 1}</span>
                <span className="flex min-w-0 items-center gap-2">
                  {person && <CharacterAvatar characterId={person.characterId} size={30} />}
                  <span className="truncate text-[14px] font-bold text-ink">{person?.name}</span>
                </span>
                <span
                  className={`text-right font-display text-[16px] font-extrabold ${
                    b.balance > 0
                      ? 'text-success-text'
                      : b.balance < 0
                        ? 'text-danger-text'
                        : 'font-normal text-faint'
                  }`}
                >
                  {formatBalance(b.balance)}
                </span>
                <span className="text-right text-[11px] font-extrabold text-success-text">
                  {done ? 'Done' : ''}
                </span>
              </div>
            )
          })}
        </div>

        {/* ---- PHẦN B: gợi ý chuyển tiền ---- */}
        <h2 className="mt-6 text-[11.5px] font-extrabold tracking-[.06em] text-fainter uppercase">
          Gợi ý chuyển tiền
        </h2>

        {nothingToTransfer ? (
          <p className="mt-2 rounded-[18px] border-2 border-dashed border-success-border bg-success-soft px-4 py-6 text-center text-[15px] font-bold text-success-text">
            Mọi người đã chia đều rồi! 🎉
          </p>
        ) : transfers.length === 0 ? (
          <p className="mt-2 rounded-[18px] border-2 border-dashed border-[#EFE0D3] px-4 py-6 text-center text-[13.5px] text-on-cream">
            Chưa có khoản chi nào để quyết toán.
          </p>
        ) : (
          <>
            <ul className="mt-2 flex flex-col gap-2">
              {transfers.map((t) => {
                const from = participantById.get(t.fromId)
                const to = participantById.get(t.toId)
                const done = doneKeys.has(t.transferKey)
                return (
                  <li
                    key={t.transferKey}
                    className={`flex items-center gap-2 rounded-[18px] border px-3 py-2.5 transition-colors ${
                      done ? 'border-success-border bg-success-soft' : 'border-border-card bg-surface'
                    }`}
                  >
                    {from && <CharacterAvatar characterId={from.characterId} size={28} />}
                    <span className="max-w-[62px] truncate text-[13px] font-bold text-ink">
                      {from?.name}
                    </span>
                    <span className="text-[13px] text-faint">→</span>
                    {to && <CharacterAvatar characterId={to.characterId} size={28} />}
                    <span className="max-w-[62px] truncate text-[13px] font-bold text-ink">
                      {to?.name}
                    </span>
                    <span className="ml-auto shrink-0 font-display text-[15px] font-extrabold text-ink">
                      {formatYen(t.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void toggleDone(t.transferKey, !done)}
                      aria-pressed={done}
                      className={`h-11 w-[58px] shrink-0 rounded-[12px] text-[12px] font-extrabold transition-colors ${
                        done
                          ? 'bg-success text-white'
                          : 'border-[1.5px] border-border-card bg-surface text-muted hover:border-success-border'
                      }`}
                    >
                      {done ? '✓ Done' : 'Done'}
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-[12px] text-faint">
              Tối đa {Math.max(n - 1, 0)} lần chuyển khoản. Tick Done sau khi đã chuyển.
            </p>
          </>
        )}

        {/* ---- PHẦN C: chúc mừng ---- */}
        {(allDone || nothingToTransfer) && (
          <div className="animate-wk-pop mt-6 rounded-[22px] bg-gradient-to-r from-[#FFF1D6] to-[#FFE3EC] px-5 py-6 text-center">
            <p className="font-display text-[18px] leading-snug font-extrabold text-danger">
              Chúc mừng bạn đã có chuyến đi vui vẻ!
              <br />
              またね!
            </p>
          </div>
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-cream via-cream/95 to-transparent pt-8 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto w-full max-w-[430px] px-5">
          <Link
            href={`/e/${shareId}`}
            className="flex h-[52px] w-full items-center justify-center rounded-[18px] bg-dark text-[15px] font-extrabold text-white transition-colors hover:bg-dark-hover"
          >
            ← Quay lại danh sách chi tiêu
          </Link>
        </div>
      </div>

      {showConfetti && <Confetti />}

      {toast && (
        <div className="animate-wk-rise pointer-events-none fixed inset-x-5 bottom-24 z-50 mx-auto max-w-[390px] rounded-[16px] bg-dark px-4 py-3 text-center text-[13.5px] font-bold text-white">
          {toast}
        </div>
      )}
    </>
  )
}
