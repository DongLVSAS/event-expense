// Cấu hình cho Prisma CLI (migrate / studio / generate).
// Prisma 7 bỏ field `url` trong datasource của schema.prisma — URL khai ở đây.
// Tên file `prisma7.config.ts` là do Prisma 7 quy định, không đổi được.
import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migration chạy qua endpoint DIRECT (không pooler) của Neon — pooler dùng
    // PgBouncer nên hay vỡ ở advisory lock và prepared statement khi migrate.
    // App lúc chạy thì dùng DATABASE_URL (pooler) trong lib/prisma.ts.
    // Prisma 7 không còn field `directUrl`, nên tách bằng biến môi trường ở đây.
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
})
