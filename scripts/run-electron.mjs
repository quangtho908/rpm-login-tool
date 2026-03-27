import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(here, '..')

const binName = process.platform === 'win32' ? 'electron.cmd' : 'electron'
const binPath = join(projectRoot, 'node_modules', '.bin', binName)

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(binPath, ['.'], {
  stdio: 'inherit',
  cwd: projectRoot,
  env
})

child.on('exit', (code) => process.exit(code ?? 0))
