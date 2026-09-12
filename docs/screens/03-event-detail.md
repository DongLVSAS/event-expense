# Màn 03 — Chi tiết sự kiện: hai tab "Cần chi" / "Đã chi"

**Route:** `/e/{shareId}`
Đây là màn trung tâm — nơi cả nhóm cùng lên danh sách món **cần mua** và ghi các khoản **đã chi** qua link chia sẻ.

---

## 1. Render & dữ liệu

- Vỏ trang là **Server Component**: đọc sự kiện qua Prisma theo `shareId`.
- Phần tab là **client island** (`'use client'`) vì cần state, sheet và polling.
- `shareId` không tồn tại → trả về màn 404 ([05-not-found.md](05-not-found.md)).
- Metadata: **`noindex, nofollow`**.
- **Khi mở màn này lần đầu trên một máy → ghi `shareId` vào localStorage** (`lib/local-events.ts`), để sự kiện xuất hiện ở Home. Chạy ở client, sau khi biết chắc sự kiện tồn tại.
- Đồng bộ: refetch khi focus + polling ~10s + optimistic update — theo mục 3.5 của [00-index.md](00-index.md).

### 1.1. Hai loại dữ liệu tách bạch

| | **Todo** (tab Cần chi) | **Expense** (tab Đã chi) |
|---|---|---|
| Nội dung | chỉ `title` + `bought` | `title` + `amount` + `payerId` |
| Có số tiền? | **Không** | Có, số nguyên JPY > 0 |
| Có người chi? | **Không** | Có, bắt buộc |
| Ảnh hưởng quyết toán? | **Không bao giờ** | Có |
| Đổi `dataVersion`? | **Không** | Có, mọi thao tác |

**Đây là điểm dễ sai nhất của tính năng này.** Todo chỉ là danh sách nhắc nhau cần mua gì; tick "đã mua" **không** tạo khoản chi, **không** đụng tới `TransferStatus` hay `settledAt`. Ai mua xong rồi muốn ghi tiền thì tự thêm một khoản chi ở tab "Đã chi" — hai việc độc lập, cố ý không tự động nối với nhau.

### 1.2. Mô hình dữ liệu bổ sung

```
Todo {
  id: string
  eventId: string
  title: string          // bắt buộc, không có amount, không có payer
  bought: boolean        // mặc định false
  sortOrder: int         // thứ tự hiển thị
  createdAt
}
```

Quan hệ `Todo.eventId → Event.id`, **ON DELETE CASCADE** (xóa hẳn sự kiện thì dọn theo). Không có khóa ngoại nào tới `Participant` — Todo cố ý không biết ai mua.

---

## 2. Layout

```
┌────────────────────────────────┐
│ ←  Sự kiện của tôi             │
│ Nhậu tất niên          [🔗] [⋯]│
│ 28/12/2025 · 5 người           │
│                                │
│ (人) (人) (人) (人) (人)        │  ← avatar strip
│  An  Bình Cường Dung  Em       │
├────────────────────────────────┤
│ ┌────────────┬───────────────┐ │
│ │ Cần chi 3/4│    Đã chi 3   │ │  ← segmented control, mặc định tab 1
│ └────────────┴───────────────┘ │
├────────────────────────────────┤
│ [ VD: Than nướng, đá lạnh… ][＋]│  ← chỉ có ở tab "Cần chi"
│ ┌────────────────────────────┐ │
│ │ [✓] Than nướng    Đã mua ✕ │ │  ← nền xanh lá, chữ gạch ngang
│ ├────────────────────────────┤ │
│ │ [ ] Đá lạnh              ✕ │ │
│ └────────────────────────────┘ │
├────────────────────────────────┤
│ [         Quyết toán →       ] │  ← FIXED đáy màn, hiện ở CẢ HAI tab
└────────────────────────────────┘
```

Chuyển sang tab "Đã chi" thì vùng giữa đổi thành dòng tổng chi tiêu (sticky) + danh sách khoản chi + nút "＋ Thêm khoản chi" — xem §6.

---

## 3. Header

| Thành phần | Hành vi |
|---|---|
| Nút `←` | Về Home (`/`) |
| Tên sự kiện | Từ `event.name`, 1 dòng, tràn thì `…` |
| Ngày | `DD/MM/YYYY` |
| **Sao chép link chia sẻ** | Copy `https://{domain}/e/{shareId}` vào clipboard + toast *"Đã sao chép link"*. Vùng chạm ≥ 44×44px. |

### 3.1. Nút `⋯` — Sửa / Xóa hẳn sự kiện

