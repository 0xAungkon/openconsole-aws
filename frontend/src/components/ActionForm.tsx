import { useEffect, useState } from 'react'
import type { ActionField, ServiceAction } from '../types'

interface ActionFormProps {
  action: ServiceAction
  running: boolean
  onRun: (params: Record<string, unknown>) => void
}

function buildParams(
  fields: ActionField[],
  raw: Record<string, string>,
): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  for (const f of fields) {
    const v = (raw[f.name] ?? '').trim()
    if (v === '') continue
    switch (f.type) {
      case 'number':
        params[f.name] = Number(v)
        break
      case 'boolean':
        params[f.name] = v === 'true'
        break
      case 'list-string':
        params[f.name] = v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        break
      case 'json':
        params[f.name] = v // parsed by caller-side; kept as string here
        break
      default:
        params[f.name] = v
    }
  }
  return params
}

function initialValues(fields: ActionField[]): Record<string, string> {
  const v: Record<string, string> = {}
  for (const f of fields) if (f.default != null) v[f.name] = f.default
  return v
}

export function ActionForm({ action, running, onRun }: ActionFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(action.fields),
  )
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Reset form fields (to their defaults) when the selected action changes.
  useEffect(() => {
    setValues(initialValues(action.fields))
    setJsonError(null)
  }, [action.id, action.fields])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setJsonError(null)
    const params = buildParams(action.fields, values)

    // Validate + parse JSON fields.
    for (const f of action.fields) {
      if (f.type === 'json' && typeof params[f.name] === 'string') {
        try {
          params[f.name] = JSON.parse(params[f.name] as string)
        } catch {
          setJsonError(`"${f.label}" must be valid JSON`)
          return
        }
      }
    }
    onRun(params)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {action.fields.length === 0 && (
        <p className="text-sm text-gray-500">
          No parameters required — run to fetch results.
        </p>
      )}
      {action.fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {f.label}
            {f.required && <span className="text-red-500"> *</span>}
          </span>
          {f.type === 'json' ? (
            <textarea
              value={values[f.name] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.name]: e.target.value }))
              }
              rows={4}
              className="rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950"
            />
          ) : (
            <input
              value={values[f.name] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.name]: e.target.value }))
              }
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950"
            />
          )}
          {f.help && <span className="text-xs text-gray-400">{f.help}</span>}
        </label>
      ))}
      {jsonError && <p className="text-sm text-red-600">{jsonError}</p>}
      <div>
        <button
          type="submit"
          disabled={running}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
        >
          {running ? 'Running…' : 'Run'}
        </button>
      </div>
    </form>
  )
}
