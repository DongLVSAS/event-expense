# CLAUDE.md

Hướng dẫn làm việc trong repo này. Đọc kỹ trước khi sinh hoặc sửa code.

## Tổng quan dự án

Web app (mobile-first) ghi chép chi tiêu cho các buổi đi chơi nhóm và tự động quyết toán ai chuyển tiền cho ai. Mỗi sự kiện có một link chia sẻ, không cần đăng nhập.

## Nguồn sự thật

Thứ tự ưu tiên phụ thuộc **loại câu hỏi**:

| Câu hỏi thuộc loại | Nguồn thắng |
|---|---|
| **Giao diện** — màu, font, spacing, radius, shadow, animation, layout, copy hiển thị, cử chỉ tương tác | 1. `docs/design_handoff/README.md` |
| **Nghiệp vụ** — công thức, validate, quyền, đồng bộ, edge case, trạng thái lỗi | 1. `docs/screens/*.md` |

Đầy đủ bốn tầng, tầng trên đè tầng dưới **trong phạm vi của mình**:

1. **`docs/design_handoff/README.md`** — bản giao thiết kế. Nguồn sự thật về **giao diện**. Token màu/typography/spacing, animation, hành vi tương tác, copy. Prototype ở `design_handoff/prototype/*.dc.html` là **tham chiếu để dựng lại**, không phải code production để copy. Ảnh nhân vật ở `design_handoff/assets/`.
2. **`docs/screens/*.md`** — spec màn hình. Nguồn sự thật về **nghiệp vụ**: luồng, validate, edge case, đồng bộ nhiều người, mã lỗi. Bảng route ở `00-index.md`.
3. **`docs/warikan-app-prompt.md`** — prompt mô tả gốc. Chỉ tra khi hai tầng trên không nói tới. **Đây là bản duy nhất**; bản sao cũ trong `design_handoff/spec/` đã bị xóa vì lệch nội dung.
4. **`CLAUDE.md`** (file này) — quy tắc kỹ thuật: stack, ranh giới server/client, code style, quy trình.

Khi không rõ một câu hỏi là "giao diện" hay "nghiệp vụ" → **hỏi tôi**, đừng tự xếp loại để lấy cớ chọn bên.

Ba tầng này không được mâu thuẫn nhau. **Khi phát hiện mâu thuẫn — giữa hai tầng bất kỳ, hoặc giữa tài liệu và yêu cầu tôi vừa nói — thì dừng lại hỏi tôi, không tự chọn bên nào.**

**Code không đi trước spec.** Nếu khi code thấy cần làm khác spec: dừng → báo tôi → sửa spec → rồi mới code. Không sửa code trước rồi cập nhật spec sau.

Quyết định đã chốt được ghi thẳng vào file spec kèm nhãn `[ĐÃ CHỐT]`. Mục còn treo mang nhãn `[CHỜ QUYẾT ĐỊNH]`, `[ĐỀ XUẤT]` hoặc `[CẦN XÁC NHẬN]` — **chạm tới thì hỏi, không tự chọn.**

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL (Neon)
- Deploy: Vercel, region `hnd1`
- Test: Vitest

## Lệnh thường dùng

```bash
npm run dev              # dev server
npm run build            # build production (phải pass trước khi commit)
npm run lint             # eslint
npm run test             # vitest, chạy 1 lần
npm run test:watch       # vitest watch
npx prisma migrate dev   # tạo + apply migration ở local
npx prisma studio        # xem dữ liệu
npx prisma generate      # sinh lại client sau khi sửa schema
```

## Cấu trúc thư mục

```
app/
  page.tsx                          # Home — danh sách sự kiện (localStorage)
  new/page.tsx                      # Tạo sự kiện
  e/[shareId]/page.tsx              # Chi tiết sự kiện — danh sách chi tiêu
  e/[shareId]/edit/page.tsx         # Sửa sự kiện (tên, ngày, người tham gia)
  e/[shareId]/settlement/page.tsx   # Màn quyết toán
  api/                              # Route handlers
components/
lib/
  settlement.ts                     # LÕI NGHIỆP VỤ — xem mục dưới
  prisma.ts                         # singleton PrismaClient
  local-events.ts                   # đọc/ghi danh sách shareId ở localStorage
prisma/schema.prisma
docs/spec.md
__tests__/settlement.test.ts
```