**[ĐÃ CHỐT]** Hai năng lực này đặt ở **header màn chi tiết sự kiện**. Đây là chỗ duy nhất hợp lý: người mở qua link chia sẻ không đi qua Home, còn Home thì handoff đã chốt chỉ có 2 nút (xem [01-home.md](01-home.md) §4).

Tap `⋯` → **bottom sheet** (dùng lại đúng pattern sheet ở §6.4: scrim, radius `28px 28px 0 0`, handle, `wk-rise`) với hai mục:

| Mục | Việc xảy ra |
|---|---|
| **Sửa sự kiện** | Điều hướng `/e/{shareId}/edit` |
| **Xóa hẳn sự kiện** (chữ màu danger) | Mở dialog xác nhận bên dưới |

Xác nhận xóa hẳn:

> **Xóa hẳn "{tên sự kiện}"?**
> Toàn bộ khoản chi và kết quả quyết toán sẽ bị xóa. Link chia sẻ sẽ không dùng được nữa với **tất cả mọi người**. Không thể hoàn tác.
> `[ Hủy ]` `[ Xóa hẳn ]`

Xóa xong → `DELETE /api/events/{shareId}` → gỡ `shareId` khỏi localStorage → về Home kèm toast *"Đã xóa sự kiện"*.

> **Phần tạo hình là đề xuất của tôi, không phải của handoff.** Handoff không vẽ hai nút này. Tôi chọn nút `⋯` + bottom sheet vì handoff đã dùng bottom sheet ở chỗ khác và vùng chạm 44px dễ đạt hơn dropdown.

---

## 4. Tab bar

Segmented control đặt **ngay dưới avatar strip**. Kích thước, màu, shadow: **theo `design_handoff/README.md` mục "3. Event detail" → "Tab bar"** — không chép lại vào đây.

| | Tab 1 | Tab 2 |
|---|---|---|
| Nhãn | **Cần chi** | **Đã chi** |
| Giá trị state | `todo` | `paid` |
| Mặc định khi mở màn | **✓ đây là tab mặc định** | |
| Counter | `đã mua/tổng`, ví dụ `3/4` — **ẩn khi danh sách rỗng** | số khoản chi |

- Tab là **state ở client**, không phải route riêng. Không thêm `?tab=` vào URL: link chia sẻ phải luôn mở ra cùng một thứ cho mọi người.
- Chuyển tab **không** gọi API, **không** mất dữ liệu đang gõ ở tab kia.
- Vùng chạm mỗi tab ≥ 44px.

---

## 5. Tab 1 — "Cần chi"

Danh sách những món **cần mua**, dùng khi nhóm mới lên kế hoạch và chưa biết giá. **Không có số tiền, không có người chi.**

### 5.1. Hàng thêm nhanh

- Input (placeholder `VD: Than nướng, đá lạnh…`) + nút vuông teal **`＋`**.
- **Enter** cũng thêm.
- Chuỗi rỗng sau trim → bỏ qua im lặng, **không báo lỗi** (đây là ghi chú nhanh, không phải form).
- Thêm xong giữ focus để gõ tiếp món kế.

### 5.2. Một dòng trong danh sách

```
[✓] Than nướng                    Đã mua   ✕
```

| Thành phần | Ghi chú |
|---|---|
| Nút tick 30×30 | Toggle `bought`. Vùng chạm phủ ≥ 44px |
| Tên món | Nunito 700. Đã mua → gạch ngang + đổi màu |
| Nhãn "Đã mua" | Pill, **chỉ hiện khi đã tick** |
| Nút `✕` | Xóa khỏi checklist |

**Trạng thái đã mua đổi nền cả thẻ sang xanh lá** — màu cụ thể ở handoff. Đây là tín hiệu chính, không chỉ dựa vào dấu tick.

### 5.3. Hành vi

- Tick là **toggle thuần**: tick rồi bỏ tick lại được.
- **Không có toast** cho thêm / tick / xóa món — thao tác nhẹ, phản hồi đã nằm ngay trên thẻ.
- **Không đụng tới quyết toán**: không tăng `dataVersion`, không xóa `TransferStatus`, không reset `settledAt`. Vì vậy cũng **không** hiện dialog *"Kết quả quyết toán sẽ được tính lại"* dù sự kiện đã xong.
- Không giới hạn số món.

### 5.4. Trạng thái rỗng

Khung dashed:

> **Chưa có gì trong danh sách cần chi.**
> Ghi trước những món cần mua, tick khi đã mua xong.

### 5.5. Footnote

Dưới danh sách, chữ nhạt:

> Danh sách này chỉ để nhắc nhau cần mua gì — số tiền ghi ở tab "Đã chi".

