# Màn 03 — Chi tiết sự kiện: danh sách chi tiêu

**Route:** `/e/{shareId}`
Đây là màn trung tâm — nơi cả nhóm cùng nhập chi tiêu qua link chia sẻ.

---

## 1. Render & dữ liệu

- Vỏ trang là **Server Component**: đọc sự kiện qua Prisma theo `shareId`.
- Bảng chi tiêu là **client island** (`'use client'`) vì cần state, form và polling.
- `shareId` không tồn tại → trả về màn 404 ([05-not-found.md](05-not-found.md)).
- Metadata: **`noindex, nofollow`**.
- **Khi mở màn này lần đầu trên một máy → ghi `shareId` vào localStorage** (`lib/local-events.ts`), để sự kiện xuất hiện ở Home. Chạy ở client, sau khi biết chắc sự kiện tồn tại.
- Đồng bộ: refetch khi focus + polling ~10s + optimistic update — theo mục 3.5 của [00-index.md](00-index.md).

---

## 2. Layout

```
┌────────────────────────────────┐
│ ←  Nhậu tất niên          [🔗] │  ← tên sự kiện + nút Sao chép link
│    28/12/2025                  │
├────────────────────────────────┤
│ Tổng chi tiêu        ¥42,000   │  ← STICKY, font lớn, in đậm
├────────────────────────────────┤
│ 1  Quán nhậu tầng 2            │
│    ¥28,000        (人) An      │  ← tap để mở sheet sửa/xóa   
├────────────────────────────────┤
│ 2  Taxi về                     │
│    ¥6,000         (人) Bình    │
├────────────────────────────────┤
│ 3  Karaoke                     │
│    ¥8,000         (人) An      │
├────────────────────────────────┤
│         [ + Thêm khoản chi ]   │
│                                │
├────────────────────────────────┤
│ [         Quyết toán        ]  │  ← FIXED đáy màn, full-width
└────────────────────────────────┘
```

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

```
┌────────────────────────────────┐
│ ←  Sự kiện của tôi             │
│                                │
│ Nhậu tất niên          [🔗] [⋯]│  ← ⋯ là nút mới, 44×44
│ 28/12/2025 · 5 người           │
└────────────────────────────────┘
```

Tap `⋯` → **bottom sheet** (dùng lại đúng pattern sheet ở §5.4: scrim, radius `28px 28px 0 0`, handle, `wk-rise`) với hai mục:

| Mục | Việc xảy ra |
|---|---|
| **Sửa sự kiện** | Điều hướng `/e/{shareId}/edit` |
| **Xóa hẳn sự kiện** (chữ màu danger) | Mở dialog xác nhận bên dưới |

Xác nhận xóa hẳn:

> **Xóa hẳn "{tên sự kiện}"?**
> Toàn bộ khoản chi và kết quả quyết toán sẽ bị xóa. Link chia sẻ sẽ không dùng được nữa với **tất cả mọi người**. Không thể hoàn tác.
> `[ Hủy ]` `[ Xóa hẳn ]`

Xóa xong → `DELETE /api/events/{shareId}` → gỡ `shareId` khỏi localStorage → về Home kèm toast *"Đã xóa sự kiện"*.

> **Phần tạo hình là đề xuất của tôi, không phải của handoff.** Handoff không vẽ hai nút này. Tôi chọn nút `⋯` + bottom sheet thay vì dropdown vì handoff đã dùng bottom sheet ở chỗ khác và vùng chạm 44px dễ đạt hơn. Muốn đổi (ví dụ hai nút riêng, hay đặt cuối màn) thì báo.

---

## 4. Dòng Tổng chi tiêu (sticky)

- **Sticky** ngay dưới header, luôn thấy khi cuộn danh sách. Full-bleed, **nền gradient tối**, số tiền màu vàng `#FFD166` — chi tiết ở `design_handoff/README.md` mục "3. Event detail".
- Giá trị = **tổng tất cả khoản chi** của sự kiện, format `¥42,000`.
- Font **lớn, in đậm** — đây là con số người dùng liếc nhiều nhất.
- Cập nhật ngay theo optimistic update khi thêm/sửa/xóa khoản chi.
- Chưa có khoản chi nào → hiển thị `¥0`.

---

## 5. Danh sách chi tiêu

### 5.1. Bốn cột theo spec gốc

| STT | Tên đồ/việc đã chi | Số tiền | Người đã chi |
|---|---|---|---|

- **STT**: **tự sinh khi render**, đánh lại liên tục sau khi xóa dòng (1, 2, 3…). Không lưu STT vào DB — thứ tự đến từ `sortOrder`.
- **Tên đồ/việc**: bắt buộc.
- **Số tiền**: bắt buộc, **số nguyên dương** (> 0), `inputmode="numeric"`, tự format dấu phân cách hàng nghìn khi gõ.
- **Người đã chi**: bắt buộc, chọn bằng **chip pill có avatar** (không phải `select`), danh sách lấy từ participants **của chính sự kiện này**.

### 5.2. Dạng hiển thị theo bề ngang

- Màn hẹp (mặc định, 375–430px): render dạng **list/card**
  - Dòng 1: **tên khoản chi** (trái) + **số tiền** (căn phải)
  - Dòng 2: **avatar nhân vật + tên người đã chi**
  - STT đặt ở lề trái, cỡ nhỏ, màu nhạt
- Màn rộng hơn: được phép render đủ 4 cột dạng bảng.

### 5.3. Thao tác trên một dòng

**[ĐÃ CHỐT — theo `design_handoff`]** Chỉ có **một** thao tác: tap.

