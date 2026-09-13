# Handoff: Warikan — Ghi chép & quyết toán chi phí buổi đi chơi

## Overview
Web app mobile-first, không đăng nhập, để một nhóm bạn lên danh sách những món **cần chi**, ghi chép những khoản **đã chi**, rồi quyết toán "ai trả ai bao nhiêu". Mỗi sự kiện có một link chia sẻ; ai có link đều nhập và xem được. Mỗi người tham gia được gán một nhân vật động vật để dễ nhận diện. Tiền tệ JPY, toàn bộ tính toán bằng số nguyên. Ngôn ngữ UI: tiếng Việt.

## About the Design Files
Các file trong bundle này là **design reference viết bằng HTML** — prototype thể hiện đúng look & behavior mong muốn, **không phải production code để copy trực tiếp**. Nhiệm vụ là **dựng lại các thiết kế này trong codebase đích** (React/Next, Vue, SwiftUI, native…) theo pattern & thư viện đã có ở đó. Nếu chưa có codebase, hãy chọn framework phù hợp nhất (gợi ý: React + TypeScript + Vite, hoặc Next.js nếu cần link chia sẻ server-side) rồi implement.

Prototype là một "Design Component" (`.dc.html`): template HTML + một class logic. Đọc nó như một React component: phần `class Component extends DCLogic` chứa **state và toàn bộ business logic (đặc biệt là thuật toán quyết toán — hãy port nguyên vẹn)**, phần template chứa markup + inline style (chính là design tokens cụ thể).

Mở `prototype/Warikan App.dc.html` trực tiếp trong browser để xem chạy thật.

## Fidelity
**High-fidelity.** Màu, typography, spacing, border radius, shadow, animation và copy đều là giá trị cuối. Hãy dựng lại pixel-perfect bằng thư viện/pattern của codebase. Điểm duy nhất còn là prototype-only: dữ liệu nằm trong state bộ nhớ (2 sự kiện mẫu), chưa có persistence/back-end.

---

## Design Tokens

### Colors
| Vai trò | Hex |
|---|---|
| Ink / text chính | `#2E2A3B` |
| Text phụ | `#7A7288` |
| Text nhạt / meta | `#9A93A8` |
| Text rất nhạt / số thứ tự | `#B0A8BC`, `#C9C1D4` |
| Text trên nền kem | `#BCA898`, `#A8917F` |
| Primary (coral) | `#FF6B4A` — hover `#F3552F`, text-on-light `#E0512F`, đậm `#D94F2B` |
| Primary nhạt | `#FFF1EC` (bg), `#FFD9CE` (border), `#FFE0D3` (badge bg) |
| Success (teal) | `#2FBF9B` — hover `#26A686`, text `#17A673` |
| Success nhạt | `#F1FBF7` (bg), `#C7E8DC` (border), `#DFF6EC` (badge bg) |
| Danger | `#E84855` / `#D6384C` / `#C2374B`; bg `#FFECEE`, `#FFF4F5`; border `#F8C9CC` |
| Warning/vàng (số tiền trên nền tối) | `#FFD166` |
| Surface trắng | `#FFFFFF` |
| Surface kem | `#FFFBF5` (thân app), `#FFF3E7` (vùng nhóm) |
| Border card | `#F1E7DD` / `#F0E6DC`; hairline `#F7F0E9` |
| Shadow "2px offset" dưới card | `#F3EAE1` / `#F2E9E0` |
| Dark bar / button đen | gradient `120deg, #2E2A3B → #463E5C`; button `#2E2A3B`, hover `#453E58` |
| Disabled button | `#CFC8D6` |
| Body background | `radial-gradient(1200px 600px at 15% 0%, #FFF0DA 0%, #FDF7F0 45%, #EFF8F3 100%)` |
| Device bezel | `#1F1B2B`, viền `#332C44` |

