// PreToolUse hook (Edit|Write) — nhắc file spec tương ứng với file đang sửa.
// Chế độ hiện tại: NHẮC (không chặn). Muốn chặn hẳn, xem ghi chú cuối file.
import { readFileSync } from 'node:fs'

let payload = {}
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0) // stdin hỏng thì im lặng, không cản trở công việc
}

const raw = payload?.tool_input?.file_path
if (typeof raw !== 'string' || raw.length === 0) process.exit(0)

// Chuẩn hóa về đường dẫn posix, tương đối so với gốc repo.
const root = (process.env.CLAUDE_PROJECT_DIR || process.cwd()).replace(/\\/g, '/')
let path = raw.replace(/\\/g, '/')
if (path.toLowerCase().startsWith(root.toLowerCase())) {
  path = path.slice(root.length).replace(/^\/+/, '')
}

// Chỉ quan tâm code sản phẩm. Sửa docs/, .claude/, test... thì không nhắc.
if (!/^(app|components|lib)\//.test(path)) process.exit(0)

// Thứ tự quan trọng: mẫu cụ thể phải đứng trước mẫu chung.
const RULES = [
  [/^lib\/settlement\.ts$/, '04-settlement.md', 'LÕI NGHIỆP VỤ. Không sửa thuật toán khi chưa báo chủ dự án. Bất biến: sum(share)===total, sum(balance)===0, thứ tự transfer tất định.'],
  [/^app\/e\/\[shareId\]\/settlement\//, '04-settlement.md', null],
  [/^app\/e\/\[shareId\]\/edit\//, '02-event-form.md', null],
  [/^app\/new\//, '02-event-form.md', null],
  [/^app\/e\/\[shareId\]\//, '03-event-detail.md', null],
  [/^app\/not-found\./, '05-not-found.md', null],
  [/^app\/page\./, '01-home.md', null],
  [/^lib\/local-events\./, '01-home.md', null],
]

let spec = '00-index.md'
let note = null
for (const [re, file, extra] of RULES) {
  if (re.test(path)) {
    spec = file
    note = extra
    break
  }
}

// Handoff quy định giao diện; spec màn quy định nghiệp vụ. File UI cần cả hai.
const HANDOFF_SECTION = {
  '01-home.md': '1. Home',
  '02-event-form.md': '2. Create / Edit event',
  '03-event-detail.md': '3. Event detail + 5. Bottom sheet',
  '04-settlement.md': '4. Settlement',
}

const lines = [
  `File đang sửa (${path}):`,
  `  NGHIỆP VỤ  -> docs/screens/${spec}`,
]
const isUi = /^(app|components)\//.test(path)
if (isUi && HANDOFF_SECTION[spec]) {
  lines.push(`  GIAO DIỆN  -> docs/design_handoff/README.md, mục "${HANDOFF_SECTION[spec]}"`)
  lines.push('Token màu/font/spacing lấy từ handoff, KHÔNG tự chế giá trị mới.')
}
lines.push(
  'Đọc file tương ứng trước khi viết, đối chiếu lại sau khi viết xong.',
  'Gặp mục [CHỜ QUYẾT ĐỊNH] / [ĐỀ XUẤT] / [CẦN XÁC NHẬN] / [CẦN THIẾT KẾ] => hỏi chủ dự án, không tự chọn.'
)
if (note) lines.push(note)

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: lines.join('\n'),
    },
    suppressOutput: true,
  })
)

// Muốn CHẶN thay vì nhắc: thay khối trên bằng
//   hookSpecificOutput: { hookEventName: 'PreToolUse',
//     permissionDecision: 'ask', permissionDecisionReason: lines.join('\n') }
// ('ask' hỏi lại mỗi lần; 'deny' chặn thẳng.)
