import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Cho phép test dùng alias '@/...' giống code trong app.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    // lib/settlement.ts là pure function, không cần DOM.
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
})