Confetti palette: `#FF6B4A`, `#FFD166`, `#2FBF9B`, `#8AB6FF`, `#FF8FA3`, `#C9A7FF`.

Nền tròn pastel theo nhân vật (avatar bg): cat `#FFE6CC`, bunny `#FFE1EA`, frog `#DBF5E4`, penguin `#DCEBFF`, bear `#F0E2D4`, pig `#FFE3EE`, panda `#ECECF2`, koala `#E6EAF0`, fox `#FFE0CE`, puppy `#F7E9D8`.

### Typography
Google Fonts: **Baloo 2** (500/600/700/800) cho heading + số tiền; **Nunito** (400/600/700/800) cho UI/body.

| Dùng ở | Font / size / weight |
|---|---|
| H1 marketing | Baloo 2 800, 38px, line-height 1.05 |
| Tên màn hình (H2) | Baloo 2 800, 26–28px, lh 1.1–1.15 |
| Tên sự kiện trong card | Baloo 2 700, 18px, lh 1.25 |
| Tổng tiền lớn (dark bar) | Baloo 2 800, 30px, lh 1 |
| Số tiền card / hàng | Baloo 2 800, 16–20px, lh 1 |
| Nút chính | Nunito 800, 16–17px |
| Label input (uppercase) | Nunito 800, 11.5–12px, letter-spacing .06em |
| Body / meta | Nunito 400/600, 12.5–14px, lh 1.4–1.7 |
| Tên người (avatar strip) | Nunito 700, 11.5px, lh 1.2 |
| Badge trạng thái | Nunito 800, 10.5px, lh 1.2 |
| Header bảng | Nunito 800, 10px, ls .07em, uppercase |

### Spacing / radius / shadow
- Padding màn hình: `20px` ngang; top `54px` (nhường status bar 44px), bottom `110–130px` (nhường CTA nổi).
- Gap list: `10–14px`; gap form: `14–16px`.
- Radius: input/nút phụ `14–16px`, card `18–22px`, bottom sheet `28px 28px 0 0`, pill `999px`, nút chính `18px`.
- Shadow: card `0 2–3px 0 #F2E9E0` (offset phẳng, không blur); FAB `0 10px 22px -6px rgba(255,107,74,.7)`; CTA `0 8px 18px -6px rgba(...,.6)`; sheet `0 -10px 40px -10px rgba(46,42,59,.35)`; bezel `0 30px 60px -20px rgba(58,47,70,.45)`.
- Min touch target: **44px** (bắt buộc mọi nút/chip).
- Khung device prototype: 390×800, bezel padding 11px, radius 52px/42px.

### Animation (@keyframes)
- `wk-pop` — scale .9→1 + fade, `.25–.4s ease both` (chip người mới, banner chúc mừng).
- `wk-rise` — translateY 14px→0 + fade, `.2–.3s ease both` (card list, bottom sheet, toast).
- `wk-bob` — translateY 0→−4px→0, `2.2–3s ease-in-out infinite` (mascot).
- `wk-fall` — translateY −40px→760px + rotate 680deg + fade, `2.2–4s linear`, delay random 0–1.2s, 60 hạt (confetti).

---

## Screens / Views

Điều hướng: `screen ∈ {home, create, event, settle}` + bottom sheet chồng lên (`sheet`).

### 1. Home — "Sự kiện của tôi"
Mục đích: xem/mở/xóa sự kiện đã lưu trên máy này; tạo sự kiện mới.

