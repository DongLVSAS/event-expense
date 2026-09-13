'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// Vuốt ngang một thẻ để xóa — dùng ở tab "Đã chi" của màn 03.
// Nghiệp vụ: docs/screens/03-event-detail.md §6.3.1
// Giao diện: docs/design_handoff/README.md mục "3. Event detail"
//
// Không dùng thư viện: chỉ Pointer Events + transform, đủ cho một cử chỉ.
//
// Nền danger nằm DƯỚI thẻ và lộ ra ở khoảng trống thẻ để lại — vuốt sang trái
// thì hở bên phải, và ngược lại. Đây là kiểu lộ-ra quen thuộc của iOS/Android.

/** Vuốt quá bao nhiêu phần bề ngang thẻ thì thả tay là xóa. */
const THRESHOLD_RATIO = 0.35
/** Đi quá ngần này pixel mới coi là đang kéo, dưới đó vẫn là một cú tap. */
const SLOP = 8
/** Khớp với thời lượng transition bên dưới. */
const LEAVE_MS = 180

type Props = {
  children: ReactNode
  /** Gọi khi người dùng vuốt qua ngưỡng rồi thả tay. */
  onDelete: () => void
  /** Tắt cử chỉ (ví dụ đang mở dialog đè lên). */
  disabled?: boolean
}

export function SwipeToDelete({ children, onDelete, disabled = false }: Props) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState<-1 | 1 | null>(null)

  const [width, setWidth] = useState(0)

  const startX = useRef(0)
  const startY = useRef(0)
  /** null = chưa biết người dùng định kéo ngang hay cuộn dọc. */
  const axis = useRef<'x' | 'y' | null>(null)
  /** Đã kéo thật sự → nuốt cú click kế tiếp để không mở sheet sửa. */
  const dragged = useRef(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    }
  }, [])

  const threshold = width * THRESHOLD_RATIO
  const past = width > 0 && Math.abs(dx) >= threshold

  function reset() {
    axis.current = null
    setDragging(false)
    setDx(0)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || leaving !== null) return
    // Chuột phải / chuột giữa không tính.
    if (e.pointerType === 'mouse' && e.button !== 0) return
    setWidth(e.currentTarget.offsetWidth)
    startX.current = e.clientX
    startY.current = e.clientY
    axis.current = null
    dragged.current = false
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || disabled || leaving !== null) return

    const deltaX = e.clientX - startX.current
    const deltaY = e.clientY - startY.current

    if (axis.current === null) {
      if (Math.abs(deltaX) < SLOP && Math.abs(deltaY) < SLOP) return
      // Nghiêng về dọc → nhường cho trình duyệt cuộn, bỏ hẳn cử chỉ này.
      axis.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
      if (axis.current === 'y') {
        setDragging(false)
        return
      }
      // Giữ chuỗi sự kiện lại kể cả khi con trỏ rời khỏi thẻ.
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    if (axis.current !== 'x') return

    dragged.current = true
    setDx(deltaX)
  }

  function onPointerUp() {
    if (!dragging || leaving !== null) return

    if (axis.current === 'x' && width > 0 && Math.abs(dx) >= threshold) {
      const dir: -1 | 1 = dx < 0 ? -1 : 1
      setDragging(false)
      setLeaving(dir)
      // Cho thẻ trượt hết ra ngoài rồi mới báo lên trên, để danh sách không
      // giật mất một hàng ngay giữa chừng animation.
      leaveTimer.current = setTimeout(onDelete, LEAVE_MS)
      return
    }

    reset()
  }

  // Vuốt rồi thì cú click sinh ra sau đó không được mở sheet sửa.
  function onClickCapture(e: React.MouseEvent) {
    if (!dragged.current) return
    e.preventDefault()
    e.stopPropagation()
    dragged.current = false
  }

  const translate = leaving !== null ? `${leaving * 110}%` : `${dx}px`
  const iconOnRight = leaving !== null ? leaving < 0 : dx < 0

  return (
    <div
      className="relative overflow-hidden rounded-[18px]"
      // Cuộn dọc vẫn do trình duyệt lo; chỉ chiều ngang là của chúng ta.
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={reset}
      onClickCapture={onClickCapture}
    >
      {/* Nền xóa — nằm dưới thẻ, chỉ thấy phần thẻ đã trượt khỏi. */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 flex items-center rounded-[18px] transition-colors ${
          iconOnRight ? 'justify-end' : 'justify-start'
        } ${past ? 'bg-[#E11D48]' : 'bg-[#FF5A6E]'}`}
      >
        <span
          className="px-[18px] text-[22px] leading-none text-white transition-all duration-150"
          style={{
            // Mờ và nhỏ lúc mới kéo, rõ dần tới ngưỡng — để người dùng thấy
            // được mình đã đi gần tới chỗ "thả ra là mất" chưa.
            opacity: width > 0 ? Math.min(1, 0.45 + (Math.abs(dx) / (width * THRESHOLD_RATIO)) * 0.55) : 0,
            transform: `scale(${width > 0 ? Math.min(1, 0.8 + (Math.abs(dx) / (width * THRESHOLD_RATIO)) * 0.2) : 0.8})`,
          }}
        >
          🗑
        </span>
      </div>

      <div
        style={{
          transform: `translateX(${translate})`,
          // Đang kéo thì bám tay, không transition. Thả ra mới có animation.
          transition:
            leaving !== null
              ? `transform ${LEAVE_MS}ms ease-in`
              : dragging
                ? 'none'
                : 'transform 180ms cubic-bezier(.22,1,.36,1)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
