# Prompt mô tả ứng dụng: Ghi chép & quyết toán chi phí cho các buổi đi chơi

> Dùng đoạn dưới đây làm prompt để sinh code hoặc làm tài liệu spec.
> Các mục đánh dấu **[CẦN XÁC NHẬN]** là đề xuất, có thể đổi.

---

## 1. Tổng quan

Xây dựng một **web app** (mobile-first, tối ưu cho màn hình smartphone ~375–430px) giúp một nhóm bạn ghi lại các khoản chi trong một buổi đi chơi và tự động quyết toán xem ai phải chuyển tiền cho ai bao nhiêu. Mỗi sự kiện có một **link chia sẻ** để cả nhóm cùng mở, cùng nhập chi tiêu và cùng xem kết quả quyết toán.

Phong cách UI thân thiện, vui vẻ, lấy cảm hứng từ Chouseisan (調整さん): mỗi người tham gia được gán một nhân vật hoạt hình, đứng thành một hàng, tên hiển thị ngay dưới chân nhân vật.

**Đơn vị tiền: JPY** — số nguyên, không có phần thập phân, hiển thị dạng `¥12,000`. Mọi phép tính dùng số nguyên, tuyệt đối không dùng float.

---

## 2. Kiến trúc & công nghệ

- **Frontend + Backend: Next.js (App Router) + TypeScript** — một repo duy nhất. Next.js chạy trên Node.js nên phần server nằm luôn trong project: API viết bằng Route Handlers (`app/api/**/route.ts`), truy cập DB qua Prisma ở phía server. Không cần dựng thêm một service backend riêng.
- **UI: Tailwind CSS** + thư viện confetti/fireworks cho hiệu ứng chúc mừng.
- **DB: PostgreSQL (Neon) + Prisma.** `DATABASE_URL` là biến môi trường phía server, tuyệt đối không để lộ ra client. Mọi truy vấn Prisma chỉ chạy trong Route Handler / Server Component / Server Action.
- **Deploy: Vercel**, region **Singapore (`sin1`)** — đổi từ `hnd1` để trùng region của Neon (`ap-southeast-1`); xem CLAUDE.md mục "Region phải trùng region của Neon". Mỗi Route Handler được deploy thành một serverless function.

### Mô hình chia sẻ & quyền truy cập

- **Không cần đăng ký/đăng nhập** (giảm ma sát, đúng tinh thần Chouseisan).
- Mỗi sự kiện có một `shareId` ngẫu nhiên, khó đoán (nanoid 16–21 ký tự). URL chia sẻ: `https://<domain>/e/{shareId}`.
- **Chỉ có một loại link duy nhất — ai có link thì vừa xem vừa sửa được.** Không tách link chỉ-xem và link chỉnh-sửa. Nút **"Sao chép link chia sẻ"** đặt ở màn chi tiết sự kiện và màn quyết toán.
- **Màn Home** hiển thị danh sách sự kiện dựa trên `localStorage` của từng máy (lưu các `shareId` mà máy đó đã tạo hoặc đã mở). Không có tài khoản nên không có danh sách phía server. Khi mở một link chia sẻ lần đầu, tự động thêm sự kiện đó vào Home của máy đang mở.
- **Đồng bộ nhiều người dùng cùng lúc**: refetch dữ liệu khi tab được focus + polling mỗi ~10 giây khi tab đang mở. Cập nhật lạc quan (optimistic update) ở client. Quy tắc ghi: last-write-wins, nhưng so sánh `updatedAt` để hiện toast "Dữ liệu vừa được người khác cập nhật" và reload khi phát hiện lệch.

---

## 3. Mô hình dữ liệu

```
Event {
  id: string (uuid)
  shareId: string (nanoid, unique, index)     // dùng trong URL
  name: string                                 // bắt buộc
  date: date (YYYY-MM-DD)                      // bắt buộc
  dataVersion: int                             // tăng mỗi khi participants/expenses thay đổi
  settledAt: datetime | null
  createdAt / updatedAt
}

Participant {
  id: string
  eventId: string
  name: string                  // bắt buộc, không trùng trong cùng event
  characterId: string           // gán ngẫu nhiên, không trùng trong cùng event
  sortOrder: int
}

Expense {
  id: string
  eventId: string
  title: string                 // bắt buộc — tên đồ/việc đã chi
  amount: int                   // bắt buộc, số nguyên > 0 (JPY)
  payerId: string               // bắt buộc — FK tới Participant
  sortOrder: int                // dùng để sinh STT
  createdAt
}

TransferStatus {
  id: string
  eventId: string
  transferKey: string           // "{fromParticipantId}:{toParticipantId}" — xem mục 5 bước 3
  dataVersion: int              // version tại thời điểm đánh dấu Done
  done: boolean
}
```