Layout: scroll dọc, padding `54px 20px 110px`.
- Header: eyebrow "Chào bạn 👋" (Nunito 700 12px, `#B0A8BC`, uppercase, ls .1em) + H2 "Sự kiện của tôi"; bên phải mascot fox 52×60 có `wk-bob`.
- Event card (radius 22px, bg trắng, border `#F1E7DD`, shadow phẳng `0 3px 0 #F2E9E0`, padding 16px, `wk-rise`):
  - Hàng 1: tên sự kiện (Baloo 2 700 18px) + dòng meta `dd/mm/yyyy · N người`; badge phải: "Đã xong" (`#DFF6EC`/`#17A673`) hoặc "Chưa quyết toán" (`#FFEEE3`/`#D2652F`), `white-space:nowrap`.
  - Hàng 2: tối đa 4 avatar 34×40 xếp đè nhau (`margin-right:-6px`) ở trái; phải: label "TỔNG CHI" + số tiền Baloo 2 800 20px màu `#FF6B4A`.
  - Hàng 3: nút đen "Mở sự kiện" (flex:1, 44px, radius 14px) + nút "✕" 44×44 (bg `#FFF8F1`, hover màu danger) để xóa.
- Empty state: 3 nhân vật (penguin xoay −8°, bunny bob, frog xoay +8°) chồng nhẹ; "Chưa có sự kiện nào" (Baloo 2 800 22px) + câu dẫn.
- FAB "＋ Tạo sự kiện": pill coral cao 56px, `right:20px; bottom:28px`.

### 2. Create / Edit event
Mục đích: đặt tên, ngày, thêm người tham gia.
- Nút "← Quay lại"; H2 "Tạo sự kiện mới" / "Sửa sự kiện".
- Input "Tên sự kiện" (placeholder `VD: Đi Hakone tháng 3`), input `type=date` "Ngày diễn ra" — cao 50px, border 1.5px `#F0E6DC`, radius 16px, focus border coral.
- Hàng thêm người: input (placeholder "Nhập tên rồi bấm ＋", Enter = thêm) + nút vuông 50px teal "＋".
- Vùng người tham gia: bg `#FFF3E7`, radius 20px, min-height 120px, chip dọc 78px: avatar 56px (tap = đổi nhân vật khác chưa dùng), tên (ellipsis), nút "✕" 22px góc trên phải. Counter `n/10 người`.
- Error inline: bg `#FFECEE`, text `#C2374B`, radius 14px.
- CTA dưới cùng (có gradient fade nền): "Tạo & lấy link chia sẻ" / "Lưu thay đổi", cao 54px.
- Validation: tên bắt buộc; ngày bắt buộc; ≥2 người; không trùng tên (case-insensitive); tối đa 10 người (bằng số nhân vật).

### 3. Event detail — danh sách chi tiêu (2 tabs)
- "← Sự kiện của tôi"; H2 tên sự kiện + meta; nút "🔗 Link" (pill `#FFF1EC`, `nowrap`, `aria-label="Sao chép link chia sẻ"`) — **cùng nhãn với màn Settlement**; nhãn ngắn nên phải có `aria-label`, chữ "Link" một mình không nói ra việc nó làm.
- Avatar strip: cột 74px, avatar 44px + tên 11.5px (ellipsis, max-width 72px).

#### Tab bar (ngay dưới avatar strip)
Segmented control: track bg `#F4EDE5`, radius 16px, padding 4px, gap 6px, margin `16px 20px 0`. Mỗi tab `flex:1`, min-height 44px, radius 13px, Nunito 800 14px. Tab active: bg `#fff`, text `#2E2A3B`, shadow `0 2px 6px -2px rgba(46,42,59,.22)`. Tab inactive: bg transparent, text `#9A8E82`. Mỗi label kèm counter nhỏ (Nunito 800 12px, `opacity:.6`): tab 1 = `đã mua/tổng` (vd `3/4`, ẩn khi rỗng), tab 2 = số khoản chi.
- **Tab 1 "Cần chi"** (default) — checklist những món *cần mua*, **không có số tiền, không có người chi**:
  - Hàng thêm nhanh: input (placeholder `VD: Than nướng, đá lạnh…`, cao 50px, Enter = thêm) + nút vuông 50px teal "＋".
  - Item row (`wk-rise`): nút tick 30×30 radius 10px border 2px ở trái → tên món (Nunito 700 15.5px) → nhãn "Đã mua" (chỉ khi đã tick) → nút "✕" 34px xóa.
    - Chưa mua: card bg `#fff`, border `#F1E7DD`, shadow `0 2px 0 #F3EAE1`; ô tick bg `#fff`, border `#E3D9CE`, trống.
    - **Đã mua: card bg `#E8F8EF`, border `#BDE6CE`, shadow `0 2px 0 #D6EFE0`; tên đổi `#17805C` + `line-through`; ô tick bg+border `#17A673` với "✓" trắng; nhãn pill "Đã mua" bg `#DFF6EC` / text `#17A673`.**
  - Empty: khung dashed `#EFE0D3` — "Chưa có gì trong danh sách cần chi. / Ghi trước những món cần mua, tick khi đã mua xong."
  - Footnote `#B0A8BC` 12.5px: "Danh sách này chỉ để nhắc nhau cần mua gì — số tiền ghi ở tab "Đã chi"."
  - Tick là **toggle thuần**, độc lập hoàn toàn với expenses: không tạo/sửa khoản chi, không ảnh hưởng quyết toán.
