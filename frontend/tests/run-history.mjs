import { rolldown } from 'rolldown'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const temporary = await mkdtemp(join(tmpdir(), 'openconsole-history-test-'))
try {
  const bundle = await rolldown({
    input: fileURLToPath(new URL('./historySync.test.ts', import.meta.url)),
    platform: 'node',
    transform: { define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://history.test') } },
  })
  const file = join(temporary, 'history-test.mjs')
  await bundle.write({ file, format: 'esm' })
  await bundle.close()
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  await import(pathToFileURL(file).href)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