**Lưu ý quan trọng:** kết quả quyết toán **không lưu vào DB**, mà được tính lại từ `participants` + `expenses` bằng một hàm thuần (pure function) dùng chung cho cả server và client. Chỉ có trạng thái Done của từng giao dịch là được lưu. Vì thuật toán ghép giao dịch là tất định (deterministic), `transferKey` luôn ổn định với cùng một bộ dữ liệu.

Khi `participants` hoặc `expenses` thay đổi → tăng `dataVersion`, **vô hiệu hóa toàn bộ TransferStatus của version cũ** và reset `settledAt = null`.

---

## 4. Các màn hình

### 4.1. Home — danh sách sự kiện (`/`)
- Danh sách các sự kiện lưu trong localStorage của máy: tên sự kiện, ngày diễn ra, số người tham gia, tổng chi, badge trạng thái (`Chưa quyết toán` / `Đã xong`).
- Sắp xếp mặc định: ngày diễn ra giảm dần.
- Mỗi item: tap để mở chi tiết; menu `...` để **sửa / xóa khỏi máy này / xóa hẳn sự kiện** (xóa hẳn có confirm, cảnh báo rằng link chia sẻ sẽ không dùng được nữa).
- Nút nổi (FAB) góc dưới phải: **+ Tạo sự kiện**.
- Trạng thái rỗng: minh họa + dòng gợi ý "Tạo sự kiện đầu tiên của bạn".

### 4.2. Màn tạo / sửa sự kiện
- **Tên sự kiện** (text, bắt buộc).
- **Ngày diễn ra** (date picker, bắt buộc, mặc định là hôm nay).
- **Danh sách người tham gia**: icon dấu **+** để nhập tên từng người. Khi thêm, hệ thống **tự động random một nhân vật** từ danh sách nhân vật do tôi cung cấp (ảnh đặt trong thư mục assets, khai báo qua file `characters.ts`).
  - Nhân vật **không trùng nhau** trong cùng một sự kiện. Nếu số người > số nhân vật có sẵn thì mới cho phép lặp lại (phân biệt bằng màu viền).
  - Nhân vật đã gán được lưu cố định, không đổi mỗi lần re-render hay reload.
  - Tap vào nhân vật để **đổi (re-roll)** sang nhân vật khác còn trống.
  - Hiển thị: các nhân vật đứng thành hàng ngang ngay bên dưới (tự xuống dòng khi đầy), **tên người hiển thị ngay dưới chân nhân vật**.
  - Cho phép **xóa** một người. Nếu người đó đã gắn với khoản chi nào thì chặn và cảnh báo: "Không thể xóa vì đã có khoản chi ghi nhận cho người này".
- Validate: tên sự kiện không rỗng, ngày hợp lệ, **tối thiểu 2 người tham gia**, tên người không trùng nhau.
- Sau khi tạo xong → hiện ngay link chia sẻ kèm nút sao chép.

### 4.3. Màn chi tiết sự kiện — danh sách chi tiêu (`/e/{shareId}`)
- Header: tên sự kiện + ngày + nút **Sao chép link chia sẻ**.
- **Dòng cố định (sticky) phía trên bảng**: **Tổng chi tiêu** = tổng tất cả khoản chi, font lớn, in đậm.
- Bảng danh sách chi tiêu, mỗi dòng gồm:
  | STT | Tên đồ/việc đã chi | Số tiền | Người đã chi |
  - **STT**: tự sinh, đánh lại liên tục sau khi xóa dòng.
  - **Tên đồ/việc**: bắt buộc.
  - **Số tiền**: bắt buộc, số nguyên dương, `inputmode="numeric"`, tự format dấu phân cách hàng nghìn.
  - **Người đã chi**: bắt buộc, select options lấy từ danh sách người tham gia của sự kiện này, hiển thị kèm avatar nhân vật.
- Thêm khoản chi bằng form inline hoặc bottom sheet. Tap vào dòng để **sửa**, swipe-left để **xóa** (có confirm).
- Trên màn hình hẹp, nếu 4 cột quá chật thì render dạng **list/card**: dòng 1 là tên khoản chi + số tiền (căn phải), dòng 2 là avatar + tên người đã chi.
- Nút **"Quyết toán"** cố định (fixed) ở đáy màn hình, full-width. Disable khi chưa có khoản chi nào.

### 4.4. Màn quyết toán (`/e/{shareId}/settlement`)

**Phần A — Bảng số dư từng người** (4 cột):

| STT | Người dùng | Số tiền nhận về / cần trả | Trạng thái |
|---|---|---|---|
| 1 | (dòng trên: nhân vật / dòng dưới: tên) | `+20,000` | Done |

