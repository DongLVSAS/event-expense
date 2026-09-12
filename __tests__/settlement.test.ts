import { describe, expect, it } from 'vitest'
import {
  formatBalance,
  formatYen,
  isParticipantDone,
  settle,
  sortBalancesForDisplay,
  transferKeyOf,
  type SettlementExpense,
  type SettlementParticipant,
} from '@/lib/settlement'

/** Tạo n người với sortOrder 0..n-1, id là 'A', 'B', 'C', ... */
function people(n: number): SettlementParticipant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: String.fromCharCode(65 + i),
    sortOrder: i,
  }))
}

function spend(payerId: string, amount: number): SettlementExpense {
  return { payerId, amount }
}

/** Hai bất biến bắt buộc, kiểm cho MỌI bộ dữ liệu. */
function expectInvariants(
  participants: readonly SettlementParticipant[],
  expenses: readonly SettlementExpense[]
) {
  const r = settle(participants, expenses)

  const sumShare = r.balances.reduce((s, b) => s + b.share, 0)
  const sumBalance = r.balances.reduce((s, b) => s + b.balance, 0)

  expect(sumShare).toBe(r.total)
  expect(sumBalance).toBe(0)

  // Số giao dịch tối đa n − 1.
  expect(r.transfers.length).toBeLessThanOrEqual(participants.length - 1)

  // Mọi số tiền đều là số nguyên dương.
  for (const t of r.transfers) {
    expect(Number.isInteger(t.amount)).toBe(true)
    expect(t.amount).toBeGreaterThan(0)
  }
  for (const b of r.balances) {
    expect(Number.isInteger(b.share)).toBe(true)
    expect(Number.isInteger(b.balance)).toBe(true)
  }

  // Tổng tiền một người phải trả qua các giao dịch = |số dư| của người đó.
  for (const b of r.balances) {
    const out = r.transfers
      .filter((t) => t.fromId === b.participantId)
      .reduce((s, t) => s + t.amount, 0)
    const incoming = r.transfers
      .filter((t) => t.toId === b.participantId)
      .reduce((s, t) => s + t.amount, 0)
    expect(incoming - out).toBe(b.balance)
  }

  return r
}

describe('settle — hai bất biến bắt buộc', () => {
  it('chia hết: Σ share === total và Σ balance === 0', () => {
    expectInvariants(people(3), [spend('A', 5000), spend('A', 2000), spend('B', 2000)])
  })

  it('chia lẻ: Σ share === total chính xác, không sai số', () => {
    const r = expectInvariants(people(3), [
      spend('A', 5000),
      spend('B', 3000),
      spend('C', 2000),
    ])
    expect(r.total).toBe(10_000)
    expect(r.balances.map((b) => b.share)).toEqual([3334, 3333, 3333])
  })

  it('mọi người đều chi bằng nhau → số dư 0 hết, không giao dịch nào', () => {
    const r = expectInvariants(people(4), [
      spend('A', 1000),
      spend('B', 1000),
      spend('C', 1000),
      spend('D', 1000),
    ])
    expect(r.balances.every((b) => b.balance === 0)).toBe(true)
    expect(r.transfers).toHaveLength(0)
  })

  it('chưa có khoản chi nào → total 0, mọi số dư 0', () => {
    const r = expectInvariants(people(3), [])
    expect(r.total).toBe(0)
    expect(r.balances.every((b) => b.balance === 0)).toBe(true)
    expect(r.transfers).toHaveLength(0)
  })
})

describe('settle — fixture chốt trong docs/screens/04-settlement.md §4.2', () => {
  // Hai ví dụ này là bản chốt SAU khi sửa mâu thuẫn trong prompt gốc:
  // debtors duyệt theo |balance| giảm dần, nên C đứng trước B.
  it('Ví dụ 1 (chia hết): C → A ¥3,000 rồi mới B → A ¥1,000', () => {
    const r = settle(people(3), [spend('A', 5000), spend('A', 2000), spend('B', 2000)])

    expect(r.total).toBe(9000)
    expect(r.balances.map((b) => b.balance)).toEqual([4000, -1000, -3000])
    expect(r.transfers).toEqual([
      { fromId: 'C', toId: 'A', amount: 3000, transferKey: 'C:A' },
      { fromId: 'B', toId: 'A', amount: 1000, transferKey: 'B:A' },
    ])
  })

  it('Ví dụ 2 (chia lẻ): C → A ¥1,333 rồi mới B → A ¥333', () => {
    const r = settle(people(3), [spend('A', 5000), spend('B', 3000), spend('C', 2000)])

    expect(r.balances.map((b) => b.balance)).toEqual([1666, -333, -1333])
    expect(r.transfers).toEqual([
      { fromId: 'C', toId: 'A', amount: 1333, transferKey: 'C:A' },
      { fromId: 'B', toId: 'A', amount: 333, transferKey: 'B:A' },
    ])
  })
})

