# Màn 04 — Quyết toán

**Route:** `/e/{shareId}/settlement`
Màn này **chỉ hiển thị**, không tự nghĩ ra công thức. Mọi con số đến từ `lib/settlement.ts` — pure function, không import Prisma, không gọi API, không đọc `Date.now()`.

> **Không sửa thuật toán trong `lib/settlement.ts` mà không báo chủ dự án trước** (`CLAUDE.md`).

---

## 1. Nguồn dữ liệu

```
participants + expenses ──► lib/settlement.ts ──► { balances[], transfers[] }
                                                          │
              TransferStatus (DB, theo transferKey) ───────┴──► trạng thái Done trên UI
```

- Kết quả quyết toán **không lưu DB**, luôn tính lại từ dữ liệu gốc mỗi lần render.
- **Chỉ trạng thái Done của từng giao dịch được lưu**, khóa bằng `transferKey = "{fromParticipantId}:{toParticipantId}"`.
- `transferKey` ổn định giữa các lần tính vì thuật toán **tất định** (tie-break cố định theo `sortOrder`).
- Vỏ trang là Server Component; phần checkbox Done + hiệu ứng là client island.
- Metadata: **`noindex, nofollow`**.
- Đồng bộ: refetch khi focus + polling ~10s, theo §3.5 của [00-index.md](00-index.md).

---

## 2. Layout tổng thể

```
┌────────────────────────────────┐
│ ←  Quyết toán             [🔗] │
│    Nhậu tất niên · 28/12/2025  │
├────────────────────────────────┤
│ Tổng chi ¥42,000 · 5 người     │
│ Mỗi người gánh ¥8,400          │
├────────────────────────────────┤
│ PHẦN A — Số dư từng người      │
│ ┌──┬───────────┬─────────┬────┐│
│ │ 1│ (人) An   │ +20,000 │Done││
│ │ 2│ (人) Bình │  +4,000 │    ││
│ │ 3│ (人) Dung │ -10,000 │    ││
│ │ 4│ (人) Em   │ -14,000 │    ││
│ │ 5│ (人) Cường│       0 │Done││
│ └──┴───────────┴─────────┴────┘│
├────────────────────────────────┤
│ PHẦN B — Gợi ý chuyển tiền     │
│  (人)Em  →(人)An   ¥14,000  [✓]│
│  (人)Dung→(人)An   ¥6,000   [ ]│
│  (人)Dung→(人)Bình ¥4,000   [ ]│
├────────────────────────────────┤
│ (PHẦN C — pháo hoa khi xong)   │
├────────────────────────────────┤
│ [← Quay lại danh sách chi tiêu]│
└────────────────────────────────┘
```

Dòng tóm tắt trên cùng **[ĐÃ CHỐT — theo `design_handoff`]**: `Tổng ¥X · N người · mỗi người gánh ¥Y`. Nếu có tiền lẻ, hiển thị dạng `mỗi người gánh ¥3,333–3,334`.

Kích thước, màu, grid của bảng balance và hàng gợi ý chuyển tiền: **theo `design_handoff/README.md` mục "4. Settlement"** — không chép lại vào đây.

---

## 3. Phần A — Bảng số dư từng người

### 3.1. Bốn cột

| STT | Người dùng | Số tiền nhận về / cần trả | Trạng thái |
|---|---|---|---|
| 1 | dòng trên: **nhân vật** · dòng dưới: **tên** | `+20,000` | Done |

- **STT**: tự sinh theo **thứ tự hiển thị** sau khi sắp xếp (mục 3.3), đánh liên tục từ 1.
- **Người dùng**: nhân vật ở trên, **tên ngay dưới chân nhân vật** — thống nhất với màn tạo sự kiện.

### 3.2. Cột số tiền — quy tắc hiển thị

| Số dư | Hiển thị | Kiểu chữ |
|---|---|---|
| `balance > 0` → **nhận về** | dấu `+` phía trước, VD `+20,000` | **in đậm, màu xanh lá** |
| `balance < 0` → **cần trả** | dấu `−` phía trước, VD `-10,000` | **in đậm, màu đỏ** |
| `balance = 0` | `0` | **màu xám**, không đậm |

Cột này **không có ký hiệu `¥`** (khác với các màn còn lại) — theo đúng ví dụ trong prompt gốc. Vẫn giữ dấu phân cách hàng nghìn.

### 3.3. Sắp xếp

1. Nhóm **nhận về** (`balance > 0`) lên trước, sắp theo số tiền **giảm dần**.
2. Rồi nhóm **cần trả** (`balance < 0`), sắp theo `|số tiền|` **giảm dần**.
3. Cuối cùng là nhóm **số dư `0`** — **[ĐÃ CHỐT]**: luôn nằm **cuối bảng**, sau nhóm cần trả. Prompt gốc không quy định chỗ đứng của nhóm này.
4. Tie-break trong mỗi nhóm: `sortOrder` tăng dần.

