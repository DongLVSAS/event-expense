# Màn 01 — Home: danh sách sự kiện

**Route:** `/`
**Nguồn dữ liệu:** danh sách `shareId` trong **localStorage** của máy + gọi API lấy tóm tắt từng sự kiện.
**Không có tài khoản → không có danh sách phía server.** Mỗi máy thấy một danh sách khác nhau.

---

## 1. Luồng dữ liệu

```
localStorage ──► [shareId, shareId, ...] ──► fetch tóm tắt từng sự kiện ──► render list
   (lib/local-events.ts)                      (GET /api/events/{shareId})
```

- `lib/local-events.ts` chịu trách nhiệm đọc/ghi mảng `shareId`. Đây là **file client-only**.
- Màn này là **Client Component** (cần đọc localStorage). Prisma tuyệt đối không xuất hiện ở đây.
- Nếu một `shareId` trả về 404 (sự kiện đã bị người khác xóa hẳn) → đánh dấu item đó là "đã bị xóa", cho phép gỡ khỏi máy (xem mục 6).

**[ĐÃ CHỐT]** Không thêm endpoint gộp. Home gọi `GET /api/events/{shareId}` song song cho từng id — một máy thường chỉ có vài sự kiện nên chi phí không đáng kể, và đỡ phải viết thêm một endpoint có nguy cơ bị lạm dụng.

---

## 2. Layout

```
┌────────────────────────────────┐
│  Warikan                       │  ← header đơn giản, không nút back
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │ Nhậu tất niên          ... │ │  ← tên sự kiện (đậm) + menu "..."
│ │ 28/12/2025 · 5 người       │ │  ← ngày · số người
│ │ Tổng chi ¥42,000           │ │
│ │ [ Chưa quyết toán ]        │ │  ← badge trạng thái
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │ Đi Hakone              ... │ │
│ │ 15/11/2025 · 3 người       │ │
│ │ Tổng chi ¥18,500           │ │
│ │ [ Đã xong ]                │ │
│ └────────────────────────────┘ │
│                                │
│                        ╭─────╮ │
│                        │  +  │ │  ← FAB, góc dưới phải, fixed
│                        ╰─────╯ │
└────────────────────────────────┘
```

---

## 3. Nội dung mỗi item

| Thành phần | Nguồn | Ghi chú |
|---|---|---|
| Tên sự kiện | `event.name` | 1 dòng, tràn thì `…` |
| Ngày diễn ra | `event.date` | Hiển thị `DD/MM/YYYY` |
| Số người tham gia | `participants.length` | `"{n} người"` |
| Tổng chi | `Σ expenses.amount` | Format `¥42,000` |
| Badge trạng thái | `event.settledAt` | `null` → **Chưa quyết toán**; khác `null` → **Đã xong** |

- **Sắp xếp mặc định:** `date` **giảm dần** (sự kiện gần nhất lên đầu). Cùng ngày → `createdAt` giảm dần.
- Toàn bộ thẻ là vùng chạm để mở `/e/{shareId}` (trừ vùng menu `...`).
- Menu `...` là nút riêng, rộng tối thiểu 44×44px, `stopPropagation` để không mở sự kiện.

---

## 4. Hành động trên một sự kiện

**[ĐÃ CHỐT — theo `design_handoff`]** Không có menu `...`. Thẻ sự kiện có đúng **hai nút** ở hàng cuối (chi tiết kích thước xem `README.md` mục "1. Home"):

| Nút | Việc xảy ra | Xác nhận |
|---|---|---|
| **Mở sự kiện** (nút đen, `flex:1`) | Điều hướng tới `/e/{shareId}` | Không |
| **✕** (44×44, hover màu danger) | **Xóa hẳn sự kiện** — `DELETE /api/events/{shareId}`, rồi gỡ `shareId` khỏi localStorage. Xóa ở **mọi nơi**: người khác có link cũng mất sự kiện | Có — **bắt buộc**, và phải nói rõ người khác cũng mất |

> Spec cũ có menu `...` với ba lựa chọn (sửa / xóa khỏi máy / xóa hẳn). Handoff thiết kế lại thành hai nút, nên menu đó **đã bỏ**.

### 4.1. Nút ✕ xóa hẳn, không phải chỉ gỡ khỏi máy [ĐÃ CHỐT — 13/09/2026]

**Quyết định này thay cho quyết định cũ.** Trước đây nút `✕` chỉ gỡ `shareId` khỏi localStorage, sự kiện vẫn còn trên server. Chủ dự án đã đổi: **xóa là xóa ở mọi nơi.**

Vì hành động không hoàn tác được và ảnh hưởng tới người khác, popup xác nhận **phải nói thẳng điều đó**:

