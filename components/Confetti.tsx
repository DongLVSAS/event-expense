// Pháo hoa mừng quyết toán xong — KHÔNG dùng thư viện.
// Handoff chốt: @keyframes wk-fall, 60 hạt, mỗi hạt 2.2–4s linear,
// delay ngẫu nhiên 0–1.2s, tổng phủ màn 4.2s.
// Xem docs/design_handoff/README.md mục Animation + docs/screens/04-settlement.md §5.2.

const COLORS = ['#FF6B4A', '#FFD166', '#2FBF9B', '#8AB6FF', '#FF8FA3', '#C9A7FF']
const COUNT = 60

/**
 * Giả ngẫu nhiên TẤT ĐỊNH theo chỉ số hạt.
 *
 * Không dùng Math.random() vì hai lý do: nó là hàm bất thuần nên không được gọi
 * lúc render, và giá trị sẽ lệch giữa server với client gây hydration mismatch.
 * Băm từ chỉ số cho ra cùng bố cục ở cả hai phía mà mắt vẫn thấy ngẫu nhiên.
 */
function pseudoRandom(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

const PIECES = Array.from({ length: COUNT }, (_, i) => ({
  left: pseudoRandom(i, 1) * 100,
  color: COLORS[i % COLORS.length],
  delay: pseudoRandom(i, 2) * 1.2,
  duration: 2.2 + pseudoRandom(i, 3) * 1.8,
  size: 6 + pseudoRandom(i, 4) * 6,
  round: pseudoRandom(i, 5) > 0.5,
}))

export function Confetti() {
  return (
    // aria-hidden: thuần trang trí, dòng chúc mừng mới là nội dung thật.
    // prefers-reduced-motion xử lý ở globals.css — hạt sẽ đứng yên.
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            backgroundColor: p.color,
            borderRadius: p.round ? '999px' : '2px',
            animation: `wk-fall ${p.duration}s linear ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  )
}