Nhóm số dư `0` đứng cuối là hợp lý về mặt đọc: họ đã Done sẵn, không cần hành động gì, nên không chen vào giữa hai nhóm mà người dùng đang phải đối chiếu.

### 3.4. Cột trạng thái

- Để trống, hoặc chữ **Done** màu xanh lá.
- **`balance = 0`** → **tự động Done ngay từ đầu**, **không cho sửa** (người này không nhận cũng không trả).
- **`balance ≠ 0`** → Done được **suy ra**, không bấm trực tiếp được: chuyển thành Done khi **tất cả giao dịch ở Phần B có liên quan tới người đó** (dù là bên gửi hay bên nhận) đều đã Done.
- Cột này là **read-only**. Người dùng chỉ tương tác ở Phần B.

---

## 4. Phần B — Gợi ý chuyển tiền

Bảng ở Phần A chỉ cho biết ai thừa/thiếu bao nhiêu, chưa cho biết **chuyển cho ai**. Phần B trả lời câu đó.

### 4.1. Mỗi dòng

```
[avatar] Em   →   [avatar] An     ¥14,000     [ ✓ Done ]
```

| Thành phần | Nội dung |
|---|---|
| Bên trái | avatar + tên **người trả** (`from`) |
| Mũi tên | `→` |
| Bên phải | avatar + tên **người nhận** (`to`) |
| Số tiền | format `¥14,000` — **có** ký hiệu `¥` |
| Done | **checkbox riêng cho từng dòng**, vùng chạm ≥ 44×44px |

**Mỗi dòng có checkbox Done riêng** vì một người có thể phải trả cho nhiều người khác nhau.

### 4.2. Thứ tự các dòng

Giữ **đúng thứ tự do `lib/settlement.ts` trả về** — không sắp xếp lại ở UI. Đây là điều kiện để `transferKey` và thứ tự hiển thị ổn định giữa các lần tính lại.

> **[ĐÃ CHỐT]** `warikan-app-prompt.md` mục 5 có một chỗ không nhất quán: phần ví dụ của Ví dụ 1 ghi `B → A` trước `C → A`, trái với chính thuật toán ngay phía trên nó (Ví dụ 2 thì khớp).
> **Quyết định: bám theo thuật toán — debtors duyệt theo `|balance|` giảm dần, nên `C` đứng trước `B`.** Dòng ví dụ trong prompt gốc là chỗ sai, không phải thuật toán.

Cụ thể, `debtors` được duyệt theo `|balance|` **giảm dần** (tie-break `sortOrder` tăng dần), nên hai ví dụ trong prompt gốc cho ra thứ tự sau. Dùng luôn làm fixture cho test tính tất định ở `__tests__/settlement.test.ts`:

| Ví dụ | Số dư | Thứ tự transfer đúng |
|---|---|---|
| **1** (chia hết) | A `+4,000` · B `−1,000` · C `−3,000` | 1. `C → A ¥3,000`  2. `B → A ¥1,000` |
| **2** (chia lẻ) | A `+1,666` · B `−333` · C `−1,333` | 1. `C → A ¥1,333`  2. `B → A ¥333` |

Test phải khẳng định **cả thứ tự lẫn số tiền**, vì thứ tự chính là biểu hiện của tính tất định mà `transferKey` dựa vào.

### 4.3. Bật/tắt Done

- Tap checkbox → optimistic update ngay → `PUT /api/events/{shareId}/transfers/{transferKey}` **kèm `dataVersion` hiện tại**.
- Server trả **409** nếu `dataVersion` lệch → toast *"Dữ liệu vừa được người khác cập nhật"* + reload, **không** retry mù.
- Request lỗi → rollback checkbox về trạng thái cũ + toast đỏ.
- **Bỏ tick một dòng đã Done** → hợp lệ: server set lại `settledAt = null`, Phần A cập nhật theo; hiệu ứng pháo hoa không chạy lại cho tới lần hoàn tất kế tiếp.

---

## 5. Phần C — Hiệu ứng chúc mừng

### 5.1. Điều kiện kích hoạt

Khi **tất cả** trạng thái trong bảng Phần A đều là Done (tương đương: mọi giao dịch ở Phần B đều Done):

- Bắn **pháo hoa / confetti**.
- Hiển thị dòng chữ **màu đỏ**, giữ nguyên từng ký tự:

  > **Chúc mừng bạn đã có chuyến đi vui vẻ! またね!**

### 5.2. Chỉ chạy một lần

- Hiệu ứng chạy **tại đúng thời điểm chuyển sang trạng thái hoàn tất** — khi server ghi `settledAt`.
- Mở lại màn khi `settledAt` đã có sẵn → **hiện dòng chữ, không bắn pháo hoa lại**.
- Cách phân biệt: client so `settledAt` trước và sau request Done vừa gửi; chỉ `null → có giá trị` mới bắn.
- Tôn trọng `prefers-reduced-motion`: người dùng bật giảm chuyển động → chỉ hiện dòng chữ, bỏ hiệu ứng.

