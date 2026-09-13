'use client'

import { useRef, useState } from 'react'
import type { EventDTO, EventTodoDTO } from '@/lib/event-dto'
import { optimisticWrite } from '@/lib/optimistic'

// Tab "Cần chi" — checklist món cần mua.
// Nghiệp vụ: docs/screens/03-event-detail.md §5
// Giao diện: docs/design_handoff/README.md mục "3. Event detail" → Tab 1
//
// Không có số tiền, không có người chi, không đụng tới quyết toán.

const TEMP_PREFIX = 'tmp-'
const SAVING_MSG = 'Món này đang được lưu, thử lại sau một giây.'

type Props = {
  shareId: string
  /** Sự kiện hiện tại — cần nguyên bản để dựng ảnh optimistic. */
  event: EventDTO
  /** `mutate` của SWR cho key sự kiện. */
  write: Parameters<typeof optimisticWrite>[0]
}

export function TodoList({ shareId, event, write }: Props) {
  const todos = event.todos
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Món vừa thêm chưa có id thật. Dùng id tạm để React có key ổn định cho tới
  // khi server trả về — spec §12: vẽ ngay, không đợi mạng.
  const tempId = () => `${TEMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const isPending = (id: string) => id.startsWith(TEMP_PREFIX)

  async function addTodo() {
    const title = input.trim()
    // Chuỗi rỗng: bỏ qua im lặng. Đây là ghi chú nhanh, không phải form.
    if (!title) return

    // Xóa ô nhập ngay để gõ tiếp món sau — không đợi server.
    setInput('')
    setError('')
    inputRef.current?.focus()

    const sortOrder = todos.reduce((max, t) => Math.max(max, t.sortOrder), -1) + 1
    const optimistic: EventDTO = {
      ...event,
      todos: [...todos, { id: tempId(), title, bought: false, sortOrder }],
    }

    const result = await optimisticWrite(write, optimistic, () =>
      fetch(`/api/events/${shareId}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
    )
    if (!result.ok) {
      setError(result.message)
      // Trả lại chữ đã gõ để người dùng không phải nhập lại.
      setInput((current) => (current === '' ? title : current))
    }
  }

  async function toggleBought(todo: EventTodoDTO) {
    // Món vừa thêm chưa có id thật cho tới khi server trả lời. Gửi id tạm lên
    // sẽ nhận 404 rồi rollback — thà báo một câu rõ ràng.
    if (isPending(todo.id)) return setError(SAVING_MSG)
    setError('')

    const optimistic: EventDTO = {
      ...event,
      todos: todos.map((t) => (t.id === todo.id ? { ...t, bought: !t.bought } : t)),
    }

    const result = await optimisticWrite(
      write,
      optimistic,
      () =>
        fetch(`/api/events/${shareId}/todos/${todo.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bought: !todo.bought }),
        }),
      'Món này vừa bị người khác xóa.'
    )
    if (!result.ok) setError(result.message)
  }

  async function removeTodo(todoId: string) {
    if (isPending(todoId)) return setError(SAVING_MSG)
    setError('')

    const optimistic: EventDTO = {
      ...event,
      todos: todos.filter((t) => t.id !== todoId),
    }

    const result = await optimisticWrite(
      write,
      optimistic,
      () => fetch(`/api/events/${shareId}/todos/${todoId}`, { method: 'DELETE' }),
      'Món này vừa bị người khác xóa.'
    )
    // Người khác xóa trước: trạng thái mong muốn đã đạt, không cần báo lỗi.
    if (!result.ok && result.status !== 404) setError(result.message)
  }

  return (
    <div className="px-5 pt-4">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void addTodo()
            }
          }}
          maxLength={120}
          placeholder="VD: Than nướng, đá lạnh…"
          className="h-[50px] min-w-0 flex-1 rounded-[16px] border-[1.5px] border-border-input bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-faintest focus:border-primary"
        />
        <button
          type="button"
          onClick={() => void addTodo()}
          disabled={!input.trim()}
          aria-label="Thêm món cần mua"
          className="h-[50px] w-[50px] shrink-0 rounded-[16px] bg-success text-[22px] leading-none font-extrabold text-white transition-colors hover:bg-success-hover disabled:bg-disabled"
        >
          ＋
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2.5 rounded-[14px] bg-danger-soft px-3 py-2.5 text-[13px] font-semibold text-danger-text">
          {error}
        </p>
      )}

      {todos.length === 0 ? (
        <p className="mt-3 rounded-[20px] border-2 border-dashed border-[#EFE0D3] px-4 py-8 text-center text-[13.5px] leading-relaxed text-on-cream">
          Chưa có gì trong danh sách cần chi.
          <br />
          Ghi trước những món cần mua, tick khi đã mua xong.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className={`animate-wk-rise flex items-center gap-2.5 rounded-[18px] border px-3 py-2.5 transition-colors ${
                todo.bought
                  ? 'border-[#BDE6CE] bg-[#E8F8EF] shadow-[0_2px_0_#D6EFE0]'
                  : 'border-border-card bg-surface shadow-[0_2px_0_var(--color-shadow-flat)]'
              }`}
            >
              <button
                type="button"
                onClick={() => void toggleBought(todo)}
                aria-pressed={todo.bought}
                aria-label={todo.bought ? `Bỏ đánh dấu đã mua ${todo.title}` : `Đánh dấu đã mua ${todo.title}`}
                // Ô tick thấy được là 30px theo handoff; vùng chạm phủ 44px bằng
                // pseudo-element để vẫn đạt chuẩn tối thiểu.
                className={`relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] border-2 text-[15px] leading-none font-extrabold transition-colors before:absolute before:-inset-[7px] before:content-[''] ${
                  todo.bought
                    ? 'border-[#17A673] bg-[#17A673] text-white'
                    : 'border-[#E3D9CE] bg-surface text-transparent'
                }`}
              >
                ✓
              </button>

              <span
                className={`min-w-0 flex-1 truncate text-[15.5px] font-bold ${
                  todo.bought ? 'text-[#17805C] line-through' : 'text-ink'
                }`}
                title={todo.title}
              >
                {todo.title}
              </span>

              {todo.bought && (
                <span className="shrink-0 rounded-full bg-success-badge px-2 py-0.5 text-[10.5px] font-extrabold text-success-text">
                  Đã mua
                </span>
              )}

              <button
                type="button"
                onClick={() => void removeTodo(todo.id)}
                aria-label={`Xóa ${todo.title}`}
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-faint transition-colors hover:bg-danger-soft hover:text-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[12.5px] leading-relaxed text-fainter">
        Danh sách này chỉ để nhắc nhau cần mua gì — số tiền ghi ở tab &quot;Đã chi&quot;.
      </p>
    </div>
  )
}
