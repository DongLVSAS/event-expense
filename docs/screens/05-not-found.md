# Màn 05 — Không tìm thấy sự kiện (404)

**Kích hoạt khi:** `shareId` trong URL không tồn tại, sai định dạng, hoặc sự kiện đã bị xóa hẳn.
Áp dụng cho `/e/{shareId}` và `/e/{shareId}/settlement`.

---

## 1. Layout

```
┌────────────────────────────────┐
│                                │
│         [ minh họa ]           │  ← [CHỜ QUYẾT ĐỊNH — design system]
│                                │
│   Không tìm thấy sự kiện này   │
│                                │
│   Link có thể đã hết hiệu lực  │
│   hoặc sự kiện đã bị xóa.      │
│                                │
│     [   Về trang chủ   ]       │
│                                │
└────────────────────────────────┘
```

- Giọng văn **thân thiện**, không đổ lỗi người dùng, không hiện mã lỗi kỹ thuật.
- Chỉ một hành động duy nhất: **Về trang chủ** (`/`).
- Vùng chạm nút ≥ 44×44px.

---

## 2. Hành vi

- Dùng `not-found.tsx` của App Router, trả **HTTP 404** thật (không phải trang 200 giả 404).
- Metadata: **`noindex, nofollow`**.

> **Đã kiểm chứng trên bản production — một hạn chế của Next 16 cần biết:**
> khi `notFound()` được gọi từ trong `/e/[shareId]`, HTML server gửi đi có **body rỗng**; toàn bộ nội dung màn 404 nằm trong RSC payload và được React dựng ở client.
>
> - HTTP status **404 đúng**, `noindex` đúng, người dùng có JS thấy màn hình bình thường.
> - Người tắt JS sẽ thấy **trang trắng**.
>
> Đã loại trừ `app/error.tsx` là nguyên nhân (bỏ ra vẫn vậy). `global-not-found.js` **không dùng được** cho ca này vì nó chỉ áp cho URL không khớp route nào, còn 404 của app đến từ `notFound()` trong một route đã khớp.
>
> Chấp nhận được vì app vốn là SPA-ish sau link chia sẻ và đã `noindex`. Nếu sau này cần hỗ trợ no-JS thì phải đổi cách: render UI 404 ngay trong `page.tsx` kèm `status` tự đặt, thay vì gọi `notFound()`.
- **Dọn localStorage:** nếu `shareId` này đang nằm trong danh sách của máy, gỡ nó ra — hoặc đánh dấu "đã bị xóa" để Home hiển thị theo §6.3 của [01-home.md](01-home.md). Chọn một cách và làm nhất quán ở cả hai màn.

---

## 3. Phân biệt với các lỗi khác

| Tình huống | Màn hiển thị |
|---|---|
| `shareId` không tồn tại / đã xóa | **Màn này (404)** |
| Server lỗi (500), DB không kết nối được | `error.tsx` — *"Có lỗi xảy ra. Thử lại?"* + nút **Thử lại**, **không** dùng màn 404 |
| Mất mạng phía client | Toast lỗi tại chỗ, giữ nguyên màn đang xem |
| `dataVersion` lệch (409) | Toast + reload, **không** phải 404 |

---

## 4. API

Không gọi API riêng. Màn này là kết quả của việc `GET /api/events/{shareId}` (hoặc truy vấn Prisma phía server) trả về không có dữ liệu.
