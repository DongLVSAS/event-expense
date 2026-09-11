# CLAUDE.md

Hướng dẫn làm việc trong repo này. Đọc kỹ trước khi sinh hoặc sửa code.

## Tổng quan dự án

Web app (mobile-first) ghi chép chi tiêu cho các buổi đi chơi nhóm và tự động quyết toán ai chuyển tiền cho ai. Mỗi sự kiện có một link chia sẻ, không cần đăng nhập.

Spec đầy đủ: `docs/spec.md`. **Khi có mâu thuẫn giữa file này và spec, hỏi lại tôi, không tự quyết định.**

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
  e/[shareId]/page.tsx              # Chi tiết sự kiện — danh sách chi tiêu
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

- Làm từng phần nhỏ, xong một màn hình thì dừng lại cho tôi review, không làm một lèo cả app.
- Trước khi code một phần mới, tóm tắt lại kế hoạch trong 3–5 dòng và đợi tôi xác nhận.
- Sau khi sửa code, chạy `npm run build` và `npm run test` để chắc chắn không vỡ.

## Chưa quyết định (hỏi tôi khi chạm tới)

- Danh sách nhân vật: số lượng, tên file, tỉ lệ ảnh (full-body hay avatar tròn) — TODO
- Design system: màu chủ đạo, font, phong cách — TODO
- Thư viện hiệu ứng pháo hoa — TODO
