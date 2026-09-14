import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ActionField, ServiceAction } from '../types'
import { AmiInput } from './AmiInput'
import { InstanceTypeInput } from './InstanceTypeInput'

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

  const set = (name: string) => (value: string) => setValues((v) => ({ ...v, [name]: value }))

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {action.fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No parameters required — run to fetch results.
        </p>
      )}
      {action.fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-1.5">
          <Label htmlFor={`field-${f.name}`}>
            {f.label}
            {f.required && <span className="text-destructive">*</span>}
          </Label>
          {f.suggestions === 'ami' ? (
            <AmiInput
              id={`field-${f.name}`}
              value={values[f.name] ?? ''}
              required={f.required}
              onChange={set(f.name)}
            />
          ) : f.suggestions === 'instance-type' ? (
            <InstanceTypeInput
              id={`field-${f.name}`}
              value={values[f.name] ?? ''}
              required={f.required}
              onChange={set(f.name)}
            />
          ) : f.type === 'json' ? (
            <Textarea
              id={`field-${f.name}`}
              value={values[f.name] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => set(f.name)(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
          ) : (
            <Input
              id={`field-${f.name}`}
              value={values[f.name] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => set(f.name)(e.target.value)}
            />
          )}
          {f.help && <span className="text-xs text-muted-foreground">{f.help}</span>}
        </div>
      ))}
      {jsonError && <p className="text-sm text-destructive">{jsonError}</p>}
      <div>
        <Button type="submit" disabled={running}>
          {running ? 'Running…' : 'Run'}
        </Button>
      </div>
    </form>
  )
}
