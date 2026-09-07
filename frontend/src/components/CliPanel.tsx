import { useEffect, useRef, useState } from 'react'
import { runCli } from '../api/cli'

interface Line {
  kind: 'cmd' | 'out' | 'err' | 'info'
  text: string
}

const HELP = `AWS CLI terminal — only "aws" commands are allowed.
Examples:
  aws s3 ls
  aws s3api list-buckets
  aws ec2 describe-instances
  aws lambda list-functions
  aws iam list-users
Region and endpoint are applied automatically from your session.
Local commands: help, clear
Tips: ↑/↓ browse history · Tab autocompletes services & subcommands`

// Autocomplete dictionary: aws → service → common subcommands.
const SERVICES = [
  's3',
  's3api',
  'ec2',
  'lambda',
  'iam',
  'rds',
  'dynamodb',
  'sts',
  'cloudwatch',
  'logs',
]

const SUBCOMMANDS: Record<string, string[]> = {
  ec2: [
    'describe-instances',
    'describe-instance-status',
    'describe-instance-types',
    'run-instances',
    'start-instances',
    'stop-instances',
    'reboot-instances',
    'terminate-instances',
    'monitor-instances',
    'unmonitor-instances',
    'describe-volumes',
    'create-tags',
    'delete-tags',
    'describe-security-groups',
    'modify-instance-attribute',
    'create-image',
    'describe-images',
    'describe-regions',
    'describe-availability-zones',
  ],
  s3: ['ls', 'cp', 'mv', 'rm', 'mb', 'rb', 'sync', 'presign'],
  s3api: [
    'list-buckets',
    'list-objects-v2',
    'create-bucket',
    'delete-bucket',
    'get-object',
    'put-object',
  ],
  lambda: [
    'list-functions',
    'get-function',
    'invoke',
    'create-function',
    'delete-function',
  ],
  iam: [
    'list-users',
    'list-roles',
    'get-user',
    'create-user',
    'delete-user',
    'list-access-keys',
  ],
  rds: [
    'describe-db-instances',
    'start-db-instance',
    'stop-db-instance',
    'create-db-instance',
  ],
  dynamodb: ['list-tables', 'describe-table', 'create-table', 'delete-table', 'scan', 'query'],
  sts: ['get-caller-identity'],
  cloudwatch: ['list-metrics', 'get-metric-statistics'],
  logs: ['describe-log-groups', 'describe-log-streams', 'get-log-events'],
}

function commonPrefix(items: string[]): string {
  if (items.length === 0) return ''
  let prefix = items[0]
  for (const s of items.slice(1)) {
    while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1)
  }
  return prefix
}

/** Bash-style completion: returns the new input value and any ambiguous matches. */
function complete(input: string): { value: string; matches: string[] } {
  const endsWithSpace = /\s$/.test(input)
  const trimmed = input.replace(/^\s+/, '')
  const tokens = trimmed.length ? trimmed.split(/\s+/) : []
  const editingNew = endsWithSpace || tokens.length === 0
  const idx = editingNew ? tokens.length : tokens.length - 1
  const partial = editingNew ? '' : tokens[idx]

  let candidates: string[] = []
  if (idx === 0) candidates = ['aws']
  else if (idx === 1) candidates = SERVICES
  else if (idx === 2) candidates = SUBCOMMANDS[tokens[1]] ?? []

  const matches = candidates.filter((c) => c.startsWith(partial))
  if (matches.length === 0) return { value: input, matches: [] }

  const base = editingNew ? tokens : tokens.slice(0, -1)
  if (matches.length === 1) {
    return { value: [...base, matches[0]].join(' ') + ' ', matches: [] }
  }
  const prefix = commonPrefix(matches)
  const value = prefix.length > partial.length ? [...base, prefix].join(' ') : input
  return { value, matches }
}

export function CliPanel() {
  const [lines, setLines] = useState<Line[]>([
    { kind: 'info', text: 'AWS CLI terminal. Type "help" to get started.' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines])

  function push(...l: Line[]) {
    setLines((prev) => [...prev, ...l])
  }

  async function run(raw: string) {
    const cmd = raw.trim()
    if (!cmd) return
    setHistory((h) => [...h, cmd])
    setHistIdx(null)
    push({ kind: 'cmd', text: `➜ ${cmd}` })

    if (cmd === 'clear') {
      setLines([])
      return
    }
    if (cmd === 'help') {
      push({ kind: 'info', text: HELP })
      return
    }
    if (!/^aws(\s|$)/.test(cmd)) {
      push({
        kind: 'err',
        text: "Only 'aws' commands are allowed here. Try `aws s3 ls`. Type 'help' for examples.",
      })
      return
    }

    setBusy(true)
    try {
      const res = await runCli(cmd)
      const out = res.stdout.replace(/\n+$/, '')
      const err = res.stderr.replace(/\n+$/, '')
      if (out) push({ kind: 'out', text: out })
      if (err) push({ kind: res.ok ? 'info' : 'err', text: err })
      if (!out && !err) {
        push({
          kind: 'info',
          text: res.ok ? '(no output)' : `exited with code ${res.exit_code}`,
        })
      }
    } catch (err) {
      push({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const { value, matches } = complete(input)
      if (value !== input) setInput(value)
      if (matches.length > 1) {
        push({ kind: 'cmd', text: `➜ ${input}` })
        push({ kind: 'info', text: matches.join('   ') })
      }
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const idx = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1)
      setHistIdx(idx)
      setInput(history[idx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx === null) return
      const idx = histIdx + 1
      if (idx >= history.length) {
        setHistIdx(null)
        setInput('')
      } else {
        setHistIdx(idx)
        setInput(history[idx])
      }
    }
  }

  return (
    <div
      className="flex h-full flex-col bg-gray-950 font-mono text-xs text-gray-200"
      onClick={() => inputRef.current?.focus()}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        {lines.map((l, i) => (
          <pre
            key={i}
            className={`whitespace-pre-wrap break-words ${
              l.kind === 'cmd'
                ? 'text-brand-300'
                : l.kind === 'err'
                  ? 'text-red-400'
                  : l.kind === 'info'
                    ? 'text-gray-500'
                    : 'text-gray-200'
            }`}
          >
            {l.text}
          </pre>
        ))}
        {busy && <div className="text-gray-500">running…</div>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(input)
          setInput('')
        }}
        className="flex items-center gap-2 border-t border-gray-800 px-3 py-1.5"
      >
        <span className="shrink-0 select-none">
          <span className="text-green-400">➜</span>{' '}
          <span className="text-brand-400">~</span>
        </span>
        <input
          ref={inputRef}
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="aws s3 ls"
          spellCheck={false}
          autoComplete="off"
          disabled={busy}
          className="flex-1 bg-transparent text-gray-100 placeholder-gray-600 focus:outline-none disabled:opacity-60"
        />
      </form>
    </div>
  )
}