## Quy tắc nghiệp vụ bắt buộc

Đây là phần dễ sai nhất. Không được tự ý đổi.

### Tiền tệ

- Đơn vị **JPY**, luôn là **số nguyên**. Tuyệt đối không dùng số thực ở bất kỳ đâu trong luồng tính toán.
- Hiển thị dạng `¥12,000` (có dấu phân cách hàng nghìn).

### Thuật toán quyết toán

Toàn bộ nằm trong `lib/settlement.ts`, là **pure function**, không import Prisma, không gọi API, không đọc `Date.now()`. Input là participants + expenses, output là balances + transfers.

```
base      = Math.floor(total / n)
remainder = total - base * n
share[i]  = base, cộng thêm 1 cho đúng `remainder` người,
            xét theo paid[i] giảm dần, tie-break theo sortOrder tăng dần
balance[i] = paid[i] - share[i]
```

Sau đó ghép giao dịch bằng greedy (chủ nợ lớn nhất với con nợ lớn nhất), tie-break theo `sortOrder`.

**Bất biến bắt buộc, phải có test:**

- `sum(share) === total` chính xác, không sai số.
- `sum(balance) === 0` với mọi bộ dữ liệu.
- Thuật toán **tất định**: cùng input luôn cho ra cùng thứ tự transfer và cùng `transferKey`. Đây là lý do phải có tie-break cố định — `transferKey = "${fromId}:${toId}"` được dùng làm khóa lưu trạng thái Done trong DB.

### dataVersion

Kết quả quyết toán **không lưu DB**, luôn tính lại từ dữ liệu gốc. Chỉ trạng thái Done của từng transfer được lưu.

Mỗi khi participants hoặc expenses thay đổi (thêm/sửa/xóa):

1. Tăng `event.dataVersion`
2. Xóa toàn bộ `TransferStatus` của event đó
3. Set `event.settledAt = null`

Ba việc này phải nằm trong **cùng một transaction** với thao tác sửa dữ liệu. Không được để sót.

### Ranh giới server / client

- Prisma **chỉ** được import trong Route Handler, Server Component hoặc Server Action. Không bao giờ trong file có `'use client'`.
- `DATABASE_URL` không bao giờ xuất hiện trong code chạy ở client, không bao giờ đặt tiền tố `NEXT_PUBLIC_`.
- Validate mọi input ở server bằng zod. Không tin dữ liệu từ client, kể cả khi client đã validate rồi.

### Neon + serverless

Trên Vercel mỗi route handler là một serverless function, không có connection pool sống lâu. Dùng `@prisma/adapter-neon` (Neon serverless driver) hoặc connection string qua PgBouncer. **Không** tạo `new PrismaClient()` trong từng request — dùng singleton ở `lib/prisma.ts`.

## Quy ước code

- TypeScript strict. Không `any`, không `@ts-ignore`. Nếu type khó quá thì dừng lại hỏi tôi.
- Server Component là mặc định. Chỉ thêm `'use client'` khi component thật sự cần state hoặc event handler.
- Data fetching phía client dùng SWR hoặc TanStack Query — chọn một, không trộn lẫn.
- Tên biến/hàm tiếng Anh. **Toàn bộ text hiển thị cho người dùng là tiếng Việt** (riêng dòng chúc mừng giữ nguyên `Chúc mừng bạn đã có chuyến đi vui vẻ! またね!`).
- Tailwind: dùng class utility trực tiếp, không tạo file CSS riêng trừ khi bắt buộc.
- Mobile-first: viết class cho mobile trước, breakpoint lớn hơn thêm sau. Vùng chạm tối thiểu 44×44px.