- **Tab 2 "Đã chi"** — nội dung ghi chép chi tiêu (total bar + expense list + nút thêm khoản chi), mô tả dưới đây.
- **[CHỦ DỰ ÁN ĐÈ LÊN HANDOFF]** Nút "Quyết toán →" **chỉ hiện ở tab "Đã chi"**, không hiện ở tab "Cần chi" — xem `docs/screens/03-event-detail.md` §7.
- **Sticky total bar** (trong tab 2): full-bleed, gradient tối, `position:sticky; top:-54px`, padding `14px 20px`; label "TỔNG CHI TIÊU" (`flex:none; nowrap`, opacity .7) + số tiền Baloo 2 800 30px màu `#FFD166`.
- Expense card (radius 18px, padding 12px 14px, click = mở sheet sửa): số thứ tự nhạt + tên khoản chi (Nunito 700 16px) + số tiền phải (Baloo 2 800 18px); dòng dưới: avatar 24px + "`<tên>` đã chi".
- Empty: khung dashed `#EFE0D3` radius 20px.
- Nút "＋ Thêm khoản chi": dashed teal, bg `#F1FBF7`. **Vị trí đổi theo việc đã có khoản chi hay chưa:**
  - **Chưa có khoản chi nào** — nằm trong luồng nội dung, dưới khung rỗng, full-width cao 50px (như cũ).
  - **Đã có khoản chi** — chuyển xuống **thanh CTA cố định đáy màn, đứng cùng hàng với "Quyết toán →", mỗi nút một nửa** (`flex:1`, gap 8px, cao 54px cho bằng nhau, chữ 14px `nowrap` để không vỡ ở màn 320px). Lúc này **không** còn nút thêm nào trong luồng nội dung.
- CTA "Quyết toán →" teal; disabled (`#CFC8D6`) khi chưa có khoản chi nào — lúc đó nó chiếm trọn chiều ngang và có dòng chú thích nhỏ phía trên. Khi đã có khoản chi thì nó lùi về **một nửa bên phải**, nửa trái là "＋ Thêm khoản chi".

