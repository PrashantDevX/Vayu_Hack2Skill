import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/utils/**/*.ts',
        'src/services/**/*.ts',
        'src/constants/**/*.ts',
        'api/**/*.ts',
      ],
      exclude: ['**/*.test.*', 'src/test/**'],
      // Measured 2026-11-18: 92.74% statements, 81.53% branches,
      // 94.53% functions, 96.09% lines. Thresholds sit just below the
      // measured floor so regressions fail the build without flaking.
      thresholds: {
        statements: 90,
        branches: 78,
        functions: 92,
        lines: 93,
      },
    },
  },
})