describe('settle — phân bổ tiền lẻ', () => {
  it('người đã chi nhiều nhất gánh phần lẻ', () => {
    // total 10.000, n 3 → base 3.333, remainder 1 → A (chi nhiều nhất) gánh 3.334
    const r = settle(people(3), [spend('A', 5000), spend('B', 3000), spend('C', 2000)])
    expect(r.balances.find((b) => b.participantId === 'A')!.share).toBe(3334)
  })

  it('hòa số tiền đã chi → tie-break theo sortOrder tăng dần', () => {
    // total 10.000, n 3, remainder 1. A và B cùng chi 5.000, C chi 0.
    // A có sortOrder nhỏ hơn nên A gánh phần lẻ.
    const r = settle(people(3), [spend('A', 5000), spend('B', 5000)])
    expect(r.balances.find((b) => b.participantId === 'A')!.share).toBe(3334)
    expect(r.balances.find((b) => b.participantId === 'B')!.share).toBe(3333)
  })

  it('remainder = n − 1 (trường hợp lẻ nhiều nhất)', () => {
    // total 10, n 4 → base 2, remainder 2
    const r = expectInvariants(people(4), [spend('A', 10)])
    expect(r.balances.map((b) => b.share)).toEqual([3, 3, 2, 2])
  })
})

describe('settle — các trường hợp biên', () => {
  it('người không chi gì vẫn xuất hiện với số dư âm', () => {
    const r = settle(people(3), [spend('A', 9000)])
    const c = r.balances.find((b) => b.participantId === 'C')!
    expect(c.paid).toBe(0)
    expect(c.balance).toBe(-3000)
  })

  it('2 người — tối đa 1 giao dịch', () => {
    const r = expectInvariants(people(2), [spend('A', 3000)])
    expect(r.transfers).toEqual([
      { fromId: 'B', toId: 'A', amount: 1500, transferKey: 'B:A' },
    ])
  })

  it('10 người (trần của một sự kiện)', () => {
    const ps = people(10)
    const r = expectInvariants(ps, [
      spend('A', 12_345),
      spend('B', 7),
      spend('E', 100_000),
      spend('J', 1),
    ])
    expect(r.balances).toHaveLength(10)
  })

  it('số tiền rất lớn vẫn là số nguyên chính xác', () => {
    const r = expectInvariants(people(7), [
      spend('A', 9_000_000_000),
      spend('D', 1_234_567_891),
    ])
    expect(r.total).toBe(10_234_567_891)
  })

  it('một người trả cho nhiều người khác nhau', () => {
    // total 9.000, base 3.000 → A +2.000, B +1.000, C −3.000.
    // C là con nợ duy nhất nên phải chuyển cho cả A lẫn B.
    const r = expectInvariants(people(3), [spend('A', 5000), spend('B', 4000)])
    expect(r.balances.map((b) => b.balance)).toEqual([2000, 1000, -3000])
    expect(r.transfers).toEqual([
      { fromId: 'C', toId: 'A', amount: 2000, transferKey: 'C:A' },
      { fromId: 'C', toId: 'B', amount: 1000, transferKey: 'C:B' },
    ])
  })

  it('1 người tham gia → số dư 0, không giao dịch', () => {
    const r = settle(people(1), [spend('A', 5000)])
    expect(r.balances[0].balance).toBe(0)
    expect(r.transfers).toHaveLength(0)
  })
})

describe('settle — đầu vào sai phải báo lỗi rõ ràng', () => {
  it('không có người tham gia nào', () => {
    expect(() => settle([], [])).toThrow(/ít nhất một người/)
  })

  it('khoản chi trỏ tới người không tồn tại', () => {
    expect(() => settle(people(2), [spend('Z', 100)])).toThrow(/payerId/)
  })

  it('số tiền là số thực', () => {
    expect(() => settle(people(2), [spend('A', 100.5)])).toThrow(/số nguyên/)
  })

  it('số tiền bằng 0 hoặc âm', () => {
    expect(() => settle(people(2), [spend('A', 0)])).toThrow(/lớn hơn 0/)
    expect(() => settle(people(2), [spend('A', -100)])).toThrow(/lớn hơn 0/)
  })

  it('trùng id người tham gia', () => {
    expect(() =>
      settle([{ id: 'A', sortOrder: 0 }, { id: 'A', sortOrder: 1 }], [])
    ).toThrow(/trùng id/)
  })
})

