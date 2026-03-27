import { mkdir, cp } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const src = resolve('src/main/runtime/export-runtime.cjs')
const dest = resolve('dist/main/export-runtime.cjs')

await mkdir(dirname(dest), { recursive: true })
await cp(src, dest)
