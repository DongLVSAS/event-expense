'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CharacterAvatar } from '@/components/CharacterAvatar'
import { MAX_PARTICIPANTS, pickRandomCharacter } from '@/lib/characters'
import { addLocalEvent, isLocalStorageAvailable } from '@/lib/local-events'

// Màn 02 — Tạo sự kiện.
// Nghiệp vụ: docs/screens/02-event-form.md
// Giao diện: docs/design_handoff/README.md mục "2. Create / Edit event"

type Draft = {
  /** Chỉ tồn tại ở client tới lúc submit; id thật do DB sinh. */
  tempId: string
  name: string
  characterId: string
}

const MIN_PARTICIPANTS = 2

function todayLocal(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export default function NewEventPage() {
  const [name, setName] = useState('')
  const [participants, setParticipants] = useState<Draft[]>([])
  const [personInput, setPersonInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<{ shareId: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)

  const personInputRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  // Ngày mặc định phải tính Ở CLIENT, sau khi mount.
  // Trang này được prerender tĩnh, nên nếu đặt mặc định lúc render thì HTML sẽ
  // nhúng cứng NGÀY BUILD — người dùng mở tháng sau vẫn thấy ngày cũ.
  // Ghi thẳng vào DOM qua ref (đúng việc của effect) thay vì setState, để không
  // tạo thêm một vòng render.
  useEffect(() => {
    const el = dateRef.current
    if (el && !el.value) el.value = todayLocal()
  }, [])

  const usedCharacterIds = participants.map((p) => p.characterId)
  const isFull = participants.length >= MAX_PARTICIPANTS

  function addPerson() {
    const trimmed = personInput.trim()
    if (!trimmed) return

    if (isFull) {
      setError(`Một sự kiện tối đa ${MAX_PARTICIPANTS} người.`)
      return
    }
    if (participants.some((p) => p.name.toLocaleLowerCase('vi') === trimmed.toLocaleLowerCase('vi'))) {
      setError(`Tên "${trimmed}" đã có rồi.`)
      return
    }

    const character = pickRandomCharacter(usedCharacterIds)
    if (!character) {
      setError('Đã dùng hết nhân vật.')
      return
    }

    setParticipants((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), name: trimmed, characterId: character.id },
    ])
    setPersonInput('')
    setError('')
    // Giữ focus để gõ tiếp người kế — nhập danh sách thường đi theo chuỗi.
    personInputRef.current?.focus()
  }

  function removePerson(tempId: string) {
    setParticipants((prev) => prev.filter((p) => p.tempId !== tempId))
    setError('')
  }

  /** Tap vào nhân vật → đổi sang một con chưa dùng trong sự kiện này. */
  function rerollCharacter(tempId: string) {
    const others = participants.filter((p) => p.tempId !== tempId).map((p) => p.characterId)
    const next = pickRandomCharacter(others)
    if (!next) {
      setError('Đã dùng hết nhân vật.')
      return
    }
    setParticipants((prev) =>
      prev.map((p) => (p.tempId === tempId ? { ...p, characterId: next.id } : p))
    )
  }

  function renamePerson(tempId: string, raw: string) {
    const trimmed = raw.trim()
    setEditingId(null)
    if (!trimmed) return
    const clash = participants.some(
      (p) =>
        p.tempId !== tempId &&
        p.name.toLocaleLowerCase('vi') === trimmed.toLocaleLowerCase('vi')
    )
    if (clash) {
      setError(`Tên "${trimmed}" đã có rồi.`)
      return
    }
    setParticipants((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, name: trimmed } : p)))
    setError('')
  }

  /** Chặn nhanh ở client; server mới là nơi quyết định. */
  function clientValidate(date: string): string {
    if (!name.trim()) return 'Hãy nhập tên sự kiện.'
    if (!date) return 'Hãy chọn ngày diễn ra.'
    if (participants.length < MIN_PARTICIPANTS) return 'Sự kiện cần tối thiểu 2 người tham gia.'
    if (participants.length > MAX_PARTICIPANTS) return `Một sự kiện tối đa ${MAX_PARTICIPANTS} người.`
    return ''
  }

  async function handleSubmit() {
    const date = dateRef.current?.value ?? ''
    const problem = clientValidate(date)
    if (problem) {
      setError(problem)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          date,
          participants: participants.map((p) => ({ name: p.name, characterId: p.characterId })),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Không tạo được sự kiện. Thử lại nhé.')
        return
      }

      const saved = addLocalEvent(data.shareId)
      if (!saved || !isLocalStorageAvailable()) setStorageWarning(true)
      setCreated({ shareId: data.shareId })
    } catch {
      setError('Không kết nối được máy chủ. Thử lại nhé.')
    } finally {
      setSubmitting(false)
    }
  }

  const shareUrl = created ? `${window.location.origin}/e/${created.shareId}` : ''

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      setError('Trình duyệt không cho sao chép. Hãy chọn và copy thủ công.')
    }
  }

  // ---- Màn hiện link chia sẻ, ngay sau khi tạo xong ----
  if (created) {
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-5 pt-[54px] pb-8">
        <div className="animate-wk-pop rounded-[22px] border border-border-card bg-surface p-5 shadow-[0_3px_0_var(--color-shadow-flat)]">
          <h1 className="font-display text-[26px] leading-tight font-extrabold text-ink text-center">
            Đã tạo sự kiện! 🎉
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted text-center">
            Gửi link này cho cả nhóm để mọi người cùng nhập chi tiêu.
          </p>

          <div className="mt-4 rounded-[14px] bg-cream-deep px-3 py-3">
            <p className="font-mono text-[12.5px] break-all text-on-cream-deep">{shareUrl}</p>
          </div>

          <button
            type="button"
            onClick={copyLink}
            className="mt-3 h-[50px] w-full rounded-[16px] bg-primary text-[16px] font-extrabold text-white transition-colors hover:bg-primary-hover"
          >
            {copied ? '✓ Đã sao chép' : '🔗 Sao chép link chia sẻ'}
          </button>

          <Link
            href={`/e/${created.shareId}`}
            className="mt-2 flex h-[50px] w-full items-center justify-center rounded-[16px] bg-dark text-[16px] font-extrabold text-white transition-colors hover:bg-dark-hover"
          >
            Vào sự kiện
          </Link>

          {storageWarning && (
            <p className="mt-3 rounded-[14px] bg-danger-soft px-3 py-2 text-[12.5px] text-danger-text">
              Máy này không lưu được danh sách sự kiện. Hãy lưu lại link ở trên, nếu không bạn sẽ
              không tìm lại được.
            </p>
          )}
        </div>
      </main>
    )
  }

  // ---- Form tạo sự kiện ----
  return (
    <main className="mx-auto w-full max-w-[430px] flex-1 px-5 pt-[54px] pb-[130px]">
      <Link
        href="/"
        className="-ml-1 inline-flex h-11 items-center rounded-[14px] px-1 text-[13.5px] font-bold text-muted transition-colors hover:text-ink"
      >
        ← Quay lại
      </Link>

      <h1 className="mt-1 font-display text-[28px] leading-[1.1] font-extrabold text-ink">
        Tạo sự kiện mới
      </h1>

      {/* Tên sự kiện */}
      <label htmlFor="event-name" className="mt-6 block text-[11.5px] font-extrabold tracking-[.06em] text-fainter uppercase">
        Tên sự kiện *
      </label>
      <input
        id="event-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        placeholder="VD: Đi Hakone tháng 3"
        className="mt-1.5 h-[50px] w-full rounded-[16px] border-[1.5px] border-border-input bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-faintest focus:border-primary"
      />

      {/* Ngày diễn ra */}
      <label htmlFor="event-date" className="mt-4 block text-[11.5px] font-extrabold tracking-[.06em] text-fainter uppercase">
        Ngày diễn ra *
      </label>
      <input
        id="event-date"
        ref={dateRef}
        type="date"
        // Không kiểm soát bằng state: giá trị mặc định do effect ghi vào sau khi
        // mount, và không có gì trên màn phụ thuộc vào ngày nên khỏi cần re-render.
        defaultValue=""
        onChange={() => setError('')}
        className="mt-1.5 h-[50px] w-full rounded-[16px] border-[1.5px] border-border-input bg-surface px-4 text-[15px] text-ink outline-none focus:border-primary"
      />

      {/* Người tham gia */}
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-[11.5px] font-extrabold tracking-[.06em] text-fainter uppercase">
          Người tham gia *
        </span>
        <span className="text-[12px] font-bold text-faint">
          {participants.length}/{MAX_PARTICIPANTS} người
        </span>
      </div>

      <div className="mt-1.5 flex gap-2">
        <input
          ref={personInputRef}
          value={personInput}
          onChange={(e) => setPersonInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addPerson()
            }
          }}
          maxLength={50}
          disabled={isFull}
          placeholder={isFull ? 'Đã đủ 10 người' : 'Nhập tên rồi bấm ＋'}
          className="h-[50px] min-w-0 flex-1 rounded-[16px] border-[1.5px] border-border-input bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-faintest focus:border-primary disabled:bg-cream disabled:text-faint"
        />
        <button
          type="button"
          onClick={addPerson}
          disabled={isFull || !personInput.trim()}
          aria-label="Thêm người tham gia"
          className="h-[50px] w-[50px] shrink-0 rounded-[16px] bg-success text-[22px] leading-none font-extrabold text-white transition-colors hover:bg-success-hover disabled:bg-disabled"
        >
          ＋
        </button>
      </div>

      <div className="mt-2.5 min-h-[120px] rounded-[20px] bg-cream-deep p-3">
        {participants.length === 0 ? (
          <p className="flex h-[96px] items-center justify-center text-center text-[13px] text-on-cream">
            Chưa có ai. Thêm ít nhất 2 người nhé!
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {participants.map((p) => (
              <li key={p.tempId} className="animate-wk-pop relative w-[78px] pt-1.5">
                <button
                  type="button"
                  onClick={() => rerollCharacter(p.tempId)}
                  aria-label={`Đổi nhân vật của ${p.name}`}
                  className="mx-auto block"
                >
                  <CharacterAvatar characterId={p.characterId} size={56} />
                </button>

                {editingId === p.tempId ? (
                  <input
                    autoFocus
                    defaultValue={p.name}
                    maxLength={50}
                    onBlur={(e) => renamePerson(p.tempId, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="mt-1 w-full rounded-[8px] border-[1.5px] border-primary bg-surface px-1 text-center text-[11.5px] font-bold text-ink outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingId(p.tempId)}
                    title={p.name}
                    className="mt-1 block w-full truncate px-0.5 text-center text-[11.5px] leading-[1.2] font-bold text-ink"
                  >
                    {p.name}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => removePerson(p.tempId)}
                  aria-label={`Xóa ${p.name}`}
                  // Nút thấy được là 22px theo handoff, nhưng vùng chạm phủ 44px
                  // bằng pseudo-element để vẫn đạt chuẩn tối thiểu.
                  className="absolute top-0 right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface text-[12px] leading-none font-bold text-faint shadow-[0_1px_3px_rgba(46,42,59,.18)] transition-colors before:absolute before:-inset-[11px] before:content-[''] hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-2 text-[12.5px] text-faint">
        Tối thiểu 2 người. Mỗi người được gán một nhân vật riêng — chạm vào nhân vật để đổi.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-[14px] bg-danger-soft px-3 py-2.5 text-[13px] font-semibold text-danger-text">
          {error}
        </p>
      )}

      {/* CTA cố định đáy màn, có dải gradient để chữ phía sau không dính vào nút */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-cream via-cream/95 to-transparent pt-8 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto w-full max-w-[430px] px-5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-[54px] w-full rounded-[18px] bg-primary text-[17px] font-extrabold text-white shadow-[0_8px_18px_-6px_rgba(255,107,74,.6)] transition-colors hover:bg-primary-hover disabled:bg-disabled disabled:shadow-none"
          >
            {submitting ? 'Đang tạo...' : 'Tạo & lấy link chia sẻ'}
          </button>
        </div>
      </div>
    </main>
  )
}