- Cột số tiền:
  - Nhận về → dấu **+** phía trước, **in đậm, màu xanh lá**. VD: `+20,000`
  - Cần trả → dấu **−** phía trước, **in đậm, màu đỏ**. VD: `-10,000`
  - Số dư bằng 0 (không nhận cũng không phải trả) → hiển thị `0`, màu xám, **tự động điền trạng thái Done** ngay từ đầu, không cho sửa.
- Cột trạng thái: để trống, hoặc **Done** (text màu xanh lá).
  - Với người có số dư khác 0: trạng thái tự chuyển thành Done khi **tất cả giao dịch liên quan đến người đó** ở Phần B đã được đánh dấu Done.
- Sắp xếp: người nhận về lên trước, rồi đến người cần trả; mỗi nhóm sắp theo số tiền giảm dần.

**Phần B — Dòng gợi ý chuyển tiền (ngay dưới bảng)**

Bảng ở Phần A chỉ cho biết mỗi người thừa/thiếu bao nhiêu, chưa cho biết **chuyển cho ai**. Vì vậy ngay dưới bảng hiển thị danh sách gợi ý chuyển tiền, mỗi dòng dạng:

> `[avatar] B  →  [avatar] A   ¥1,000   [ Done ]`

- Thuật toán ghép: greedy, tối thiểu hóa số lần chuyển khoản (tối đa `n − 1` giao dịch) — xem mục 5 bước 3.
- **Mỗi dòng có checkbox/option Done riêng**, vì một người có thể phải trả cho nhiều người khác nhau.
- Trạng thái Done ở Phần A được suy ra từ các dòng này.

**Phần C — Hiệu ứng chúc mừng**

- Khi **tất cả** trạng thái trong bảng đều là Done: bắn **pháo hoa** (confetti/fireworks) và hiển thị dòng chữ **màu đỏ**: `Chúc mừng bạn đã có chuyến đi vui vẻ! またね!`
- Hiệu ứng chạy một lần tại thời điểm chuyển sang trạng thái hoàn tất (ghi `settledAt`), không chạy lại mỗi lần mở màn.
- Trường hợp đặc biệt: nếu không phát sinh giao dịch nào (mọi người đều có số dư 0) thì hiển thị "Mọi người đã chia đều rồi!" và vẫn bắn pháo hoa.

---

## 5. Công thức tính toán (phần quan trọng nhất)

Ký hiệu: `n` = số người tham gia; `total` = tổng tất cả khoản chi; `paid[i]` = tổng số tiền người `i` đã chi ra. Tất cả đều là số nguyên (JPY).

### Bước 1 — Suất phải gánh của mỗi người, xử lý tiền lẻ

```
base      = floor(total / n)
remainder = total - base * n          // 0 <= remainder < n

share[i] = base
// Phần lẻ: cộng thêm 1 yên cho đúng `remainder` người,
// xét theo thứ tự paid[i] giảm dần (tie-break: sortOrder tăng dần)
// → người đã chi nhiều nhất gánh phần lẻ
```

Cách này khiến `Σ share[i] === total` một cách chính xác, nên bảng quyết toán tự cân mà **không cần bước bù trừ nào**. Đây là lý do chọn nó thay vì làm tròn lên cho tất cả mọi người (làm tròn lên cho tất cả sẽ khiến tổng tiền phải trả nhiều hơn tổng tiền phải nhận, phải xử lý phần dôi ra bằng tay).

Ví dụ: `total = 10,000`, `n = 3` → `base = 3,333`, `remainder = 1` → `share = [3,334, 3,333, 3,333]`, người chi nhiều nhất gánh 3,334.

### Bước 2 — Số dư của mỗi người

```
balance[i] = paid[i] - share[i]

balance[i] > 0  →  NHẬN VỀ  (+, xanh lá)
balance[i] < 0  →  CẦN TRẢ  (−, đỏ)
balance[i] = 0  →  không nhận không trả, status = Done tự động
```

Bất biến bắt buộc kiểm tra bằng unit test: `Σ balance[i] === 0` với mọi bộ dữ liệu.

**Ví dụ 1 (chia hết):** A chi 5,000 (đồ ăn) + 2,000 (nước) = 7,000; B chi 2,000; C chi 0.
`total = 9,000`, `n = 3` → `share = 3,000` cho cả ba.
→ A: `7,000 − 3,000 = +4,000` (nhận về) · B: `2,000 − 3,000 = −1,000` (trả) · C: `0 − 3,000 = −3,000` (trả). Tổng = 0. ✔

**Ví dụ 2 (chia lẻ):** A chi 5,000; B chi 3,000; C chi 2,000.
`total = 10,000`, `n = 3` → `base = 3,333`, `remainder = 1` → A (chi nhiều nhất) gánh 3,334; B và C gánh 3,333.
→ A: `+1,666` · B: `−333` · C: `−1,333`. Tổng = 0. ✔

### Bước 3 — Ghép giao dịch (ai chuyển cho ai)

