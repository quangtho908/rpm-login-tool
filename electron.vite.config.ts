import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        // Keep heavy/native/commonjs deps as runtime requires (not bundled)
        // - better-sqlite3 is a native Node addon (.node)
        external: ['@puppeteer/browsers', 'better-sqlite3', 'adm-zip', 'bufferutil', 'utf-8-validate']
      }
    },
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        output: {
          // Electron preload is expected to be CommonJS.
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      }
    },
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    build: {
      outDir: resolve('dist/renderer')
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer')
      }
    }
  }
})
