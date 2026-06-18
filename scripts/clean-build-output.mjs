import { rmSync } from 'node:fs'

rmSync('.vercel/output', { recursive: true, force: true })