Dòng này quan trọng: nó là thứ ngăn người dùng tưởng tick "đã mua" sẽ tự ghi tiền.

---

## 6. Tab 2 — "Đã chi"

Đây chính là nội dung màn chi tiêu như trước khi có tab.

### 6.1. Dòng Tổng chi tiêu (sticky)

- **Sticky** ngay dưới tab bar, luôn thấy khi cuộn. Full-bleed, **nền gradient tối**, số tiền màu vàng `#FFD166` — chi tiết ở handoff.
- Giá trị = **tổng tất cả khoản chi**, format `¥42,000`.
- **Chỉ render trong tab này.** Sang tab "Cần chi" thì biến mất.
- Chưa có khoản chi nào → hiển thị `¥0`.

### 6.2. Một dòng chi tiêu

| STT | Tên đồ/việc đã chi | Số tiền | Người đã chi |
|---|---|---|---|

- **STT**: **tự sinh khi render**, đánh lại liên tục sau khi xóa dòng. Không lưu vào DB — thứ tự đến từ `sortOrder`.
- **Số tiền**: **số nguyên dương** (> 0), `inputmode="numeric"`, tự format dấu phân cách hàng nghìn.
- **Người đã chi**: bắt buộc, chọn bằng **chip pill có avatar**, danh sách lấy từ participants **của chính sự kiện này**.
- Màn hẹp render dạng card: dòng 1 tên + số tiền (căn phải), dòng 2 avatar + tên người đã chi.

### 6.3. Thao tác trên một dòng

**[ĐÃ CHỐT — theo `design_handoff`]** Chỉ có **một** thao tác: tap vào card → mở **bottom sheet** ở chế độ sửa (prefill sẵn), trong sheet có nút **Xóa** viền danger.

> Spec cũ dùng **swipe-left để xóa**. Cử chỉ đó **đã bỏ**.

### 6.4. Bottom sheet — thêm / sửa khoản chi

```
────────  (handle 44×4)
Thêm khoản chi                    [ Xóa ]   ← nút Xóa chỉ có ở chế độ sửa
[ VD: Tiền đồ nướng                       ]
[ ¥  28,000                               ]  ← prefix ¥ tuyệt đối trái
Ai đã chi?
( (人) An )  ( (人) Bình )  ( (人) Cường )   ← chip pill 44px, chip chọn: viền coral 2px
[            Lưu khoản chi                ]
```

- Scrim click → đóng sheet. Rời màn → **luôn clear sheet**.

Validate:

| Điều kiện | Thông báo |
|---|---|
| Tên rỗng sau trim | Hãy nhập tên đồ/việc đã chi. |
| Số tiền rỗng / không phải số | Hãy nhập số tiền. |
| Số tiền ≤ 0 | Số tiền phải lớn hơn 0. |
| Số tiền có phần thập phân | Chỉ nhập số nguyên (JPY). |
| Chưa chọn người đã chi | Hãy chọn người đã chi. |

- Validate lại toàn bộ ở server bằng **zod**.
- Lỗi hiện dạng khối inline trong sheet, không dùng toast.
- **Lưu thành công → đóng sheet + toast.**

---

## 7. Nút "Quyết toán"

- **Fixed ở đáy màn hình**, full-width, **chỉ hiện ở tab "Đã chi"**.
- **Disable khi chưa có khoản chi nào** — xét theo `expenses`, **không** tính todo. Một sự kiện có 10 món cần chi nhưng chưa ghi khoản chi nào thì vẫn chưa quyết toán được.
- Khi disable, chú thích nhỏ: *"Thêm ít nhất một khoản chi để quyết toán."*
- Nếu `settledAt != null`, nhãn đổi thành **"Xem quyết toán"**.

> **[ĐÃ CHỐT — đè lên handoff]** Handoff mục "3. Event detail" ghi *"CTA 'Quyết toán →' ở đáy màn hiển thị ở cả 2 tab"*. Chủ dự án chốt lại: **chỉ tab "Đã chi"**. Lý do hợp lý: tab "Cần chi" không có số tiền nào, đặt nút quyết toán ở đó dễ khiến người dùng tưởng danh sách cần mua cũng được tính tiền.

### 7.1. Chốt chặn trước khi sang màn quyết toán

Khi nhấn nút, client kiểm mọi khoản chi có số tiền hợp lệ (`Number.isInteger(amount) && amount > 0`) **trước khi** điều hướng. Nếu có khoản không đạt:

1. Toast: *"Khoản này chưa có số tiền — điền nốt rồi mới quyết toán được"*
2. **Cuộn tới đúng khoản đó** (`scrollIntoView`, căn giữa màn)
3. Làm nổi thẻ đó bằng viền danger trong ~2,6 giây
4. **Không** điều hướng

