// Stop hook — nhắc chạy build + test, CHỈ khi có thay đổi chưa commit ở code sản phẩm.
// Im lặng khi cây làm việc sạch, để không làm phiền mỗi lượt.
import { execFileSync } from 'node:child_process'

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()

let changed = ''
try {
  changed = execFileSync('git', ['status', '--porcelain', '--', 'app', 'components', 'lib', 'prisma'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
} catch {
  process.exit(0) // không phải git repo, hoặc git lỗi => im lặng
}

if (changed.trim().length === 0) process.exit(0)

const count = changed.trim().split('\n').length

process.stdout.write(
  JSON.stringify({
    systemMessage: `Còn ${count} file code chưa commit. Theo CLAUDE.md: chạy \`npm run build\` và \`npm run test\` trước khi coi là xong, và đối chiếu lại spec trong docs/screens/.`,
  })
)