**[ĐÃ CHỐT — theo `design_handoff`]** **Không dùng thư viện.** Confetti tự dựng bằng CSS: `@keyframes wk-fall` (translateY −40px→760px + rotate 680deg + fade), **60 hạt**, mỗi hạt `2.2–4s linear` với delay ngẫu nhiên 0–1.2s, tổng thời lượng phủ màn **4.2s**. Palette 6 màu: `#FF6B4A`, `#FFD166`, `#2FBF9B`, `#8AB6FF`, `#FF8FA3`, `#C9A7FF`.

Banner chúc mừng: nền gradient `#FFF1D6 → #FFE3EC`, kèm mascot có animation `wk-bob`.

### 5.3. Trường hợp không phát sinh giao dịch nào

Khi mọi người đều có số dư `0` → Phần B rỗng. Khi đó:

- Thay danh sách giao dịch bằng dòng: **"Mọi người đã chia đều rồi!"**
- **Vẫn bắn pháo hoa.**

**[ĐỀ XUẤT — CẦN XÁC NHẬN]** Prompt gốc không nói `settledAt` được ghi lúc nào trong trường hợp này (không có giao dịch nào để tick). Đề xuất: khi mở màn quyết toán mà không có giao dịch nào và `settledAt == null`, client gọi một lần để server ghi `settledAt`. Việc này cần bổ sung endpoint vào bảng API mục 6 của prompt gốc.

---

## 6. Các trạng thái của màn

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | Skeleton: dòng tóm tắt + 4 dòng bảng + 2 dòng giao dịch |
| **Chưa có khoản chi nào** | Không nên vào được màn này (nút Quyết toán ở màn 03 đã disable). Nếu vào thẳng bằng URL → hiện *"Chưa có khoản chi nào để quyết toán."* + nút về `/e/{shareId}` |
| Đang lưu Done | Checkbox hiện mờ cho tới khi server xác nhận |
| Xung đột 409 | Toast + reload toàn bộ Phần A/B |
| Đã xong (`settledAt != null`) | Badge **Đã xong** trên header + dòng chúc mừng (không pháo hoa) |
| `shareId` không tồn tại | Màn 404 ([05-not-found.md](05-not-found.md)) |

---

## 7. Edge case

| # | Tình huống | Xử lý |
|---|---|---|
| 1 | Người tham gia không chi gì | **Vẫn xuất hiện** trong Phần A với số dư âm |
| 2 | Tiền lẻ không chia hết | Người **đã chi nhiều nhất** gánh phần lẻ (tie-break `sortOrder` tăng dần). `Σ share === total` chính xác, bảng tự cân, **không có bước bù trừ thủ công** |
| 3 | Người khác sửa chi tiêu khi đang mở màn này | `dataVersion` tăng → mọi Done bị xóa → polling kéo về → toast + bảng tính lại từ đầu |
| 4 | Vừa tick Done thì có người sửa chi tiêu | `PUT` trả 409 → toast + reload |
| 5 | Số tiền rất lớn | Số nguyên + dấu phân cách; không dùng float ở bất kỳ khâu nào |
| 6 | Chỉ 2 người tham gia | Tối đa 1 giao dịch. Hoạt động bình thường |
| 7 | Mở màn bằng URL trực tiếp, chưa từng vào màn 03 | Vẫn ghi `shareId` vào localStorage như màn 03 |

---

## 8. Bất biến phải đúng (đối chiếu khi kiểm thử)

Nguồn: `CLAUDE.md` + mục 5 của prompt gốc. Các bất biến này được test ở `__tests__/settlement.test.ts`; màn hình chỉ có nhiệm vụ hiển thị lại cho trung thực:

- `Σ share[i] === total` — chính xác, không sai số.
- `Σ balance[i] === 0` — với **mọi** bộ dữ liệu.
- Số giao dịch tối đa `n − 1`.
- Cùng input → **cùng thứ tự transfer và cùng `transferKey`** (tính tất định).
- Tổng số tiền các dòng ở Phần B mà một người phải trả = `|balance|` của người đó ở Phần A.

---

## 9. API dùng tới

| Method | Endpoint | Dùng cho |
|---|---|---|
| GET | `/api/events/{shareId}` | Nạp event + participants + expenses + transferStatuses |
| PUT | `/api/events/{shareId}/transfers/{transferKey}` | Bật/tắt Done một giao dịch, **gửi kèm `dataVersion`**; 409 khi lệch |

Màn này **không** có endpoint tính quyết toán — tính hoàn toàn bằng `lib/settlement.ts`, dùng chung cho server và client.
