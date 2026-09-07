import type { CliLine } from '../store/cliStore'

/** Preserve whitespace and fence-like content in command output. */
export function terminalMarkdown(lines: CliLine[], exportedAt: Date): string {
  const labels = { cmd: 'Command', out: 'Output', err: 'Error', info: 'Information' }
  const entries = lines.map((line) => {
    const longestRun = Math.max(0, ...(line.text.match(/`+/g) ?? []).map((run) => run.length))
    const fence = '`'.repeat(Math.max(3, longestRun + 1))
    return `### ${labels[line.kind]}\n\n${fence}text\n${line.text}\n${fence}`
  })
  return `# AWS CLI terminal logs\n\nExported: ${exportedAt.toISOString()}\n\nSaved terminal entries at the time of download.\n\n${entries.join('\n\n')}\n`
}
