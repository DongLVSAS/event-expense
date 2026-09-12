# Màn 02 — Tạo / Sửa sự kiện

**Route:** `/new` (tạo) · `/e/{shareId}/edit` (sửa) — **[ĐÃ CHỐT]**.
Dùng chung một component form, khác nhau ở dữ liệu khởi tạo và endpoint submit.

---

## 1. Khác biệt giữa hai chế độ

| | Tạo (`/new`) | Sửa (`/e/{shareId}/edit`) |
|---|---|---|
| Dữ liệu ban đầu | Rỗng; ngày mặc định = **hôm nay** | Nạp từ `GET /api/events/{shareId}` |
| Submit | `POST /api/events` (kèm participants) | `PATCH /api/events/{shareId}` + API participants riêng lẻ |
| Sau khi xong | Hiện **link chia sẻ** (mục 6) rồi vào `/e/{shareId}` | Quay lại `/e/{shareId}` |
| Thêm/xóa người | Chỉ nằm trong state client tới lúc submit | **Mỗi thao tác gọi API ngay** → kéo theo reset quyết toán (mục 7) |
| Nút hủy | Về Home | Về `/e/{shareId}` |

---

## 2. Layout

```
┌────────────────────────────────┐
│ ←   Tạo sự kiện                │
├────────────────────────────────┤
│ Tên sự kiện *                  │
│ ┌────────────────────────────┐ │
│ │ Nhậu tất niên              │ │
│ └────────────────────────────┘ │
│                                │
│ Ngày diễn ra *                 │
│ ┌────────────────────────────┐ │
│ │ 28/12/2025            📅   │ │
│ └────────────────────────────┘ │
│                                │
│ Người tham gia *      (5)  [+] │  ← nút + mở ô nhập tên
│ ┌────────────────────────────┐ │
│ │  (人)   (人)   (人)   (人)  │ │  ← nhân vật đứng thành hàng,
│ │  An     Bình   Cường  Dung │ │     tên ngay dưới chân, tự xuống dòng
│ │  (人)                      │ │
│ │  Em                        │ │
│ └────────────────────────────┘ │
│ Tối thiểu 2 người.             │
├────────────────────────────────┤
│ [        Tạo sự kiện        ]  │  ← fixed đáy màn, full-width
└────────────────────────────────┘
```

---

## 3. Trường: Tên sự kiện

- Bắt buộc. Text 1 dòng.
- Trim khoảng trắng đầu/cuối trước khi lưu.
- Rỗng sau khi trim → lỗi dưới field: *"Hãy nhập tên sự kiện."*
- **[ĐỀ XUẤT]** giới hạn 100 ký tự, cắt ở client + chặn ở zod phía server.

## 4. Trường: Ngày diễn ra

- Bắt buộc. Kiểu `YYYY-MM-DD` (date, không có giờ).
- Mặc định khi tạo: **hôm nay** (theo giờ máy người dùng).
- Dùng `<input type="date">` để mobile bung date picker native.
- Không hợp lệ / rỗng → *"Hãy chọn ngày diễn ra."*
- **Cho phép ngày quá khứ và tương lai** — người ta thường nhập lại sau buổi đi chơi.

---

## 5. Khối: Người tham gia

### 5.1. Thêm người

- Nút **`+`** mở một ô nhập tên (inline, tự focus).
- Enter hoặc nút "Thêm" → tạo người mới; ô nhập **giữ nguyên focus** để gõ tiếp người kế.
- Khi thêm, hệ thống **tự random một `characterId`** từ danh sách nhân vật.

### 5.2. Quy tắc gán nhân vật

**[ĐÃ CHỐT — theo `design_handoff`]** Có đúng **10 nhân vật**: `cat, bunny, frog, penguin, bear, pig, panda, koala, fox, puppy`. Ảnh PNG 1024×1024 nền trong suốt ở `docs/design_handoff/assets/`, mỗi con có một màu nền pastel riêng (bảng màu ở `README.md` mục Design Tokens).

- Nhân vật **không bao giờ trùng nhau** trong cùng một sự kiện.
- Vì chỉ có 10 nhân vật → **tối đa 10 người** mỗi sự kiện. Không có cơ chế lặp lại nhân vật.
- `characterId` đã gán được **lưu cố định** vào DB — không đổi khi re-render, reload, hay khi người khác mở link.
- **Tap vào nhân vật** → re-roll sang một nhân vật **chưa dùng trong sự kiện đó**.
- Khai báo tập trung qua `characters.ts` (id, tên file ảnh, màu nền pastel); mọi màn đọc từ đó, không hardcode rải rác.

> Trước đây spec cho phép lặp nhân vật khi vượt số lượng, phân biệt bằng màu viền. Quy tắc đó **đã bỏ** — handoff chốt trần 10 người.

### 5.3. Hiển thị

