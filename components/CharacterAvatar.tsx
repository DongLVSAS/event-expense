import Image from 'next/image'
import { getCharacter } from '@/lib/characters'

// Hộp tròn nền pastel, nhân vật đứng chạm đáy hộp.
// Quy cách hiển thị theo docs/design_handoff/README.md mục "Assets":
// aspect-ratio 1, object-fit contain, object-position center bottom, ảnh 104%.

type Props = {
  characterId: string
  /** Đường kính hộp tròn, px. Handoff dùng 56 ở màn tạo, 44 ở avatar strip, 24–34 trong list. */
  size: number
  className?: string
}

export function CharacterAvatar({ characterId, size, className = '' }: Props) {
  const character = getCharacter(characterId)

  // characterId lạ (dữ liệu cũ, hoặc DB bị sửa tay) — hiện hộp trống thay vì vỡ trang.
  if (!character) {
    return (
      <span
        aria-hidden
        className={`inline-block shrink-0 rounded-full bg-faintest ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size, backgroundColor: character.bg }}
    >
      <Image
        src={character.src}
        alt=""
        width={size * 2}
        height={size * 2}
        // 104% + căn đáy: nhân vật "đứng" trên mép dưới hộp thay vì lơ lửng giữa.
        className="absolute bottom-0 left-1/2 h-[104%] w-[104%] max-w-none -translate-x-1/2 object-contain object-bottom"
        // Ảnh trang trí, tên người đã hiện ngay dưới chân — không cần đọc lại cho screen reader.
        aria-hidden
      />
    </span>
  )
}