**Với luật hiện tại, nhánh này không bao giờ chạy**: `Expense.amount` là `Int NOT NULL`, zod chặn số thực và số `≤ 0`, nên không có đường nào tạo ra khoản chi thiếu tiền. Đây là **chốt đề phòng** theo yêu cầu của chủ dự án, giữ cho trường hợp sau này nới luật (ví dụ cho phép nhập tên trước, điền tiền sau).

Vì sao đáng giữ dù là code chết: `lib/settlement.ts` **ném lỗi** khi gặp `amount` không phải số nguyên dương. Không có chốt này, một khoản thiếu tiền sẽ làm **vỡ cả màn quyết toán** thay vì báo cho người dùng biết cần sửa ở đâu.

---

## 8. Hệ quả lên dữ liệu quyết toán

**Chỉ thao tác với khoản chi (Expense) mới kéo theo**, trong **cùng một transaction**:

1. Tăng `event.dataVersion`
2. Xóa toàn bộ `TransferStatus` của event
3. Set `event.settledAt = null`

**Thao tác với Todo KHÔNG làm gì trong số này.**

Phía UI: nếu sự kiện **đã quyết toán xong** mà người dùng định sửa **chi tiêu** → xác nhận trước:

> **Kết quả quyết toán sẽ được tính lại**
> Toàn bộ đánh dấu "Done" hiện có sẽ bị xóa.
> `[ Hủy ]` `[ Vẫn sửa ]`

Sửa **todo** thì không hỏi gì.

---

## 9. Các trạng thái của màn

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | Skeleton đúng hình dạng tab đang mở |
| **Tab Cần chi rỗng** | Khung dashed, xem §5.4 |
| **Tab Đã chi rỗng** | Khung dashed + *"Chưa có khoản chi nào. Thêm khoản đầu tiên nhé!"*. Nút Quyết toán disable |
| Đang lưu | Dòng vừa thêm hiện mờ (optimistic) tới khi server xác nhận |
| Lỗi khi lưu | Rollback dòng optimistic + toast đỏ + giữ nguyên nội dung đang gõ |
| Người khác vừa sửa | Toast *"Dữ liệu vừa được người khác cập nhật"* + reload |
| shareId không tồn tại | Màn 404 |

---

## 10. Edge case

| # | Tình huống | Xử lý |
|---|---|---|
| 1 | Xóa dòng giữa danh sách | STT đánh lại liên tục, không để lỗ hổng |
| 2 | Số tiền rất lớn | Số nguyên + dấu phân cách; không dùng float ở bất kỳ đâu |
| 3 | Người đã chi bị xóa khỏi sự kiện | Không xảy ra — server chặn xóa participant còn khoản chi ([02](02-event-form.md) §5.4) |
| 4 | Hai người cùng thêm khoản chi | Cả hai đều được ghi; polling kéo về đủ |
| 5 | Đang mở sheet sửa thì dòng đó bị người khác xóa | Submit nhận 404 → toast *"Khoản chi này vừa bị xóa"* + đóng sheet + reload |
| 6 | Mất mạng giữa chừng | Optimistic update rollback, toast lỗi |
| 7 | **Hai người cùng tick một món todo** | Last-write-wins, không cần 409 — `bought` là boolean, hội tụ về cùng giá trị sau polling |
| 8 | **Tick todo khi sự kiện đã quyết toán xong** | Cho phép, không cảnh báo, không reset gì. Todo nằm ngoài phép tính |
| 9 | **Xóa hẳn sự kiện** | Todo bị dọn theo bằng CASCADE |

---

## 11. API dùng tới

| Method | Endpoint | Dùng cho |
|---|---|---|
| GET | `/api/events/{shareId}` | Nạp event + participants + expenses + **todos** + transferStatuses |
| POST | `/api/events/{shareId}/expenses` | Thêm khoản chi |
| PATCH | `/api/events/{shareId}/expenses/{id}` | Sửa khoản chi |
| DELETE | `/api/events/{shareId}/expenses/{id}` | Xóa khoản chi |
| POST | `/api/events/{shareId}/todos` | Thêm món cần chi |
| PATCH | `/api/events/{shareId}/todos/{id}` | Tick/bỏ tick `bought` |
| DELETE | `/api/events/{shareId}/todos/{id}` | Xóa món cần chi |

Ba endpoint `todos` **không** đi qua `mutateEventData()` — đó là helper reset quyết toán, dùng nhầm sẽ xóa oan đánh dấu Done của mọi người.