| Thao tác | Kết quả |
|---|---|
| **Tap vào card** | Mở **bottom sheet** ở chế độ sửa (prefill sẵn), trong sheet có nút **Xóa** viền danger |

> Spec cũ dùng **swipe-left để xóa**. Cử chỉ đó **đã bỏ** — handoff không thiết kế swipe, và việc gom Xóa vào trong sheet tránh được xóa nhầm do vuốt.

### 5.4. Bottom sheet — thêm / sửa khoản chi

**[ĐÃ CHỐT — theo `design_handoff`]** Là **bottom sheet**, không phải inline form. Scrim, radius, handle, animation `wk-rise`: xem `README.md` mục "5. Bottom sheet".

```
────────  (handle 44×4)
Thêm khoản chi                    [ Xóa ]   ← nút Xóa chỉ có ở chế độ sửa
[ VD: Tiền đồ nướng                       ]
[ ¥  28,000                               ]  ← prefix ¥ tuyệt đối trái
Ai đã chi?
( (人) An )  ( (人) Bình )  ( (人) Cường )   ← chip pill 44px, chip chọn: viền coral 2px
[            Lưu khoản chi                ]
```

- Chọn người đã chi bằng **chip pill**, không phải `select` dropdown.
- Scrim click → đóng sheet.
- Rời màn (back về event/home) → **luôn clear sheet**, không để sheet rò rỉ sang màn khác.

Validate:

| Điều kiện | Thông báo |
|---|---|
| Tên rỗng sau trim | Hãy nhập tên đồ/việc đã chi. |
| Số tiền rỗng / không phải số | Hãy nhập số tiền. |
| Số tiền ≤ 0 | Số tiền phải lớn hơn 0. |
| Số tiền có phần thập phân | Chỉ nhập số nguyên (JPY). |
| Chưa chọn người đã chi | Hãy chọn người đã chi. |

- Validate lại toàn bộ ở server bằng **zod**.
- Lỗi validate hiện dạng khối inline trong sheet (bg `#FFECEE`, chữ `#C2374B`), không dùng toast.
- **Lưu thành công → đóng sheet + toast** (*"Đã thêm khoản chi"* / *"Đã lưu"*). Spec cũ nói giữ sheet mở để nhập tiếp — **đã bỏ**, handoff chốt đóng sheet.

---

## 6. Nút "Quyết toán"

- **Fixed ở đáy màn hình**, **full-width**, luôn thấy.
- **Disable khi chưa có khoản chi nào** (edge case 1 của prompt gốc). Khi disable, hiện chú thích nhỏ: *"Thêm ít nhất một khoản chi để quyết toán."*
- Tap → `/e/{shareId}/settlement`.
- Nếu sự kiện đã có `settledAt != null`, nhãn nút đổi thành **"Xem quyết toán"**.

---

## 7. Hệ quả lên dữ liệu quyết toán

**Mọi thao tác thêm / sửa / xóa khoản chi** đều phải khiến server, trong **cùng một transaction**:

1. Tăng `event.dataVersion`
2. Xóa toàn bộ `TransferStatus` của event
3. Set `event.settledAt = null`

Phía UI: nếu sự kiện **đã quyết toán xong** (`settledAt != null`) mà người dùng định sửa chi tiêu → xác nhận trước:

> **Kết quả quyết toán sẽ được tính lại**
> Toàn bộ đánh dấu "Done" hiện có sẽ bị xóa.
> `[ Hủy ]` `[ Vẫn sửa ]`

---

## 8. Các trạng thái của màn

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | Skeleton: dòng tổng chi + 3 dòng chi tiêu |
| **Rỗng** (chưa có khoản chi) | Minh họa nhỏ + *"Chưa có khoản chi nào. Thêm khoản đầu tiên nhé!"* + nút **+ Thêm khoản chi**. Nút Quyết toán disable. |
| Đang lưu | Dòng vừa thêm hiện mờ (optimistic) tới khi server xác nhận |
| Lỗi khi lưu | Rollback dòng optimistic + toast đỏ + giữ nguyên nội dung form để không mất công gõ lại |
| Người khác vừa sửa | Toast *"Dữ liệu vừa được người khác cập nhật"* + reload danh sách |
| shareId không tồn tại | Màn 404 |

---

## 9. Edge case

| # | Tình huống | Xử lý |
|---|---|---|
| 1 | Xóa dòng giữa danh sách | STT đánh lại liên tục, không để lỗ hổng |
| 2 | Số tiền rất lớn | Dùng số nguyên, format dấu phân cách; không dùng float ở bất kỳ đâu |
| 3 | Người đã chi bị xóa khỏi sự kiện | Không xảy ra — server chặn xóa participant còn khoản chi (xem [02-event-form.md](02-event-form.md) §5.4) |
| 4 | Hai người cùng thêm khoản chi | Cả hai đều được ghi; polling kéo về đủ. Last-write-wins chỉ áp dụng khi sửa **cùng một** khoản chi |
| 5 | Đang mở form sửa thì dòng đó bị người khác xóa | Khi submit nhận 404 → toast *"Khoản chi này vừa bị xóa"* + đóng form + reload |
| 6 | Mất mạng giữa chừng | Optimistic update rollback, toast lỗi + nút Thử lại |

---

## 10. API dùng tới

| Method | Endpoint | Dùng cho |
|---|---|---|
| GET | `/api/events/{shareId}` | Nạp event + participants + expenses + transferStatuses |
| POST | `/api/events/{shareId}/expenses` | Thêm khoản chi |
| PATCH | `/api/events/{shareId}/expenses/{id}` | Sửa khoản chi |
| DELETE | `/api/events/{shareId}/expenses/{id}` | Xóa khoản chi |