### 4. Settlement — Quyết toán
- "← `<tên sự kiện>`"; H2 "Quyết toán"; nút "🔗 Link"; dòng meta: `Tổng ¥X · N người · mỗi người gánh ¥Y`.
- **Bảng balance** (card radius 22px, overflow hidden): header bg `#FFF3E7`; grid `26px 1fr 92px 50px`, hàng padding `10px 14px`, hairline `#F7F0E9`. Cột: #, avatar 30px + tên, số dư (`+1,666` teal / `−333` đỏ / `0` xám, Baloo 2 800 16px), trạng thái "Done" teal khi mọi giao dịch của người đó đã tick. Sắp xếp: người nhận tiền trước, rồi theo |số dư| giảm dần.
- **Gợi ý chuyển tiền**: mỗi hàng: avatar người trả → avatar người nhận → tên → số tiền → nút "Done" 56×34. Khi tick: bg đổi `#F1FBF7`, border `#C7E8DC`, nút thành teal đầy "✓ Done". Hint: "Tối đa N−1 lần chuyển khoản. Tick Done sau khi đã chuyển."
- Khi mọi giao dịch Done: banner gradient `#FFF1D6→#FFE3EC` + mascot bob + "Chúc mừng bạn đã có chuyến đi vui vẻ!" / "またね!" (**`またね!` nằm ở dòng riêng**, ngắt dòng cứng chứ không để tự wrap) và **confetti 60 hạt phủ toàn màn 4.2s** (chỉ bắn lần đầu hoàn tất).
- Nếu không ai phải chuyển: khung teal "Mọi người đã chia đều rồi! 🎉".

### 5. Bottom sheet — Thêm / Sửa khoản chi
- Scrim `rgba(46,42,59,.42)` (click = đóng); sheet trắng radius `28px 28px 0 0`, padding `20px 20px 26px`, `wk-rise`, handle 44×4px `#EDE6DE`.
- Tiêu đề "Thêm khoản chi" / "Sửa khoản chi"; ở chế độ sửa có nút "Xóa" viền danger.
- Input tên (placeholder "VD: Tiền đồ nướng"); input số tiền `inputmode=numeric` có prefix "¥" tuyệt đối trái, hiển thị **thousand separator** khi gõ, chỉ nhận số nguyên.
- Chọn người đã chi: chip pill 44px, avatar 28px + tên; chip đang chọn: border 2px coral + bg `#FFF1EC`.
- Nút "Lưu khoản chi" coral 52px. Validation: tên bắt buộc; số tiền là số nguyên > 0; phải chọn người.

Lưu ý: total bar và expense list **chỉ render trong tab "Đã chi"**; nút "＋ Thêm khoản chi" cũng nằm trong tab này. ~~CTA "Quyết toán →" ở đáy màn hiển thị ở cả 2 tab.~~ → **Chủ dự án đã chốt lại: CTA chỉ hiện ở tab "Đã chi"** (xem `docs/screens/03-event-detail.md` §7).

### Toast
`left/right 20px; bottom 96px`, bg `#2E2A3B`, chữ trắng Nunito 700 13.5px, radius 16px, tự ẩn sau 2.2s. Dùng cho: đã tạo sự kiện, đã thêm/xóa khoản chi, đã sao chép link (`warikan.app/e/<shareId 10 ký tự>`), đã xóa sự kiện, "kết quả quyết toán được tính lại".

---

## Interactions & Behavior
- Home → card "Mở sự kiện" → event; FAB → create; create "Lưu" → event (kèm toast).
- Event → "Quyết toán →" (disabled khi 0 khoản chi) → settle; back về event/home **luôn clear `sheet`** (không để sheet rò rỉ qua màn khác).
- Tap avatar khi tạo sự kiện → đổi sang nhân vật ngẫu nhiên **chưa dùng trong sự kiện đó**.
- Click expense card → sheet ở chế độ sửa (prefill) + nút Xóa.
- Tab "Cần chi": ＋ hoặc Enter để thêm món (bỏ qua chuỗi rỗng, không validate gì thêm); tick = toggle `bought`; ✕ = xóa khỏi checklist. Không có toast cho các hành động này.
- **Mọi thay đổi khoản chi hoặc danh sách người đều reset `done = {}` và `settledAt = null`** (kết quả quyết toán tính lại từ đầu) và báo toast.
- Tick "Done" là toggle; khi tick đủ 100% → set `settledAt`, bắn confetti một lần, hiện banner chúc mừng.
- Hover: nút đen → `#453E58`; coral → `#F3552F`; teal → `#26A686`; card → border `#FFD9CE`; nút ✕ → màu danger; input focus → border coral.
- Responsive: nội dung app thiết kế cho khung 390px (mobile-first). Trang giới thiệu bên ngoài khung dùng flex-wrap, cột trái `flex:1 1 300px; max-width:360px`.

