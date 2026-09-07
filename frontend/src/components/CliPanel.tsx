import { useEffect, useRef, useState } from 'react'
import { AwsProxyError, runQuery } from '../api/proxy'

interface Line {
  kind: 'cmd' | 'out' | 'err' | 'info'
  text: string
}

const HELP = `Usage: [aws] <service> <operation> [json-params]
Examples:
  s3 list_buckets
  ec2 describe_instances
  dynamodb list_tables
  s3 list_objects_v2 {"Bucket":"my-bucket"}
Commands: help, clear`

export function CliPanel() {
  const [lines, setLines] = useState<Line[]>([
    { kind: 'info', text: 'Type "help" to get started.' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines])

  function push(...l: Line[]) {
    setLines((prev) => [...prev, ...l])
  }

  async function run(raw: string) {
    const cmd = raw.trim()
    if (!cmd) return
    push({ kind: 'cmd', text: `$ ${cmd}` })

    if (cmd === 'clear') {
      setLines([])
      return
    }
    if (cmd === 'help') {
      push({ kind: 'info', text: HELP })
      return
    }

    let tokens = cmd.split(/\s+/)
    if (tokens[0] === 'aws') tokens = tokens.slice(1)
    const [service, operation, ...rest] = tokens
    if (!service || !operation) {
      push({ kind: 'err', text: 'Expected: <service> <operation> [json-params]' })
      return
    }

    let params: Record<string, unknown> = {}
    const jsonStr = cmd.slice(cmd.indexOf(operation) + operation.length).trim()
    if (rest.length && jsonStr) {
      try {
        params = JSON.parse(jsonStr)
      } catch {
        push({ kind: 'err', text: 'Params must be valid JSON' })
        return
      }
    }

    setBusy(true)
    try {
      const result = await runQuery(service, operation, params)
      push({ kind: 'out', text: JSON.stringify(result, null, 2) })
    } catch (err) {
      const msg =
        err instanceof AwsProxyError
          ? `${err.code}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err)
      push({ kind: 'err', text: msg })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-gray-950 font-mono text-xs text-gray-200">
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
        <span className="text-brand-400">$</span>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="s3 list_buckets"
          spellCheck={false}
          className="flex-1 bg-transparent text-gray-100 placeholder-gray-600 focus:outline-none"
        />
      </form>
    </div>
  )
}