> **Xóa hẳn "&lt;tên sự kiện&gt;"?**
> Sự kiện sẽ bị xóa ở **mọi nơi** — những người khác đang giữ link chia sẻ cũng sẽ không mở được nữa. Toàn bộ khoản chi và kết quả quyết toán sẽ mất. Không khôi phục lại được.
>
> `[ Hủy ]` `[ Xóa hẳn ]`

- Nút xác nhận mang màu danger, nhãn **"Xóa hẳn"** (không phải "Xóa khỏi máy này").
- Trong lúc gọi API: nhãn đổi thành **"Đang xóa..."**, khóa cả hai nút để không bấm hai lần.
- Request hỏng → **giữ popup mở**, hiện câu lỗi ngay trong popup, `shareId` **không** bị gỡ khỏi localStorage. Xóa hụt mà vẫn biến khỏi danh sách thì người dùng mất luôn đường vào sự kiện còn sống.
- Thành công → đóng popup; thẻ tự biến mất vì danh sách dựng từ localStorage.

**"Sửa sự kiện" vẫn không nằm ở màn này** — chỉ có ở header màn chi tiết, sau nút `⋯` ([03-event-detail.md](03-event-detail.md) §3.1). Lý do giữ nguyên: người mở qua link chia sẻ không bao giờ đi qua Home.

Nút "Xóa hẳn sự kiện" trong menu `⋯` ở màn chi tiết **giữ nguyên**, không bỏ. Hai lối vào cùng gọi một endpoint.

---

## 5. FAB — Tạo sự kiện

- Nút nổi tròn, góc **dưới phải**, fixed, luôn thấy khi cuộn.
- Nhãn: dấu `+` (kèm text "Tạo sự kiện" nếu design chốt dạng extended FAB — **[CHỜ QUYẾT ĐỊNH — design system]**).
- Tap → màn tạo sự kiện ([02-event-form.md](02-event-form.md)).

---

## 6. Các trạng thái của màn

### 6.1. Rỗng (localStorage chưa có sự kiện nào)

```
┌────────────────────────────────┐
│                                │
│         [ minh họa ]           │  ← [CHỜ QUYẾT ĐỊNH — design system]
│                                │
│   Tạo sự kiện đầu tiên của bạn │
│   Ghi chi tiêu chung, app tự   │
│   tính ai trả cho ai.          │
│                                │
│     [ + Tạo sự kiện ]          │  ← nút chính, không chỉ dựa vào FAB
└────────────────────────────────┘
```

### 6.2. Đang tải
Skeleton 2–3 thẻ có cùng chiều cao thẻ thật.

### 6.3. Có sự kiện đã bị xóa trên server
Item hiện dạng mờ, text thay bằng:

> *Sự kiện này đã bị xóa.* `[ Gỡ khỏi danh sách ]`

Tap "Gỡ khỏi danh sách" → xóa `shareId` khỏi localStorage.

Đây là **lối duy nhất còn lại chỉ đụng tới máy này**, và nó đúng: sự kiện đã không còn trên server (hoặc chưa tải được), nên không có gì để gọi `DELETE` nữa. Không cần popup xác nhận — không mất gì của ai.

### 6.4. Lỗi mạng
Giữ nguyên danh sách tên đã cache (nếu có), hiện toast lỗi + nút **Thử lại** theo mục 3.4 của [00-index.md](00-index.md).

---

## 7. Validate & edge case

| # | Tình huống | Xử lý |
|---|---|---|
| 1 | localStorage bị chặn / private mode | Vẫn cho tạo sự kiện; sau khi tạo hiện cảnh báo "Máy này không lưu được danh sách, hãy lưu lại link chia sẻ" |
| 2 | localStorage chứa `shareId` không hợp lệ (rác) | Bỏ qua im lặng, dọn khỏi storage |
| 3 | Mở link `/e/{shareId}` lần đầu | Sự kiện tự xuất hiện ở Home lần sau — ghi vào localStorage ở màn 03, không phải ở đây |
| 4 | Cùng một `shareId` bị thêm 2 lần | `lib/local-events.ts` khử trùng lặp khi ghi |
| 5 | Danh sách rất dài | Chưa cần phân trang ở bản đầu |

---

## 8. API dùng tới

| Method | Endpoint | Dùng cho |
|---|---|---|
| GET | `/api/events/{shareId}` | Lấy tóm tắt từng sự kiện trong danh sách |
| DELETE | `/api/events/{shareId}` | Nút `✕` — xóa hẳn sự kiện (§4.1) |

Chỉ "Gỡ khỏi danh sách" ở §6.3 là **không gọi API** — thuần localStorage, vì sự kiện đã không còn trên server.

`DELETE` trả `204` khi xóa xong và `404` khi sự kiện đã bị người khác xóa trước. Coi `404` là **thành công** — trạng thái mong muốn đã đạt, cứ gỡ khỏi localStorage.