```
creditors = [i | balance[i] > 0], sắp xếp giảm dần theo balance (tie-break: sortOrder)
debtors   = [i | balance[i] < 0], sắp xếp giảm dần theo |balance| (tie-break: sortOrder)

while creditors và debtors đều còn phần tử:
    c = creditors[0]; d = debtors[0]
    amount = min(balance[c], -balance[d])
    → tạo giao dịch { from: d, to: c, amount }, transferKey = `${d.id}:${c.id}`
    balance[c] -= amount
    balance[d] += amount
    loại khỏi danh sách người nào có balance == 0
```

Tie-break phải cố định để thuật toán tất định, nhờ đó `transferKey` ổn định giữa các lần tính lại.

- Ví dụ 1 → `C → A ¥3,000`, `B → A ¥1,000`.
- Ví dụ 2 → `C → A ¥1,333`, `B → A ¥333`.

---

## 6. API (đề xuất)

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/events` | Tạo sự kiện (kèm participants), trả về `shareId` |
| GET | `/api/events/{shareId}` | Lấy toàn bộ dữ liệu sự kiện (participants, expenses, transferStatuses) |
| PATCH | `/api/events/{shareId}` | Sửa tên / ngày |
| DELETE | `/api/events/{shareId}` | Xóa sự kiện |
| POST | `/api/events/{shareId}/participants` | Thêm người tham gia |
| PATCH/DELETE | `/api/events/{shareId}/participants/{id}` | Sửa / xóa người tham gia |
| POST | `/api/events/{shareId}/expenses` | Thêm khoản chi |
| PATCH/DELETE | `/api/events/{shareId}/expenses/{id}` | Sửa / xóa khoản chi |
| PUT | `/api/events/{shareId}/transfers/{transferKey}` | Bật/tắt Done cho một giao dịch (kèm `dataVersion`) |

- Validate toàn bộ input ở server (zod hoặc tương đương), không tin client.
- Mọi thay đổi participants/expenses → server tăng `dataVersion`, xóa TransferStatus cũ, reset `settledAt`.
- `PUT transfers` gửi kèm `dataVersion`; nếu lệch với version hiện tại → trả 409 để client reload.
- Rate limit cơ bản theo IP để tránh spam tạo sự kiện.

---

## 7. Các trường hợp biên cần xử lý

1. Sự kiện chưa có khoản chi nào → disable nút Quyết toán.
2. Mọi người có số dư 0 → không có giao dịch nào, hiển thị "Mọi người đã chia đều rồi!".
3. Chỉ có 1 người tham gia → chặn ngay từ màn tạo sự kiện (tối thiểu 2 người).
4. Người tham gia không chi gì → vẫn xuất hiện trong bảng quyết toán với số dư âm.
5. Sửa/xóa khoản chi hoặc thêm người **sau khi** đã quyết toán → cảnh báo "Kết quả quyết toán sẽ được tính lại", reset toàn bộ trạng thái Done và `settledAt`.
6. Hai người cùng sửa một lúc → phát hiện qua `updatedAt` / `dataVersion`, hiện toast và reload.
7. `shareId` không tồn tại hoặc đã bị xóa → trang 404 thân thiện, kèm nút về Home.
8. Tên người trùng nhau trong cùng sự kiện → chặn khi nhập.
9. Số tiền rất lớn → dùng số nguyên, format dấu phân cách hàng nghìn.

---

## 8. Yêu cầu phi chức năng

- Mobile-first, thao tác được bằng một tay; vùng chạm tối thiểu 44×44px.
- Toàn bộ text UI bằng **tiếng Việt** (riêng dòng chúc mừng giữ nguyên `またね!`).
- Hàm tính quyết toán tách thành module thuần (`lib/settlement.ts`), dùng chung server và client, có unit test: phân bổ tiền lẻ, bất biến `Σ balance = 0`, tính tất định của thuật toán ghép, các trường hợp biên.
- Link chia sẻ không được index bởi search engine (`noindex`).

---

## 9. Đề xuất mở rộng (Phase 2 — chưa làm ở bản đầu)

- **Chia theo người thụ hưởng từng khoản**: mỗi khoản chi có thể chọn những ai cùng chia (mặc định là tất cả). Khi đó `share[i] = Σ (phần của người i trong từng khoản)` thay vì chia đều tổng. Nhu cầu rất hay gặp thực tế (có người không uống rượu, có người về sớm).
- **Chia theo tỉ lệ/hệ số** (trẻ em tính 0.5 suất).
- **Làm tròn theo mệnh giá lớn hơn** (10 yên / 100 yên) cho dễ chuyển khoản.
- Thông tin nhận tiền (QR code / link chuyển khoản) cho từng người được nhận về.
- Xuất ảnh/text kết quả quyết toán để gửi vào LINE/Zalo group.
- Nhiều loại tiền tệ.
