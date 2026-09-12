// Danh sách nhân vật — nguồn: docs/design_handoff/README.md mục "Assets".
// Đây là NƠI DUY NHẤT khai báo nhân vật; mọi màn đọc từ đây, không hardcode rải rác.
//
// Ảnh gốc nằm ở docs/design_handoff/assets/, đã copy sang public/characters/.
// PNG 1024×1024, nền trong suốt. Hiển thị trong hộp tròn aspect-ratio 1,
// nền pastel riêng từng con, ảnh object-fit:contain; object-position:center bottom.

export type Character = {
  /** Khớp với Participant.characterId trong DB. Không đổi giá trị này về sau. */
  id: string
  /** Đường dẫn public, dùng trực tiếp cho next/image. */
  src: string
  /** Màu nền pastel của hộp tròn, theo bảng trong design_handoff. */
  bg: string
}

export const CHARACTERS: readonly Character[] = [
  { id: 'cat', src: '/characters/cat.png', bg: '#FFE6CC' },
  { id: 'bunny', src: '/characters/bunny.png', bg: '#FFE1EA' },
  { id: 'frog', src: '/characters/frog.png', bg: '#DBF5E4' },
  { id: 'penguin', src: '/characters/penguin.png', bg: '#DCEBFF' },
  { id: 'bear', src: '/characters/bear.png', bg: '#F0E2D4' },
  { id: 'pig', src: '/characters/pig.png', bg: '#FFE3EE' },
  { id: 'panda', src: '/characters/panda.png', bg: '#ECECF2' },
  { id: 'koala', src: '/characters/koala.png', bg: '#E6EAF0' },
  { id: 'fox', src: '/characters/fox.png', bg: '#FFE0CE' },
  { id: 'puppy', src: '/characters/puppy.png', bg: '#F7E9D8' },
] as const

/**
 * Trần số người trong một sự kiện = số nhân vật có sẵn.
 * Nhân vật không bao giờ trùng nhau trong cùng một sự kiện, nên hai con số này
 * buộc phải bằng nhau. Xem docs/screens/02-event-form.md §5.2.
 */
export const MAX_PARTICIPANTS = CHARACTERS.length

const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]))

export function getCharacter(id: string): Character | undefined {
  return BY_ID.get(id)
}

/** Các nhân vật chưa bị dùng trong sự kiện. */
export function availableCharacters(usedIds: readonly string[]): Character[] {
  const used = new Set(usedIds)
  return CHARACTERS.filter((c) => !used.has(c.id))
}

/**
 * Chọn ngẫu nhiên một nhân vật chưa dùng. Trả về `undefined` khi đã hết —
 * gọi bên ngoài phải xử lý, không được im lặng gán trùng.
 */
export function pickRandomCharacter(usedIds: readonly string[]): Character | undefined {
  const pool = availableCharacters(usedIds)
  if (pool.length === 0) return undefined
  return pool[Math.floor(Math.random() * pool.length)]
}
