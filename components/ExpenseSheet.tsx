'use client'

import { useEffect, useRef, useState } from 'react'
import { CharacterAvatar } from '@/components/CharacterAvatar'
import type { EventExpenseDTO, EventParticipantDTO } from '@/lib/event-dto'

// Bottom sheet thêm / sửa khoản chi.
// Nghiệp vụ: docs/screens/03-event-detail.md §5.4
// Giao diện: docs/design_handoff/README.md mục "5. Bottom sheet"

export type ExpenseDraft = { title: string; amount: number; payerId: string }

type Props = {
  participants: EventParticipantDTO[]
  /** null = chế độ thêm; có giá trị = chế độ sửa (prefill + hiện nút Xóa). */
  editing: EventExpenseDTO | null
  onClose: () => void
  /** Trả về thông báo lỗi để hiện trong sheet, hoặc null nếu thành công. */
  onSave: (draft: ExpenseDraft) => Promise<string | null>
  onDelete: (expenseId: string) => Promise<string | null>
}

/** Chỉ giữ chữ số — chặn dấu chấm, dấu phẩy, chữ cái ngay từ lúc gõ. */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
}

function withSeparator(digits: string): string {
  if (!digits) return ''
  return Number(digits).toLocaleString('en-US')
}

export function ExpenseSheet({ participants, editing, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [amountDigits, setAmountDigits] = useState(editing ? String(editing.amount) : '')
  const [payerId, setPayerId] = useState(editing?.payerId ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // Esc đóng sheet — bàn phím ngoài trên tablet dùng được.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    const trimmed = title.trim()
    if (!trimmed) return setError('Hãy nhập tên đồ/việc đã chi.')
    if (!amountDigits) return setError('Hãy nhập số tiền.')
    const amount = Number(amountDigits)
    if (!Number.isInteger(amount) || amount <= 0) return setError('Số tiền phải lớn hơn 0.')
    if (!payerId) return setError('Hãy chọn người đã chi.')

    setBusy(true)
    setError('')
    const problem = await onSave({ title: trimmed, amount, payerId })
    setBusy(false)
    if (problem) setError(problem)
  }

  async function handleDelete() {
    if (!editing) return
    setBusy(true)
    setError('')
    const problem = await onDelete(editing.id)
    setBusy(false)
    if (problem) setError(problem)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Scrim: bấm ra ngoài là đóng */}
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(46,42,59,.42)]"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="animate-wk-rise relative w-full max-w-[430px] rounded-t-[28px] bg-surface px-5 pt-3 pb-[max(26px,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-10px_rgba(46,42,59,.35)]"
      >
        <div className="mx-auto h-1 w-11 rounded-full bg-[#EDE6DE]" />

        <div className="mt-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-[22px] leading-tight font-extrabold text-ink">
            {editing ? 'Sửa khoản chi' : 'Thêm khoản chi'}
          </h2>
          {editing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="h-11 shrink-0 rounded-[14px] border-[1.5px] border-danger-border px-3 text-[13.5px] font-extrabold text-danger-text transition-colors hover:bg-danger-softer disabled:opacity-50"
            >
              Xóa
            </button>
          )}
        </div>

        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="VD: Tiền đồ nướng"
          className="mt-4 h-[50px] w-full rounded-[16px] border-[1.5px] border-border-input bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-faintest focus:border-primary"
        />

        <div className="relative mt-3">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] font-bold text-faint">
            ¥
          </span>
          <input
            value={withSeparator(amountDigits)}
            onChange={(e) => setAmountDigits(digitsOnly(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            className="h-[50px] w-full rounded-[16px] border-[1.5px] border-border-input bg-surface pr-4 pl-9 font-display text-[17px] font-extrabold text-ink outline-none placeholder:font-normal placeholder:text-faintest focus:border-primary"
          />
        </div>

        <p className="mt-4 text-[11.5px] font-extrabold tracking-[.06em] text-fainter uppercase">
          Ai đã chi?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {participants.map((p) => {
            const selected = p.id === payerId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPayerId(p.id)}
                className={`flex h-11 items-center gap-2 rounded-full border-2 pr-3.5 pl-1.5 text-[13.5px] font-bold transition-colors ${
                  selected
                    ? 'border-primary bg-primary-soft text-primary-text'
                    : 'border-border-card bg-surface text-muted hover:border-primary-border'
                }`}
              >
                <CharacterAvatar characterId={p.characterId} size={28} />
                <span className="max-w-[110px] truncate">{p.name}</span>
              </button>
            )
          })}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-[14px] bg-danger-soft px-3 py-2.5 text-[13px] font-semibold text-danger-text">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="mt-4 h-[52px] w-full rounded-[18px] bg-primary text-[16px] font-extrabold text-white transition-colors hover:bg-primary-hover disabled:bg-disabled"
        >
          {busy ? 'Đang lưu...' : 'Lưu khoản chi'}
        </button>
      </div>
    </div>
  )
}
