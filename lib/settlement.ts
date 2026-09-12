/**
 * LÕI NGHIỆP VỤ — thuật toán quyết toán.
 *
 * Nguồn: docs/warikan-app-prompt.md mục 5 · docs/screens/04-settlement.md ·
 *        docs/design_handoff/README.md mục "Thuật toán quyết toán".
 *
 * KHÔNG sửa thuật toán trong file này mà không báo chủ dự án trước.
 *
 * File này là PURE FUNCTION: không import Prisma, không gọi API, không đọc
 * Date.now() hay Math.random() ở luồng tính toán. Cùng input luôn cho cùng output,
 * kể cả thứ tự các giao dịch — đó là điều kiện để `transferKey` ổn định giữa các
 * lần tính lại, vì nó được dùng làm khóa lưu trạng thái Done trong DB.
 *
 * Toàn bộ số liệu là SỐ NGUYÊN (JPY). Không dùng số thực ở bất kỳ khâu nào.
 */

export type SettlementParticipant = {
  id: string
  /** Tie-break tất định cho mọi phép sắp xếp. Tăng dần theo thứ tự tham gia. */
  sortOrder: number
}

export type SettlementExpense = {
  /** JPY, số nguyên > 0. */
  amount: number
  /** Phải là id của một người trong `participants`. */
  payerId: string
}

export type Balance = {
  participantId: string
  sortOrder: number
  /** Tổng tiền người này đã chi ra. */
  paid: number
  /** Suất người này phải gánh. */
  share: number
  /** `paid - share`. Dương = nhận về, âm = cần trả, 0 = không nhận không trả. */
  balance: number
}

export type Transfer = {
  fromId: string
  toId: string
  /** JPY, luôn > 0. */
  amount: number
  /** `"{fromId}:{toId}"` — khóa lưu trạng thái Done trong DB. */
  transferKey: string
}

export type SettlementResult = {
  /** Tổng tất cả khoản chi. */
  total: number
  /** Sắp theo `sortOrder` tăng dần. Muốn thứ tự hiển thị, dùng `sortBalancesForDisplay`. */
  balances: Balance[]
  /** Thứ tự do thuật toán quyết định — KHÔNG sắp xếp lại ở tầng UI. */
  transfers: Transfer[]
}

/** Khóa định danh một giao dịch. Dùng hàm này ở mọi nơi thay vì tự nối chuỗi. */
export function transferKeyOf(fromId: string, toId: string): string {
  return `${fromId}:${toId}`
}

export function settle(
  participants: readonly SettlementParticipant[],
  expenses: readonly SettlementExpense[]
): SettlementResult {
  const n = participants.length
  if (n === 0) {
    throw new Error('settle(): cần ít nhất một người tham gia.')
  }

  const paid = new Map<string, number>()
  for (const p of participants) {
    if (paid.has(p.id)) {
      throw new Error(`settle(): trùng id người tham gia: ${p.id}`)
    }
    paid.set(p.id, 0)
  }

  // Bước 0 — cộng dồn số tiền mỗi người đã chi.
  let total = 0
  for (const e of expenses) {
    if (!Number.isInteger(e.amount)) {
      throw new Error(`settle(): số tiền phải là số nguyên, nhận được ${e.amount}`)
    }
    if (e.amount <= 0) {
      throw new Error(`settle(): số tiền phải lớn hơn 0, nhận được ${e.amount}`)
    }
    const current = paid.get(e.payerId)
    if (current === undefined) {
      throw new Error(`settle(): khoản chi trỏ tới payerId không có trong danh sách: ${e.payerId}`)
    }
    paid.set(e.payerId, current + e.amount)
    total += e.amount
  }

  // Bước 1 — suất phải gánh, xử lý tiền lẻ.
  // Cộng thêm 1¥ cho đúng `remainder` người, xét theo paid giảm dần
  // (tie-break sortOrder tăng dần) → người đã chi nhiều nhất gánh phần lẻ.
  // Cách này khiến Σ share === total chính xác, bảng tự cân, không cần bù trừ.
  const base = Math.floor(total / n)
  const remainder = total - base * n // 0 <= remainder < n

  const byPaidDesc = [...participants].sort((a, b) => {
    const diff = paid.get(b.id)! - paid.get(a.id)!
    if (diff !== 0) return diff
    return a.sortOrder - b.sortOrder
  })

  const share = new Map<string, number>()
  for (const p of participants) share.set(p.id, base)
  for (let i = 0; i < remainder; i++) {
    const p = byPaidDesc[i]
    share.set(p.id, share.get(p.id)! + 1)
  }

  // Bước 2 — số dư.
  const balances: Balance[] = [...participants]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => {
      const paidAmount = paid.get(p.id)!
      const shareAmount = share.get(p.id)!
      return {
        participantId: p.id,
        sortOrder: p.sortOrder,
        paid: paidAmount,
        share: shareAmount,
        balance: paidAmount - shareAmount,
      }
    })

  return { total, balances, transfers: matchTransfers(balances) }
}

