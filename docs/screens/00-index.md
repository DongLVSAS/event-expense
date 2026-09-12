# Spec màn hình — Tổng quan & quy ước chung

Nguồn gốc: `docs/warikan-app-prompt.md`. File này mô tả **UI và hành vi** của từng màn.
Công thức tính toán **không lặp lại ở đây** — xem mục 5 của prompt gốc và `lib/settlement.ts`.

> Khi spec màn hình mâu thuẫn với `CLAUDE.md` hoặc prompt gốc → **hỏi lại chủ dự án**, không tự quyết.

---

## 1. Bảng route

| Route | Màn | File spec | Render |
|---|---|---|---|
| `/` | Home — danh sách sự kiện | [01-home.md](01-home.md) | Client (đọc localStorage) |
| `/new` | Tạo sự kiện | [02-event-form.md](02-event-form.md) | Client form → POST |
| `/e/{shareId}` | Chi tiết sự kiện — danh sách chi tiêu | [03-event-detail.md](03-event-detail.md) | Server Component + client island |
| `/e/{shareId}/edit` | Sửa sự kiện (tên, ngày, người tham gia) | [02-event-form.md](02-event-form.md) | Client form → PATCH |
| `/e/{shareId}/settlement` | Quyết toán | [04-settlement.md](04-settlement.md) | Server Component + client island |
| `*` (shareId sai/đã xóa) | 404 thân thiện | [05-not-found.md](05-not-found.md) | Server |

**[ĐÃ CHỐT]** Route màn tạo/sửa là `/new` và `/e/{shareId}/edit`. Prompt gốc không đặt tên cho hai route này và `CLAUDE.md` mới chỉ liệt kê 3 route — khi cập nhật `CLAUDE.md` nhớ bổ sung chúng vào mục Cấu trúc thư mục.

---

## 2. Sơ đồ điều hướng

```
        ┌──────────────────────── / (Home) ────────────────────────┐
        │  FAB "+ Tạo sự kiện"          tap item        menu "..." │
        │         │                        │                  │   │
        ▼         ▼                        ▼                  ▼   │
     /new ──POST──► /e/{shareId} ◄──────────┘        sửa ─► /e/{id}/edit
                         │                           xóa khỏi máy ─┘ (ở lại Home)
                         │  nút "Quyết toán" (fixed đáy màn)        xóa hẳn ────┘
                         ▼
              /e/{shareId}/settlement
                         │  nút "← Quay lại danh sách chi tiêu"
                         └──────────► /e/{shareId}

  shareId không tồn tại / đã xóa ─────► 404 ─── nút "Về trang chủ" ──► /
```

Mở link `/e/{shareId}` lần đầu trên một máy → **tự động thêm `shareId` vào localStorage** của máy đó (xem `lib/local-events.ts`), để lần sau nó xuất hiện ở Home.

---

## 3. Quy ước chung (áp dụng cho mọi màn)

> **Giao diện lấy từ đâu.** Màu, typography, spacing, radius, shadow, animation, copy và cử chỉ tương tác — **nguồn duy nhất là `docs/design_handoff/README.md`**. Các file spec màn hình ở đây **không chép lại** giá trị token; chỗ nào cần thì trỏ sang mục tương ứng của handoff. Prototype `design_handoff/prototype/*.dc.html` mở được trực tiếp trong browser để xem chạy thật — dùng làm tham chiếu để dựng lại, **không copy làm code production**.
>
> Phần dưới đây là **quy ước nghiệp vụ** dùng chung, handoff không phủ.

### 3.1. Hiển thị tiền

- Luôn là **số nguyên JPY**. Không có phần thập phân ở bất kỳ đâu.
- Format hiển thị: `¥12,000` — ký hiệu `¥` liền trước, dấu `,` phân cách hàng nghìn.
- Riêng cột số dư ở màn quyết toán hiển thị **không có `¥`** mà có dấu: `+20,000` / `-10,000` / `0` (xem [04-settlement.md](04-settlement.md)).
- Ô nhập số tiền: `inputmode="numeric"`, chỉ nhận chữ số, tự chèn dấu phân cách khi gõ, giá trị gửi lên server là số nguyên thuần.

### 3.2. Ngôn ngữ

- Toàn bộ text hiển thị bằng **tiếng Việt**.
- Ngoại lệ duy nhất, giữ nguyên từng ký tự: `Chúc mừng bạn đã có chuyến đi vui vẻ! またね!`
- Tên biến / hàm / route / key trong code: tiếng Anh.

### 3.3. Mobile-first

- Thiết kế cho bề ngang **375–430px** trước, breakpoint lớn hơn thêm sau.
- Mọi phần tử chạm được: tối thiểu **44×44px**.
- Thao tác chính nằm trong tầm ngón cái: FAB và nút hành động chính đặt ở **đáy màn hình**.
- Nút hành động chính dạng fixed ở đáy phải chừa `safe-area-inset-bottom`.

### 3.4. Trạng thái tải & lỗi (chuẩn dùng lại ở mọi màn)

| Trạng thái | Hiển thị |
|---|---|
| Đang tải lần đầu | Skeleton đúng hình dạng nội dung sắp hiện (không dùng spinner toàn trang) |
| Đang gửi (submit) | Nút chuyển sang disabled + label "Đang lưu..."; không khóa cả màn |
| Lỗi mạng | Toast đỏ "Không kết nối được máy chủ. Thử lại?" + nút **Thử lại** |
| Lỗi validate từ server (400) | Hiện lỗi ngay dưới field tương ứng, không dùng toast |
| Xung đột (409) | Toast "Dữ liệu vừa được người khác cập nhật" + tự reload dữ liệu (xem 3.5) |
| Không tìm thấy (404) | Chuyển sang màn 404 ([05-not-found.md](05-not-found.md)) |

