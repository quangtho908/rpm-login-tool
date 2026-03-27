import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(here, '..')

const binName = process.platform === 'win32' ? 'electron-vite.cmd' : 'electron-vite'
const binPath = join(projectRoot, 'node_modules', '.bin', binName)

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: node scripts/run-electron-vite.mjs <args...>')
  process.exit(1)
}

const env = { ...process.env }
// IMPORTANT: if ELECTRON_RUN_AS_NODE exists (even as "0"), Electron will run as Node and `app` will be undefined.
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(binPath, args, {
  stdio: 'inherit',
  cwd: projectRoot,
  env
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
