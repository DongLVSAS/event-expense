'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { CharacterAvatar } from '@/components/CharacterAvatar'
import { MAX_PARTICIPANTS, pickRandomCharacter } from '@/lib/characters'
import type { EventDTO, EventParticipantDTO } from '@/lib/event-dto'

// Màn 02 ở chế độ SỬA (/e/{shareId}/edit).
// Khác chế độ tạo ở một điểm cốt lõi: mỗi thao tác với người tham gia gọi API
// NGAY, vì sự kiện đã tồn tại và người khác có thể đang mở cùng lúc.
// Tên và ngày thì gom lại, chỉ lưu khi bấm "Lưu thay đổi".
// Xem docs/screens/02-event-form.md §1 và §8.

const MIN_PARTICIPANTS = 2

export function EventEditForm({ initialEvent }: { initialEvent: EventDTO }) {
  const router = useRouter()
  const { shareId } = initialEvent

  const [name, setName] = useState(initialEvent.name)
  const [participants, setParticipants] = useState<EventParticipantDTO[]>(
    initialEvent.participants
  )
  const [personInput, setPersonInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const dateRef = useRef<HTMLInputElement>(null)
  const personInputRef = useRef<HTMLInputElement>(null)

  const isFull = participants.length >= MAX_PARTICIPANTS
  const settledWarning = initialEvent.settledAt !== null

  async function call(url: string, init: RequestInit): Promise<unknown | null> {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(url, init)
      if (res.status === 204) return {}
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error ?? 'Không lưu được. Thử lại nhé.')
        return null
      }
      return body
    } catch {
      setError('Không kết nối được máy chủ. Thử lại nhé.')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function addPerson() {
    const trimmed = personInput.trim()
    if (!trimmed) return
    const character = pickRandomCharacter(participants.map((p) => p.characterId))
    if (!character) return setError('Đã dùng hết nhân vật.')

    const created = (await call(`/api/events/${shareId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, characterId: character.id }),
    })) as EventParticipantDTO | null

    if (created) {
      setParticipants((prev) => [...prev, created])
      setPersonInput('')
      personInputRef.current?.focus()
    }
  }

  async function removePerson(id: string) {
    const ok = await call(`/api/events/${shareId}/participants/${id}`, { method: 'DELETE' })
    if (ok) setParticipants((prev) => prev.filter((p) => p.id !== id))
  }

  async function patchPerson(id: string, next: { name: string; characterId: string }) {
    const updated = (await call(`/api/events/${shareId}/participants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })) as EventParticipantDTO | null

    if (updated) setParticipants((prev) => prev.map((p) => (p.id === id ? updated : p)))
  }

  function rerollCharacter(p: EventParticipantDTO) {
    const next = pickRandomCharacter(
      participants.filter((x) => x.id !== p.id).map((x) => x.characterId)
    )
    if (!next) return setError('Đã dùng hết nhân vật.')
    void patchPerson(p.id, { name: p.name, characterId: next.id })
  }

  function renamePerson(p: EventParticipantDTO, raw: string) {
    setEditingId(null)
    const trimmed = raw.trim()
    if (!trimmed || trimmed === p.name) return
    void patchPerson(p.id, { name: trimmed, characterId: p.characterId })
  }

  async function saveAndLeave() {
    const date = dateRef.current?.value ?? ''
    if (!name.trim()) return setError('Hãy nhập tên sự kiện.')
    if (!date) return setError('Hãy chọn ngày diễn ra.')
    if (participants.length < MIN_PARTICIPANTS)
      return setError('Sự kiện cần tối thiểu 2 người tham gia.')

    const ok = await call(`/api/events/${shareId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), date }),
    })
    if (ok) {
      router.push(`/e/${shareId}`)
      router.refresh()
    }
  }

  return (
    <main className="mx-auto w-full max-w-[430px] flex-1 px-5 pt-[54px] pb-[130px]">
      <Link
        href={`/e/${shareId}`}
        className="-ml-1 inline-flex h-11 items-center rounded-[14px] px-1 text-[13.5px] font-bold text-muted transition-colors hover:text-ink"
      >
        ← Quay lại
      </Link>

      <h1 className="mt-1 font-display text-[28px] leading-[1.1] font-extrabold text-ink">
        Sửa sự kiện
      </h1>

      {settledWarning && (
        <p className="mt-3 rounded-[14px] bg-primary-soft px-3 py-2.5 text-[12.5px] font-semibold text-primary-text">
          Sự kiện này đã quyết toán xong. Thêm hoặc xóa người sẽ xóa toàn bộ đánh dấu
          &quot;Done&quot; và tính lại từ đầu.
        </p>
      )}

      <label htmlFor="event-name" className="mt-6 block text-[11.5px] font-extrabold tracking-[.06em] text-fainter uppercase">
        Tên sự kiện *
      </label>
      <input
        id="event-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        className="mt-1.5 h-[50px] w-full rounded-[16px] border-[1.5px] border-border-input bg-surface px-4 text-[15px] text-ink outline-none focus:border-primary"
      />

      <label htmlFor="event-date" className="mt-4 block text-[11.5px] font-extrabold tracking-[.06em] text-fainter uppercase">
        Ngày diễn ra *
      </label>
      <input
        id="event-date"
        ref={dateRef}
        type="date"
        defaultValue={initialEvent.date}
        className="mt-1.5 h-[50px] w-full rounded-[16px] border-[1.5px] border-border-input bg-surface px-4 text-[15px] text-ink outline-none focus:border-primary"
      />

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
              void addPerson()
            }
          }}
          maxLength={50}
          disabled={isFull || busy}
          placeholder={isFull ? `Đã đủ ${MAX_PARTICIPANTS} người` : 'Nhập tên rồi bấm ＋'}
          className="h-[50px] min-w-0 flex-1 rounded-[16px] border-[1.5px] border-border-input bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-faintest focus:border-primary disabled:bg-cream disabled:text-faint"
        />
        <button
          type="button"
          onClick={() => void addPerson()}
          disabled={isFull || busy || !personInput.trim()}
          aria-label="Thêm người tham gia"
          className="h-[50px] w-[50px] shrink-0 rounded-[16px] bg-success text-[22px] leading-none font-extrabold text-white transition-colors hover:bg-success-hover disabled:bg-disabled"
        >
          ＋
        </button>
      </div>

      <div className="mt-2.5 min-h-[120px] rounded-[20px] bg-cream-deep p-3">
        <ul className="flex flex-wrap gap-1">
          {participants.map((p) => (
            <li key={p.id} className="animate-wk-pop relative w-[78px] pt-1.5">
              <button
                type="button"
                onClick={() => rerollCharacter(p)}
                disabled={busy}
                aria-label={`Đổi nhân vật của ${p.name}`}
                className="mx-auto block"
              >
                <CharacterAvatar characterId={p.characterId} size={56} />
              </button>

              {editingId === p.id ? (
                <input
                  autoFocus
                  defaultValue={p.name}
                  maxLength={50}
                  onBlur={(e) => renamePerson(p, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="mt-1 w-full rounded-[8px] border-[1.5px] border-primary bg-surface px-1 text-center text-[11.5px] font-bold text-ink outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingId(p.id)}
                  title={p.name}
                  className="mt-1 block w-full truncate px-0.5 text-center text-[11.5px] leading-[1.2] font-bold text-ink"
                >
                  {p.name}
                </button>
              )}

              <button
                type="button"
                onClick={() => void removePerson(p.id)}
                disabled={busy}
                aria-label={`Xóa ${p.name}`}
                className="absolute top-0 right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface text-[12px] leading-none font-bold text-faint shadow-[0_1px_3px_rgba(46,42,59,.18)] transition-colors before:absolute before:-inset-[11px] before:content-[''] hover:text-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-2 text-[12.5px] text-faint">
        Thay đổi người tham gia được lưu ngay. Tên và ngày lưu khi bấm nút dưới.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-[14px] bg-danger-soft px-3 py-2.5 text-[13px] font-semibold text-danger-text">
          {error}
        </p>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-cream via-cream/95 to-transparent pt-8 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto w-full max-w-[430px] px-5">
          <button
            type="button"
            onClick={() => void saveAndLeave()}
            disabled={busy}
            className="h-[54px] w-full rounded-[18px] bg-primary text-[17px] font-extrabold text-white shadow-[0_8px_18px_-6px_rgba(255,107,74,.6)] transition-colors hover:bg-primary-hover disabled:bg-disabled disabled:shadow-none"
          >
            {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </main>
  )
}