Kích thước, màu, radius cụ thể: **theo `docs/design_handoff/README.md` mục "2. Create / Edit event"** — không chép lại vào đây để tránh lệch.

- Các nhân vật xếp **thành hàng ngang**, tự xuống dòng khi đầy (wrap), trong vùng nền `#FFF3E7`.
- **Tên người hiển thị ngay dưới chân nhân vật**, căn giữa theo nhân vật.
- Tên dài → cắt bằng `…`, giữ nguyên chiều rộng ô để hàng không xô lệch.
- Hiển thị **counter `n/10 người`** để người dùng thấy trần trước khi chạm vào nó.

### 5.4. Xóa người

- Nút xóa nhỏ (`×`) ở góc nhân vật, hoặc long-press → menu. Vùng chạm vẫn ≥ 44×44px.
- **Chặn xóa nếu người đó đang gắn với ít nhất một khoản chi**, hiện cảnh báo nguyên văn:

  > *Không thể xóa vì đã có khoản chi ghi nhận cho người này*

  Phải kiểm tra **cả ở client và ở server** — server là nơi quyết định.
- Nếu xóa xuống còn dưới 2 người → chặn, hiện *"Sự kiện cần tối thiểu 2 người tham gia."*

### 5.5. Sửa tên người

Tap vào tên → sửa inline. Áp dụng cùng quy tắc validate như khi thêm.

---

## 6. Validate khi submit

| Điều kiện | Thông báo lỗi |
|---|---|
| Tên sự kiện rỗng | Hãy nhập tên sự kiện. |
| Ngày không hợp lệ | Hãy chọn ngày diễn ra. |
| < 2 người tham gia | Sự kiện cần tối thiểu 2 người tham gia. |
| **> 10 người tham gia** | Một sự kiện tối đa 10 người. |
| Tên người rỗng | Hãy nhập tên người tham gia. |
| Tên người trùng nhau trong cùng sự kiện | Tên "{tên}" đã có rồi. |

- So trùng tên: sau khi trim, **không phân biệt hoa/thường**.
- Toàn bộ điều kiện trên **phải được validate lại ở server bằng zod**. Client validate chỉ để phản hồi nhanh.
- Nút submit disable khi form chưa hợp lệ; lỗi hiện ngay dưới field, không dùng toast.

---

## 7. Sau khi tạo xong — màn link chia sẻ

Ngay sau khi `POST /api/events` thành công, hiển thị (bottom sheet hoặc màn chen giữa):

```
┌────────────────────────────────┐
│        Đã tạo sự kiện!         │
│                                │
│  Gửi link này cho cả nhóm để   │
│  mọi người cùng nhập chi tiêu. │
│ ┌────────────────────────────┐ │
│ │ https://.../e/V1StGXR8_Z5j │ │
│ └────────────────────────────┘ │
│  [   Sao chép link chia sẻ   ] │
│  [   Vào sự kiện             ] │
└────────────────────────────────┘
```

- Nhấn "Sao chép link chia sẻ" → copy vào clipboard + toast *"Đã sao chép link"*.
- `shareId` do server sinh (nanoid 16–21 ký tự, khó đoán).
- Đồng thời **ghi `shareId` vào localStorage** của máy đang tạo.

---

## 8. Chế độ sửa — hệ quả lên quyết toán

Đây là phần dễ sai nhất của màn này.

- Sửa **tên sự kiện** hoặc **ngày** → **không** ảnh hưởng quyết toán, **không** tăng `dataVersion`.
- Thêm / sửa / xóa **người tham gia** → **có** ảnh hưởng. Server phải làm trong **cùng một transaction**:
  1. Tăng `event.dataVersion`
  2. Xóa toàn bộ `TransferStatus` của event
  3. Set `event.settledAt = null`
- Nếu sự kiện **đã quyết toán xong** (`settledAt != null`) mà người dùng định đổi danh sách người tham gia → hiện xác nhận trước:

  > **Kết quả quyết toán sẽ được tính lại**
  > Toàn bộ đánh dấu "Done" hiện có sẽ bị xóa.
  > `[ Hủy ]` `[ Vẫn sửa ]`

---

## 9. API dùng tới

| Method | Endpoint | Dùng cho |
|---|---|---|
| POST | `/api/events` | Tạo sự kiện kèm participants, trả `shareId` |
| GET | `/api/events/{shareId}` | Nạp dữ liệu ở chế độ sửa |
| PATCH | `/api/events/{shareId}` | Sửa tên / ngày |
| POST | `/api/events/{shareId}/participants` | Thêm người (chế độ sửa) |
| PATCH | `/api/events/{shareId}/participants/{id}` | Sửa tên / re-roll nhân vật |
| DELETE | `/api/events/{shareId}/participants/{id}` | Xóa người — server chặn nếu còn khoản chi |

Server có **rate limit theo IP** ở `POST /api/events` để tránh spam tạo sự kiện.
