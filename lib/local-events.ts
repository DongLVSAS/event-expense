// Danh sách sự kiện của MÁY NÀY — không có tài khoản nên không có danh sách phía server.
// File client-only: chỉ gọi từ component có 'use client' hoặc trong useEffect.
//
// localStorage có thể ném lỗi (private mode, site data bị chặn) nên mọi truy cập
// đều bọc try/catch. Hỏng storage thì app vẫn chạy, chỉ là màn Home trống —
// xem docs/screens/01-home.md §7.

const KEY = 'warikan.events.v1'

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Lọc rác: chỉ giữ chuỗi không rỗng, khử trùng lặp.
    return [...new Set(parsed.filter((x): x is string => typeof x === 'string' && x.length > 0))]
  } catch {
    return []
  }
}

function write(ids: string[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
    emit()
    return true
  } catch {
    return false
  }
}

// ---- Bộ nhớ đệm cho useSyncExternalStore ----
//
// React yêu cầu getSnapshot trả về CÙNG MỘT tham chiếu khi dữ liệu không đổi,
// nếu không sẽ render vô hạn. Nên phải cache theo chuỗi JSON thô.
//
// Sự kiện 'storage' của trình duyệt chỉ bắn cho TAB KHÁC, nên tab hiện tại
// phải tự phát tín hiệu sau mỗi lần ghi — đó là việc của emit().

const EMPTY: string[] = []
let cachedRaw: string | null = null
let cachedIds: string[] = EMPTY
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function subscribeLocalEvents(onChange: () => void): () => void {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function getLocalEventIdsSnapshot(): string[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return EMPTY
  }
  if (raw === cachedRaw) return cachedIds
  cachedRaw = raw
  cachedIds = read()
  return cachedIds
}

/** Trên server không có localStorage — luôn rỗng, và phải là tham chiếu cố định. */
export function getLocalEventIdsServerSnapshot(): string[] {
  return EMPTY
}

/** Các shareId máy này đã tạo hoặc đã mở. Mới nhất đứng đầu. */
export function getLocalEventIds(): string[] {
  return read()
}

/**
 * Thêm một shareId vào đầu danh sách. Gọi khi tạo sự kiện, và khi mở link
 * chia sẻ lần đầu trên máy này.
 * Trả về false nếu localStorage không ghi được — nơi gọi nên cảnh báo người dùng
 * lưu lại link, vì máy này sẽ không nhớ.
 */
export function addLocalEvent(shareId: string): boolean {
  const ids = read().filter((id) => id !== shareId)
  return write([shareId, ...ids])
}

/** Gỡ khỏi máy này. KHÔNG xóa sự kiện trên server — ai có link vẫn mở được. */
export function removeLocalEvent(shareId: string): boolean {
  return write(read().filter((id) => id !== shareId))
}

/** Kiểm tra localStorage có dùng được không, để hiện cảnh báo đúng lúc. */
export function isLocalStorageAvailable(): boolean {
  try {
    const probe = '__warikan_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}