## State Management
```
screen: 'home' | 'create' | 'event' | 'settle'
activeId: string | null            // sự kiện đang mở
editingEvent: boolean              // create screen ở chế độ sửa
tab: 'todo' | 'paid'               // tab ở màn event detail, default 'todo'
todoInput: string                  // input thêm món cần mua
events: Event[]
draft: Event | null                // bản nháp create/edit
person: string                     // input tên đang gõ
createError: string
sheet: { id: string|null, title: string, amount: string, payerId: string } | null
sheetError: string
toast: string                      // tự clear sau 2.2s
confetti: boolean                  // tự clear sau 4.2s
```
```
Event = {
  id, shareId,                     // shareId → URL /e/:shareId
  name, date: 'YYYY-MM-DD',
  participants: [{ id, name, characterId }],
  expenses: [{ id, title, amount:int, payerId }],
  todos: [{ id, title, bought: boolean }],   // tab "Cần chi" — không có amount/payer
  done: { [transferKey: `${fromId}:${toId}`]: boolean },
  settledAt: ISOString | null
}
```
Dữ liệu cần: prototype chạy in-memory. Production nên (a) lưu event theo `shareId` ở back-end để ai có link cũng đọc/ghi được, và (b) cache danh sách event đã mở ở `localStorage` cho màn Home ("xóa" ở Home chỉ xóa khỏi máy này — copy hiện tại là "Đã xóa khỏi máy này").

## Thuật toán quyết toán (port nguyên vẹn — xem hàm `settle()` trong prototype)
1. `paid[p]` = tổng tiền p đã chi. `total` = tổng mọi khoản chi.
2. `base = floor(total / n)`, `rem = total − base*n`.
3. Sắp xếp người theo `paid` giảm dần (tie-break: thứ tự tham gia); **`rem` người đầu tiên gánh thêm 1¥** → `share[p]`.
4. `balance[p] = paid[p] − share[p]` ⇒ **Σ balance = 0** luôn đúng.
5. Ghép greedy: chủ nợ (balance>0) sắp giảm dần, con nợ (balance<0) sắp theo |balance| giảm dần; mỗi bước chuyển `min(credit, debt)` ⇒ **tối đa n−1 giao dịch**.
6. Toàn bộ bằng số nguyên, không float. Format: `¥` + `toLocaleString('en-US')` → `¥12,000`.

## Assets
`assets/*.png` — 10 nhân vật động vật do user cung cấp, PNG 1024×1024, nền trong suốt: `cat, bunny, frog, penguin, bear, pig, panda, koala, fox, puppy`. Hiển thị trong hộp tròn `aspect-ratio:1`, bg pastel riêng theo bảng trên, ảnh `object-fit:contain; object-position:center bottom; width/height 104%`. Số người tối đa trong một sự kiện = 10 để không trùng nhân vật.

Không dùng icon library — các "icon" là ký tự text: `＋ ✕ → ← 🔗 ✓ 🎉 👋`.

## Files
- `prototype/Warikan App.dc.html` — toàn bộ thiết kế + logic (mở trực tiếp trong browser). Template = markup/style; class `Component` = state + logic; hàm `settle()` = thuật toán.
- `prototype/Chara.dc.html` — component avatar nhân vật.
- `prototype/support.js` — runtime để prototype chạy được offline (không port sang production).
- `assets/` — 10 ảnh nhân vật.
- Spec requirement gốc: `../warikan-app-prompt.md` (ở gốc thư mục `docs/`, gồm cả Phase 2 chưa làm). Bản sao trong `spec/` đã bị xóa vì lệch nội dung — chỉ dùng bản ở `docs/`. Bundle export lần sau có thể tạo lại nó, nhớ xóa tiếp.
