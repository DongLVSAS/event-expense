// Singleton PrismaClient. CHỈ được import từ Route Handler, Server Component
// hoặc Server Action — không bao giờ từ file có 'use client'.
//
// Vì sao singleton: trên Vercel mỗi route handler là một serverless function,
// không có connection pool sống lâu. Tạo `new PrismaClient()` mỗi request sẽ
// làm cạn connection của Neon. Ở dev, Next hot-reload nên phải gắn vào
// globalThis, nếu không mỗi lần reload lại tạo thêm một client.
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@/generated/prisma/client'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'Thiếu DATABASE_URL. Copy .env.example thành .env rồi điền connection string của Neon.'
  )
}

function createPrismaClient() {
  // Dùng adapter WebSocket (PrismaNeon) chứ không phải PrismaNeonHttp:
  // spec bắt buộc interactive transaction (tăng dataVersion + xóa TransferStatus
  // + reset settledAt phải nằm trong cùng một transaction), mà bản HTTP không hỗ trợ.
  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