/**
 * Bước 3 — ghép giao dịch bằng greedy: chủ nợ lớn nhất với con nợ lớn nhất.
 * Mỗi vòng lặp triệt tiêu ít nhất một người, nên tối đa `n − 1` giao dịch.
 */
function matchTransfers(balances: readonly Balance[]): Transfer[] {
  type Node = { id: string; remaining: number; sortOrder: number }

  const byAmountDesc = (a: Node, b: Node) =>
    b.remaining - a.remaining || a.sortOrder - b.sortOrder

  const creditors: Node[] = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ id: b.participantId, remaining: b.balance, sortOrder: b.sortOrder }))
    .sort(byAmountDesc)

  const debtors: Node[] = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ id: b.participantId, remaining: -b.balance, sortOrder: b.sortOrder }))
    .sort(byAmountDesc)

  const transfers: Transfer[] = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]
    const debtor = debtors[di]
    const amount = Math.min(creditor.remaining, debtor.remaining)

    transfers.push({
      fromId: debtor.id,
      toId: creditor.id,
      amount,
      transferKey: transferKeyOf(debtor.id, creditor.id),
    })

    creditor.remaining -= amount
    debtor.remaining -= amount
    if (creditor.remaining === 0) ci++
    if (debtor.remaining === 0) di++
  }

  return transfers
}

/**
 * Thứ tự hiển thị bảng số dư ở màn quyết toán (docs/screens/04-settlement.md §3.3):
 * nhận về trước (số tiền giảm dần) → cần trả (|số tiền| giảm dần) → số dư 0 ở cuối.
 * Tie-break trong mỗi nhóm: sortOrder tăng dần.
 *
 * Tách khỏi `settle()` vì đây là quyết định trình bày, không phải nghiệp vụ tính toán.
 */
export function sortBalancesForDisplay(balances: readonly Balance[]): Balance[] {
  const group = (b: Balance) => (b.balance > 0 ? 0 : b.balance < 0 ? 1 : 2)

  return [...balances].sort((a, b) => {
    const ga = group(a)
    const gb = group(b)
    if (ga !== gb) return ga - gb
    if (ga === 2) return a.sortOrder - b.sortOrder
    const diff = Math.abs(b.balance) - Math.abs(a.balance)
    if (diff !== 0) return diff
    return a.sortOrder - b.sortOrder
  })
}

/**
 * Một người được coi là Done khi MỌI giao dịch liên quan tới người đó
 * (dù là bên gửi hay bên nhận) đã được đánh dấu Done.
 * Người có số dư 0 không dính giao dịch nào → Done ngay từ đầu.
 */
export function isParticipantDone(
  participantId: string,
  transfers: readonly Transfer[],
  doneKeys: ReadonlySet<string>
): boolean {
  return transfers
    .filter((t) => t.fromId === participantId || t.toId === participantId)
    .every((t) => doneKeys.has(t.transferKey))
}

/** Định dạng tiền JPY: `¥12,000`. Luôn dùng hàm này, không tự gọi toLocaleString rải rác. */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('en-US')}`
}

/** Số dư ở bảng quyết toán: `+20,000` / `-10,000` / `0` — không có ký hiệu ¥. */
export function formatBalance(balance: number): string {
  if (balance === 0) return '0'
  const sign = balance > 0 ? '+' : '-'
  return `${sign}${Math.abs(balance).toLocaleString('en-US')}`
}