## Testing

- Bắt buộc có test cho `lib/settlement.ts`: chia hết, chia lẻ, người không chi gì, mọi người chi bằng nhau, 2 người, 10 người, số tiền lớn.
- Test phải bao gồm hai bất biến `sum(share) === total` và `sum(balance) === 0`.
- Các phần khác chưa cần test, trừ khi tôi yêu cầu.

## Không được làm

- Không tự thêm thư viện mới nếu chưa hỏi tôi.
- Không tự thêm authentication, tài khoản người dùng, hay phân quyền. Bản này cố ý không có.
- Không tự thêm tính năng ngoài spec (chia theo người thụ hưởng, QR chuyển khoản, đa tiền tệ... đều thuộc Phase 2).
- Không chạy `prisma migrate reset` hay `prisma db push --force-reset`.
- Không commit `.env`.
- Không sửa thuật toán trong `lib/settlement.ts` mà không báo tôi trước.

## Quy trình làm việc

### Bắt buộc trước khi code một màn

1. **Đọc file spec tương ứng** trong `docs/screens/` — tra bảng route ở `00-index.md` để biết màn nào ứng với file nào.
2. **Tóm tắt 3–5 dòng**: spec yêu cầu gì ở màn này, mục nào đang treo (`[CHỜ QUYẾT ĐỊNH]` / `[ĐỀ XUẤT]` / `[CẦN XÁC NHẬN]`). Đợi tôi xác nhận rồi mới viết.
3. **Chạm vào mục treo → hỏi trước**, không tự chọn.
4. Code xong, **đối chiếu lại từng gạch đầu dòng của spec** trước khi báo hoàn thành.

### Trong lúc làm

- Làm từng phần nhỏ, xong một màn hình thì dừng lại cho tôi review, không làm một lèo cả app.
- Sau khi sửa code, chạy `npm run build` và `npm run test` để chắc chắn không vỡ.
- Phát hiện code hiện có lệch spec → báo tôi, đừng lặng lẽ sửa theo hướng nào.

### Hook tự động (`.claude/settings.json`)

Repo có 3 hook trong `.claude/hooks/`, chạy bằng `node`, chỉ để nhắc — không chặn:

| Hook | Khi nào chạy | Làm gì |
|---|---|---|
| `session-start.mjs` | Mở phiên | Nạp thứ tự ưu tiên tài liệu + liệt kê spec đang có |
| `spec-reminder.mjs` | Trước mỗi Edit/Write vào `app/`, `components/`, `lib/` | Chỉ ra file spec tương ứng với file đang sửa |
| `stop-reminder.mjs` | Kết thúc lượt | Nhắc chạy build + test, chỉ khi còn thay đổi chưa commit |

Sửa ánh xạ file → spec ở bảng `RULES` trong `spec-reminder.mjs` khi thêm màn mới. Muốn chuyển từ nhắc sang chặn: xem ghi chú cuối file đó.

## Chưa quyết định (hỏi tôi khi chạm tới)

- **SWR hay TanStack Query** — chọn một, không trộn lẫn. TODO
- **Lối vào "Sửa sự kiện" và "Xóa hẳn sự kiện"** — handoff không vẽ nút nào dẫn tới hai màn/hành động này, nhưng chúng là yêu cầu nghiệp vụ. Xem `docs/screens/01-home.md` §4.1. TODO
- **Độ dài `shareId`** — nghiệp vụ chốt nanoid 16–21; handoff minh họa 10 ký tự. Spec đang giữ 16–21 vì đây là câu hỏi bảo mật. Xem `docs/screens/00-index.md` §3.9. TODO

Đã được `docs/design_handoff/` chốt, **không còn treo**: danh sách nhân vật (10 con, ảnh ở `design_handoff/assets/`, trần 10 người/sự kiện) · design system (token đầy đủ trong README của handoff) · hiệu ứng pháo hoa (**không dùng thư viện** — CSS `@keyframes wk-fall`, 60 hạt).
