'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { CharacterAvatar } from '@/components/CharacterAvatar'
import { type ExpenseDraft, ExpenseSheet } from '@/components/ExpenseSheet'
import { SwipeToDelete } from '@/components/SwipeToDelete'
import { TodoList } from '@/components/TodoList'
import type { EventDTO, EventExpenseDTO } from '@/lib/event-dto'
import { addLocalEvent, removeLocalEvent } from '@/lib/local-events'
import { optimisticWrite } from '@/lib/optimistic'
import { formatYen } from '@/lib/settlement'

// Màn 03 — danh sách chi tiêu (client island).
// Nghiệp vụ: docs/screens/03-event-detail.md
// Giao diện: docs/design_handoff/README.md mục "3. Event detail"

const POLL_MS = 10_000
/** Toast "Hoàn tác" sau khi vuốt xóa giữ bao lâu. Spec: §6.3.1 + handoff mục "3. Event detail". */
const UNDO_MS = 3_000

async function fetcher(url: string): Promise<EventDTO> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

export function EventDetail({ initialEvent }: { initialEvent: EventDTO }) {
  const { shareId } = initialEvent
  const router = useRouter()

  // Đồng bộ nhiều người: refetch khi tab được focus + poll 10s.
  // SWR mặc định không poll khi tab ẩn (refreshWhenHidden: false) — đúng ý spec.
  const { data, mutate, isValidating } = useSWR<EventDTO>(`/api/events/${shareId}`, fetcher, {
    fallbackData: initialEvent,
    refreshInterval: POLL_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
  })

  const event = data ?? initialEvent

  // Tab là state ở client, KHÔNG đưa vào URL: link chia sẻ phải mở ra cùng một
  // thứ cho mọi người. Mặc định "Cần chi" — xem docs/screens/03-event-detail.md §4.
  const [tab, setTab] = useState<'todo' | 'paid'>('todo')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<EventExpenseDTO | null>(null)
  const [toast, setToast] = useState('')
  // Dialog "kết quả quyết toán sẽ được tính lại". Giữ cả nhãn nút xác nhận vì
  // cùng một dialog phục vụ hai việc: sửa khoản chi, và vuốt xóa khoản chi.
  const [confirmReset, setConfirmReset] = useState<null | { run: () => void; confirmLabel: string }>(
    null
  )
  /** Khoản chi vừa vuốt xóa, giữ UNDO_MS để hoàn tác. Xem §6.3.1. */
  const [undoDraft, setUndoDraft] = useState<ExpenseDraft | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  /** Khoản chi đang được làm nổi sau khi chốt chặn quyết toán chỉ tới nó. */
  const [highlightId, setHighlightId] = useState<string | null>(null)

  // Mở link chia sẻ lần đầu trên máy này → nhớ lại để hiện ở màn Home.
  useEffect(() => {
    addLocalEvent(shareId)
  }, [shareId])

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    }
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 2200)
  }, [])

  const total = event.expenses.reduce((sum, e) => sum + e.amount, 0)
  const hasExpenses = event.expenses.length > 0
  const todoCount = event.todos.length
  const boughtCount = event.todos.filter((t) => t.bought).length
  const payerOf = (id: string) => event.participants.find((p) => p.id === id)
  const isSettled = event.settledAt !== null

  /**
   * Sửa chi tiêu sau khi đã quyết toán xong sẽ xóa sạch đánh dấu Done —
   * hỏi trước thay vì âm thầm làm mất công người dùng.
   */
  function guardSettled(action: () => void, confirmLabel = 'Vẫn sửa') {
    if (isSettled) setConfirmReset({ run: action, confirmLabel })
    else action()
  }

  function openAdd() {
    guardSettled(() => {
      setEditing(null)
      setSheetOpen(true)
    })
  }

  function openEdit(expense: EventExpenseDTO) {
    guardSettled(() => {
      setEditing(expense)
      setSheetOpen(true)
    })
  }

  async function saveExpense(draft: ExpenseDraft): Promise<string | null> {
    const url = editing
      ? `/api/events/${shareId}/expenses/${editing.id}`
      : `/api/events/${shareId}/expenses`
    try {
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        return body?.error ?? 'Không lưu được. Thử lại nhé.'
      }
      // Sheet phải đóng SAU khi biết chắc đã lưu, nên chỗ này cố ý không
      // optimistic — xem docs/screens/03-event-detail.md §12.
      // Nhưng response đã chứa EventDTO mới nhất nên không GET lại (§11.1).
      const updated: EventDTO = await res.json()
      setSheetOpen(false)
      showToast(editing ? 'Đã lưu khoản chi' : 'Đã thêm khoản chi')
      await mutate(updated, { revalidate: false })
      return null
    } catch {
      return 'Không kết nối được máy chủ. Thử lại nhé.'
    }
  }

  async function deleteExpense(expenseId: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/events/${shareId}/expenses/${expenseId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) {
        const body = await res.json().catch(() => null)
        return body?.error ?? 'Không xóa được. Thử lại nhé.'
      }
      setSheetOpen(false)
      if (res.status === 404) {
        // Người khác vừa xóa trước — không có EventDTO trong response, phải nạp lại.
        showToast('Khoản chi này vừa bị xóa')
        await mutate()
      } else {
        const updated: EventDTO = await res.json()
        showToast('Đã xóa khoản chi')
        await mutate(updated, { revalidate: false })
      }
      return null
    } catch {
      return 'Không kết nối được máy chủ. Thử lại nhé.'
    }
  }

  // ---- Vuốt để xóa (§6.3.1) ----------------------------------------------
  //
  // Khác nút Xóa trong sheet: không có bước xác nhận, bù lại bằng toast hoàn
  // tác ngắn (UNDO_MS). Thẻ đã trượt khỏi màn rồi nên xóa optimistic luôn, đợi server
  // mới bỏ thẻ đi thì danh sách sẽ khựng lại một nhịp thấy rõ.
  function clearUndo() {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = null
    setUndoDraft(null)
  }

  async function swipeDelete(expense: EventExpenseDTO) {
    // Chỉ có MỘT đường hoàn tác tại một thời điểm — khoản mới vuốt thay chỗ
    // khoản cũ, không xếp hàng nhiều toast.
    clearUndo()

    const optimistic: EventDTO = {
      ...event,
      expenses: event.expenses.filter((e) => e.id !== expense.id),
    }

    const written = await optimisticWrite(mutate, optimistic, () =>
      fetch(`/api/events/${shareId}/expenses/${expense.id}`, { method: 'DELETE' })
    )

    if (!written.ok) {
      if (written.status === 404) {
        // Người khác vừa xóa trước. Trạng thái mong muốn đã đạt — nạp lại cho
        // khớp, và không mời hoàn tác thứ không phải mình xóa.
        showToast('Khoản chi này vừa bị xóa')
        await mutate()
        return
      }
      showToast(written.message)
      return
    }

    setUndoDraft({ title: expense.title, amount: expense.amount, payerId: expense.payerId })
    undoTimer.current = setTimeout(() => setUndoDraft(null), UNDO_MS)
  }

  /**
   * Hoàn tác = TẠO LẠI khoản chi, không phải khôi phục bản ghi cũ.
   * id mới, xuống cuối danh sách, dataVersion tăng thêm lần nữa, và đánh dấu
   * Done của cả nhóm thì không lấy lại được. Xem §6.3.1.
   */
  async function undoDelete(draft: ExpenseDraft) {
    clearUndo()
    try {
      const res = await fetch(`/api/events/${shareId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        showToast(body?.error ?? 'Không hoàn tác được.')
        return
      }
      const updated: EventDTO = await res.json()
      await mutate(updated, { revalidate: false })
      showToast('Đã hoàn tác')
    } catch {
      showToast('Không kết nối được máy chủ.')
    }
  }

  /** Xóa hẳn sự kiện: mọi người có link đều mất, không hoàn tác được. */
  async function deleteEvent() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/events/${shareId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) {
        showToast('Không xóa được. Thử lại nhé.')
        setDeleting(false)
        return
      }
      removeLocalEvent(shareId)
      router.push('/')
      router.refresh()
    } catch {
      showToast('Không kết nối được máy chủ.')
      setDeleting(false)
    }
  }

  /**
   * Chốt chặn đề phòng trước khi sang màn quyết toán.
   *
   * Với luật hiện tại điều này KHÔNG THỂ xảy ra: `amount` là `Int NOT NULL`,
   * zod chặn số thực và số ≤ 0, nên mọi khoản chi luôn có tiền hợp lệ.
   * Giữ chốt này để nếu sau này nới luật (cho phép nhập tiền sau) thì màn
   * quyết toán không bao giờ nhận dữ liệu thiếu — `lib/settlement.ts` sẽ ném
   * lỗi và làm vỡ trang thay vì tính sai.
   */
  function goToSettlement() {
    const invalid = event.expenses.find(
      (e) => !Number.isInteger(e.amount) || e.amount <= 0
    )

    if (invalid) {
      showToast('Khoản này chưa có số tiền — điền nốt rồi mới quyết toán được')
      setHighlightId(invalid.id)
      document
        .getElementById(`expense-${invalid.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => setHighlightId(null), 2600)
      return
    }

    router.push(`/e/${shareId}/settlement`)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/e/${shareId}`)
      showToast('Đã sao chép link')
    } catch {
      showToast('Trình duyệt không cho sao chép')
    }
  }

  const dateLabel = event.date.split('-').reverse().join('/')

  return (
    <>
      <main className="mx-auto w-full max-w-[430px] flex-1 pb-[130px]">
        <header className="px-5 pt-[54px]">
          <Link
            href="/"
            className="-ml-1 inline-flex h-11 items-center rounded-[14px] px-1 text-[13.5px] font-bold text-muted transition-colors hover:text-ink"
          >
            ← Sự kiện của tôi
          </Link>

          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-display text-[26px] leading-[1.15] font-extrabold text-ink">
                {event.name}
              </h1>
              <p className="mt-0.5 text-[12.5px] text-faint">
                {dateLabel} · {event.participants.length} người
                {isSettled && (
                  <span className="ml-2 rounded-full bg-success-badge px-2 py-0.5 text-[10.5px] font-extrabold text-success-text">
                    Đã xong
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={copyLink}
                aria-label="Sao chép link chia sẻ"
                className="h-11 rounded-full bg-primary-soft px-3.5 text-[12.5px] font-extrabold whitespace-nowrap text-primary-text transition-colors hover:bg-primary-badge"
              >
                🔗 Link
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Tùy chọn sự kiện"
                className="flex h-11 w-11 items-center justify-center rounded-full text-[18px] leading-none font-extrabold text-muted transition-colors hover:bg-cream-deep hover:text-ink"
              >
                ⋯
              </button>
            </div>
          </div>

          {/* Hàng nhân vật */}
          <ul className="mt-4 flex flex-wrap gap-1">
            {event.participants.map((p) => (
              <li key={p.id} className="w-[74px] text-center">
                <CharacterAvatar characterId={p.characterId} size={44} className="mx-auto" />
                <span className="mt-1 block truncate px-0.5 text-[11.5px] leading-[1.2] font-bold text-ink">
                  {p.name}
                </span>
              </li>
            ))}
          </ul>
        </header>

        {/* Tab bar — segmented control ngay dưới avatar strip */}
        <div className="mt-4 flex gap-1.5 rounded-[16px] bg-[#F4EDE5] p-1 mx-5">
          {(
            [
              ['todo', 'Cần chi', boughtCount > 0 || todoCount > 0 ? `${boughtCount}/${todoCount}` : ''],
              ['paid', 'Đã chi', event.expenses.length > 0 ? String(event.expenses.length) : ''],
            ] as const
          ).map(([value, label, counter]) => {
            const active = tab === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-pressed={active}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[13px] text-[14px] font-extrabold transition-colors ${
                  active
                    ? 'bg-surface text-ink shadow-[0_2px_6px_-2px_rgba(46,42,59,.22)]'
                    : 'bg-transparent text-[#9A8E82]'
                }`}
              >
                {label}
                {counter && <span className="text-[12px] font-extrabold opacity-60">{counter}</span>}
              </button>
            )
          })}
        </div>

        {tab === 'todo' && (
          <TodoList shareId={shareId} event={event} write={mutate} />
        )}

        {tab === 'paid' && (
          <>
        {/* Tổng chi tiêu — dính trên đầu khi cuộn */}
        <div className="sticky top-0 z-10 mt-4 flex items-center justify-between gap-3 bg-gradient-to-r from-[#2E2A3B] to-[#463E5C] px-5 py-3.5">
          <span className="shrink-0 text-[10px] font-extrabold tracking-[.07em] whitespace-nowrap text-white/70 uppercase">
            Tổng chi tiêu
          </span>
          <span className="font-display text-[30px] leading-none font-extrabold text-warning">
            {formatYen(total)}
          </span>
        </div>

        <div className="px-5 pt-4">
          {event.expenses.length === 0 ? (
            <p className="rounded-[20px] border-2 border-dashed border-[#EFE0D3] px-4 py-8 text-center text-[13.5px] text-on-cream">
              Chưa có khoản chi nào.
              <br />
              Thêm khoản đầu tiên nhé!
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {event.expenses.map((expense, index) => {
                const payer = payerOf(expense.payerId)
                return (
                  <li key={expense.id} id={`expense-${expense.id}`}>
                    {/* Vuốt ngang để xóa — §6.3.1. Sự kiện đã quyết toán thì
                        thẻ bật về chỗ cũ và hỏi trước, y như khi tap để sửa. */}
                    <SwipeToDelete
                      onDelete={() =>
                        guardSettled(() => void swipeDelete(expense), 'Vẫn xóa')
                      }
                    >
                    <button
                      type="button"
                      onClick={() => openEdit(expense)}
                      className={`animate-wk-rise block w-full rounded-[18px] border bg-surface px-3.5 py-3 text-left shadow-[0_2px_0_var(--color-shadow-flat)] transition-colors ${
                        highlightId === expense.id
                          ? 'border-danger ring-2 ring-danger-border'
                          : 'border-border-card hover:border-primary-border'
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        {/* STT sinh lại lúc render, luôn liên tục sau khi xóa dòng */}
                        <span className="shrink-0 text-[12px] font-bold text-faintest">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[16px] font-bold text-ink">
                          {expense.title}
                        </span>
                        <span className="shrink-0 font-display text-[18px] font-extrabold text-ink">
                          {formatYen(expense.amount)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 pl-5">
                        {payer && <CharacterAvatar characterId={payer.characterId} size={24} />}
                        <span className="truncate text-[12.5px] text-muted">
                          {payer ? `${payer.name} đã chi` : 'Không rõ người chi'}
                        </span>
                      </div>
                    </button>
                    </SwipeToDelete>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Chưa có khoản chi nào → nút thêm nằm ngay dưới khung rỗng.
              Có rồi → nó chuyển xuống hàng CTA đáy màn, xem §6.5.
              Cố ý chỉ có ĐÚNG MỘT lối thêm tại mỗi thời điểm. */}
          {!hasExpenses && (
            <button
              type="button"
              onClick={openAdd}
              className="mt-3 h-[50px] w-full rounded-[16px] border-2 border-dashed border-success-border bg-success-soft text-[15px] font-extrabold text-success-text transition-colors hover:bg-success-badge"
            >
              ＋ Thêm khoản chi
            </button>
          )}
        </div>
          </>
        )}
      </main>

      {/* CTA cố định đáy màn — CHỈ ở tab "Đã chi".
          Handoff ghi là hiện ở cả hai tab; chủ dự án chốt lại chỉ tab này,
          xem docs/screens/03-event-detail.md §7. */}
      {tab === 'paid' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-cream via-cream/95 to-transparent pt-8 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto w-full max-w-[430px] px-5">
            {!hasExpenses && (
              <p className="mb-1.5 text-center text-[12px] text-faint">
                Thêm ít nhất một khoản chi để quyết toán.
              </p>
            )}
            {/* Đã có khoản chi → hai nút chia đôi hàng. Chữ nhỏ hơn và nowrap
                để "Xem quyết toán →" không vỡ ở bề ngang 320px. */}
            <div className="flex gap-2">
              {hasExpenses && (
                <button
                  type="button"
                  onClick={openAdd}
                  className="h-[54px] min-w-0 flex-1 rounded-[18px] border-2 border-dashed border-success-border bg-success-soft text-[14px] font-extrabold whitespace-nowrap text-success-text transition-colors hover:bg-success-badge"
                >
                  ＋ Thêm khoản chi
                </button>
              )}
              <button
                type="button"
                onClick={goToSettlement}
                disabled={!hasExpenses}
                className={`h-[54px] min-w-0 flex-1 rounded-[18px] bg-success font-extrabold whitespace-nowrap text-white shadow-[0_8px_18px_-6px_rgba(47,191,155,.6)] transition-colors hover:bg-success-hover disabled:bg-disabled disabled:shadow-none ${
                  hasExpenses ? 'text-[14px]' : 'text-[17px]'
                }`}
              >
                {isSettled ? 'Xem quyết toán →' : 'Quyết toán →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <ExpenseSheet
          participants={event.participants}
          editing={editing}
          onClose={() => setSheetOpen(false)}
          onSave={saveExpense}
          onDelete={deleteExpense}
        />
      )}

      {/* Menu ⋯ — lối vào duy nhất tới Sửa và Xóa hẳn.
          Xem docs/screens/03-event-detail.md §3.1 */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-[rgba(46,42,59,.42)]"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="animate-wk-rise relative w-full max-w-[430px] rounded-t-[28px] bg-surface px-5 pt-3 pb-[max(26px,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto h-1 w-11 rounded-full bg-[#EDE6DE]" />
            <Link
              href={`/e/${shareId}/edit`}
              className="mt-4 flex h-[52px] w-full items-center rounded-[16px] px-4 text-[15px] font-bold text-ink transition-colors hover:bg-cream-deep"
            >
              Sửa sự kiện
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setConfirmDelete(true)
              }}
              className="flex h-[52px] w-full items-center rounded-[16px] px-4 text-[15px] font-bold text-danger-text transition-colors hover:bg-danger-softer"
            >
              Xóa hẳn sự kiện
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="mt-2 h-[50px] w-full rounded-[16px] bg-cream-deep text-[15px] font-extrabold text-muted"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Xác nhận xóa hẳn — nêu rõ hệ quả với TẤT CẢ mọi người, không hoàn tác */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button
            type="button"
            aria-label="Hủy"
            onClick={() => setConfirmDelete(false)}
            className="absolute inset-0 bg-[rgba(46,42,59,.42)]"
          />
          <div className="animate-wk-pop relative w-full max-w-[340px] rounded-[22px] bg-surface p-5">
            <h2 className="font-display text-[19px] leading-snug font-extrabold text-ink text-center">
              Xóa hẳn &quot;{event.name}&quot;?
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted text-center">
              Toàn bộ khoản chi và kết quả quyết toán sẽ bị xóa. Link chia sẻ sẽ không dùng được
              nữa với <strong className="font-extrabold text-ink">tất cả mọi người</strong>. Không
              thể hoàn tác.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="h-11 flex-1 rounded-[14px] bg-cream-deep text-[14px] font-extrabold text-muted"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void deleteEvent()}
                disabled={deleting}
                className="h-11 flex-1 rounded-[14px] bg-danger text-[14px] font-extrabold text-white transition-colors hover:bg-danger-strong disabled:bg-disabled"
              >
                {deleting ? 'Đang xóa...' : 'Xóa hẳn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cảnh báo trước khi làm mất kết quả quyết toán đã xong */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button
            type="button"
            aria-label="Hủy"
            onClick={() => setConfirmReset(null)}
            className="absolute inset-0 bg-[rgba(46,42,59,.42)]"
          />
          <div className="animate-wk-pop relative w-full max-w-[340px] rounded-[22px] bg-surface p-5">
            <h2 className="font-display text-[19px] font-extrabold text-ink text-center">
              Kết quả quyết toán sẽ được tính lại
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted text-center">
              Toàn bộ đánh dấu &quot;Done&quot; hiện có sẽ bị xóa.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(null)}
                className="h-11 flex-1 rounded-[14px] bg-cream-deep text-[14px] font-extrabold text-muted"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const { run } = confirmReset
                  setConfirmReset(null)
                  run()
                }}
                className="h-11 flex-1 rounded-[14px] bg-primary text-[14px] font-extrabold text-white"
              >
                {confirmReset.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="animate-wk-rise pointer-events-none fixed inset-x-5 bottom-24 z-50 mx-auto max-w-[390px] rounded-[16px] bg-dark px-4 py-3 text-center text-[13.5px] font-bold text-white">
          {toast}
        </div>
      )}

      {/* Toast hoàn tác — khác toast thường: có nút bấm nên phải nhận sự kiện. */}
      {undoDraft && (
        <div className="animate-wk-rise fixed inset-x-5 bottom-24 z-50 mx-auto flex max-w-[390px] items-center gap-3 rounded-[16px] bg-dark py-2.5 pr-2.5 pl-4">
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-white">
            Đã xóa &quot;{undoDraft.title}&quot;
          </span>
          <button
            type="button"
            onClick={() => void undoDelete(undoDraft)}
            className="h-9 shrink-0 rounded-[12px] px-3 text-[13.5px] font-extrabold text-warning transition-colors hover:bg-white/10"
          >
            Hoàn tác
          </button>
        </div>
      )}

      {/* Chỉ báo rất nhẹ khi đang đồng bộ nền, không chắn nội dung */}
      {isValidating && (
        <span className="pointer-events-none fixed top-2 right-3 z-50 text-[10px] font-bold text-faintest">
          đang đồng bộ…
        </span>
      )}
    </>
  )
}