describe('settle — tính tất định', () => {
  const ps = people(6)
  const es = [spend('A', 7777), spend('C', 31), spend('F', 12_000), spend('B', 9)]

  it('chạy lại nhiều lần cho ra đúng cùng thứ tự transfer và cùng transferKey', () => {
    const first = settle(ps, es)
    for (let i = 0; i < 20; i++) {
      expect(settle(ps, es)).toEqual(first)
    }
  })

  it('đổi thứ tự mảng participants đầu vào không làm đổi kết quả', () => {
    const normal = settle(ps, es)
    const shuffled = settle([...ps].reverse(), es)
    expect(shuffled.transfers).toEqual(normal.transfers)
    expect(shuffled.balances).toEqual(normal.balances)
  })

  it('đổi thứ tự mảng expenses không làm đổi kết quả', () => {
    const normal = settle(ps, es)
    const shuffled = settle(ps, [...es].reverse())
    expect(shuffled.transfers).toEqual(normal.transfers)
  })
})

describe('settle — bất biến đúng với dữ liệu ngẫu nhiên', () => {
  // LCG có seed cố định: chạy lại luôn ra cùng bộ dữ liệu, không flaky.
  function lcg(seed: number) {
    let s = seed
    return () => {
      s = (s * 1103515245 + 12345) % 2147483648
      return s / 2147483648
    }
  }

  it('200 bộ dữ liệu ngẫu nhiên đều giữ Σ share === total và Σ balance === 0', () => {
    const rand = lcg(42)
    for (let iter = 0; iter < 200; iter++) {
      const n = 2 + Math.floor(rand() * 9) // 2..10 người
      const ps = people(n)
      const expenseCount = Math.floor(rand() * 12)
      const es: SettlementExpense[] = []
      for (let i = 0; i < expenseCount; i++) {
        const payer = ps[Math.floor(rand() * n)].id
        const amount = 1 + Math.floor(rand() * 500_000)
        es.push(spend(payer, amount))
      }
      expectInvariants(ps, es)
    }
  })
})

describe('sortBalancesForDisplay', () => {
  it('nhận về trước, rồi cần trả, số dư 0 xuống cuối', () => {
    const r = settle(people(5), [spend('A', 10_000), spend('B', 5000), spend('C', 5000)])
    const sorted = sortBalancesForDisplay(r.balances)

    const groups = sorted.map((b) => (b.balance > 0 ? '+' : b.balance < 0 ? '-' : '0'))
    // Không có '0' nào nằm trước '+' hay '-'.
    expect(groups.indexOf('0') === -1 || groups.lastIndexOf('+') < groups.indexOf('0')).toBe(true)
    expect(groups.indexOf('0') === -1 || groups.lastIndexOf('-') < groups.indexOf('0')).toBe(true)
  })

  it('số dư 0 luôn ở cuối bảng, sắp theo sortOrder', () => {
    // A chi hết, B và C chia đều phần của mình → dựng ca có người số dư 0.
    const balances = [
      { participantId: 'A', sortOrder: 0, paid: 100, share: 50, balance: 50 },
      { participantId: 'B', sortOrder: 1, paid: 0, share: 50, balance: -50 },
      { participantId: 'C', sortOrder: 2, paid: 50, share: 50, balance: 0 },
      { participantId: 'D', sortOrder: 3, paid: 50, share: 50, balance: 0 },
    ]
    const sorted = sortBalancesForDisplay(balances)
    expect(sorted.map((b) => b.participantId)).toEqual(['A', 'B', 'C', 'D'])
  })
})

describe('isParticipantDone', () => {
  const r = settle(people(3), [spend('A', 5000), spend('A', 2000), spend('B', 2000)])

  it('người có số dư 0 → Done ngay, không dính giao dịch nào', () => {
    const r0 = settle(people(2), [spend('A', 1000), spend('B', 1000)])
    expect(isParticipantDone('A', r0.transfers, new Set())).toBe(true)
  })

  it('chỉ Done khi MỌI giao dịch liên quan đã tick', () => {
    expect(isParticipantDone('A', r.transfers, new Set(['C:A']))).toBe(false)
    expect(isParticipantDone('A', r.transfers, new Set(['C:A', 'B:A']))).toBe(true)
    expect(isParticipantDone('B', r.transfers, new Set(['C:A']))).toBe(false)
    expect(isParticipantDone('C', r.transfers, new Set(['C:A']))).toBe(true)
  })
})

describe('định dạng hiển thị', () => {
  it('formatYen có ký hiệu ¥ và dấu phân cách hàng nghìn', () => {
    expect(formatYen(12_000)).toBe('¥12,000')
    expect(formatYen(0)).toBe('¥0')
    expect(formatYen(1_234_567)).toBe('¥1,234,567')
  })

  it('formatBalance có dấu, không có ¥', () => {
    expect(formatBalance(20_000)).toBe('+20,000')
    expect(formatBalance(-10_000)).toBe('-10,000')
    expect(formatBalance(0)).toBe('0')
  })

  it('transferKeyOf khớp với khóa trong transfers', () => {
    const r = settle(people(2), [spend('A', 1000)])
    expect(r.transfers[0].transferKey).toBe(transferKeyOf('B', 'A'))
  })
})
