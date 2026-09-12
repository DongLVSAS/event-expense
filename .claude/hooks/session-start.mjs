// SessionStart hook — nhắc nguồn sự thật và liệt kê spec màn hình đang có.
// Chạy tự động mỗi khi mở phiên Claude Code trong repo này.
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const screensDir = join(root, 'docs', 'screens')

let files = []
if (existsSync(screensDir)) {
  files = readdirSync(screensDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
}

const handoff = join(root, 'docs', 'design_handoff', 'README.md')

const lines = [
  'NGUỒN SỰ THẬT của repo này (xem CLAUDE.md mục "Nguồn sự thật"):',
  '  GIAO DIỆN (màu, font, spacing, animation, copy, cử chỉ):',
  '    1. docs/design_handoff/README.md  <= thắng',
  '  NGHIỆP VỤ (công thức, validate, đồng bộ, edge case, mã lỗi):',
  '    1. docs/screens/*.md              <= thắng',
  '  Rồi mới tới: 3. docs/warikan-app-prompt.md   4. CLAUDE.md',
  'Mâu thuẫn giữa các tầng, hoặc không rõ câu hỏi thuộc loại nào => DỪNG LẠI HỎI.',
  'Code không đi trước spec: cần làm khác spec thì sửa spec trước, code sau.',
  'Prototype design_handoff/prototype/*.dc.html là tham chiếu để DỰNG LẠI, không copy làm code production.',
]

if (!existsSync(handoff)) {
  lines.push('CẢNH BÁO: không thấy docs/design_handoff/README.md — hỏi lại trước khi dựng giao diện.')
}

if (files.length > 0) {
  lines.push('', 'Spec màn hình hiện có:')
  for (const f of files) lines.push(`  docs/screens/${f}`)
  lines.push('Đọc file spec tương ứng TRƯỚC khi code một màn.')
} else {
  lines.push('', 'CẢNH BÁO: không tìm thấy docs/screens/ — hỏi lại chủ dự án trước khi code.')
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: lines.join('\n'),
    },
    suppressOutput: true,
  })
)