### 3.5. Đồng bộ nhiều người cùng lúc

Áp dụng cho `/e/{shareId}` và `/e/{shareId}/settlement`:

- **Refetch khi tab được focus** (`visibilitychange` / `focus`).
- **Polling ~10 giây** khi tab đang mở và đang hiển thị. Dừng polling khi tab ẩn.
- **Optimistic update** ở client: cập nhật UI ngay, rollback nếu request hỏng.
- Ghi theo **last-write-wins**, nhưng so `updatedAt` / `dataVersion`: nếu lệch → toast "Dữ liệu vừa được người khác cập nhật" rồi reload.
- Riêng `PUT /api/events/{shareId}/transfers/{transferKey}` gửi kèm `dataVersion`; server trả **409** khi lệch → client reload, không retry mù.

**[CHỜ QUYẾT ĐỊNH]** Thư viện fetch phía client: SWR **hoặc** TanStack Query — `CLAUDE.md` yêu cầu chọn một và không trộn lẫn, hiện chưa chốt.

### 3.6. Xác nhận trước hành động phá hủy

Mọi thao tác xóa dùng chung một dialog xác nhận (bottom sheet trên mobile):

- Tiêu đề nêu rõ đối tượng bị xóa.
- Nút phá hủy màu đỏ, đặt **bên phải**; nút "Hủy" bên trái.
- Với hành động không hoàn tác được (xóa hẳn sự kiện), thêm một dòng cảnh báo hệ quả.

### 3.7. SEO & metadata

- Mọi trang dưới `/e/**`: **`noindex, nofollow`** — link chia sẻ không được search engine đánh chỉ mục.
- `/` có thể index bình thường.
- Title: `{tên sự kiện} · Warikan` cho trang sự kiện, `Warikan` cho Home.

### 3.8. Toast

**Hình thức theo `design_handoff/README.md` mục "Toast"**: một kiểu duy nhất — nền `#2E2A3B`, chữ trắng, `left/right 20px; bottom 96px`, tự ẩn sau **2.2s**. Không chia màu theo loại.

Dùng cho: đã tạo sự kiện · đã thêm/sửa/xóa khoản chi · đã sao chép link · đã xóa khỏi máy này · *"Kết quả quyết toán được tính lại"*.

Ngoại lệ nghiệp vụ: toast **xung đột dữ liệu** (*"Dữ liệu vừa được người khác cập nhật"*) không tự tắt cho tới khi reload xong.

### 3.9. `shareId` — **[CẦN XÁC NHẬN]**

Nghiệp vụ (prompt gốc mục 2) quy định **nanoid 16–21 ký tự** để khó đoán — đây là ranh giới bảo mật duy nhất của app, vì ai có link là có toàn quyền sửa.

Handoff minh họa toast sao chép link dưới dạng `warikan.app/e/<shareId 10 ký tự>`. Spec này **giữ 16–21** vì độ dài `shareId` là câu hỏi bảo mật, không phải câu hỏi giao diện — 10 ký tự dễ dò hơn đáng kể. Nếu chủ dự án muốn link ngắn thật thì báo lại để cân nhắc đánh đổi.

---

## 4. Danh sách [CHỜ QUYẾT ĐỊNH]

Các mục dưới đây **chưa chốt**, spec màn hình để chỗ trống có chủ đích. Khi code chạm tới phải hỏi trước:

| # | Mục | Ảnh hưởng tới màn |
|---|---|---|
| 1 | **SWR hay TanStack Query** — chọn một, không trộn lẫn | 01, 03, 04 |
| 2 | **[CẦN THIẾT KẾ]** Lối vào "Sửa sự kiện" và "Xóa hẳn sự kiện" — handoff không vẽ nút nào dẫn tới | 01, 03 |
| 3 | Độ dài `shareId`: nghiệp vụ nói nanoid 16–21, toast trong handoff minh họa 10 ký tự (xem §3.9) | 02, 03, 04 |

### Đã được `design_handoff` chốt (không còn treo)

| Mục cũ | Chốt thành |
|---|---|
| Danh sách nhân vật | 10 con: `cat, bunny, frog, penguin, bear, pig, panda, koala, fox, puppy`. PNG 1024×1024, nền trong suốt, mỗi con một màu nền pastel. Trần 10 người/sự kiện. |
| Design system | Đủ bộ token ở `design_handoff/README.md`: Baloo 2 + Nunito, palette coral/teal/kem, radius, shadow phẳng, spacing. |
| Thư viện pháo hoa | **Không dùng thư viện.** `@keyframes wk-fall`, 60 hạt, 4.2s, palette 6 màu. |

---

## 5. Thứ tự làm được đề nghị

Theo quy trình "làm từng màn, dừng lại review" trong `CLAUDE.md`:

1. `lib/settlement.ts` + test (không có UI, nhưng là lõi mọi màn phụ thuộc)
2. Màn 02 — tạo sự kiện (không có nó thì không có dữ liệu để xem)
3. Màn 03 — chi tiết sự kiện
4. Màn 04 — quyết toán
5. Màn 01 — Home
6. Màn 05 — 404 + hoàn thiện edge case
