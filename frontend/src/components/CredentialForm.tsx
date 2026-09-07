import { ChevronRight, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { generateCodename } from '../lib/codename'
import { AWS_REGIONS } from '../store/sessionStore'
import { ErrorAlert } from './ErrorAlert'

export interface CredentialValues {
  label: string
  access_key_id: string
  secret_access_key: string
  session_token: string
  endpoint_url: string
  default_region: string
}

const EMPTY: CredentialValues = {
  label: '',
  access_key_id: '',
  secret_access_key: '',
  session_token: '',
  endpoint_url: '',
  default_region: 'us-east-1',
}

interface CredentialFormProps {
  /** Show the profile label field (register mode). Guest mode omits it. */
  withLabel?: boolean
  submitLabel: string
  /** Text shown on the submit button while pending (defaults to "Saving…"). */
  pendingLabel?: string
  pending?: boolean
  error?: unknown
  onSubmit: (values: CredentialValues) => void
}

/**
 * Shared AWS-credential form used by both guest entry and register onboarding.
 * Session token + endpoint URL live under a collapsible "Advanced" section.
 */
export function CredentialForm({
  withLabel = false,
  submitLabel,
  pendingLabel = 'Saving…',
  pending = false,
  error,
  onSubmit,
}: CredentialFormProps) {
  // Register mode auto-generates a friendly Name (e.g. "cosmic-falcon").
  const [form, setForm] = useState(() =>
    withLabel ? { ...EMPTY, label: generateCodename() } : EMPTY,
  )
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const input =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950'
  const labelText = 'font-medium text-gray-700 dark:text-gray-200'
  const req = <span className="text-red-500"> *</span>

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
      className="flex flex-col gap-3"
    >
      {withLabel && (
        <label className="flex flex-col gap-1 text-sm">
          <span className={labelText}>Name</span>
          <div className="flex items-center gap-2">
            <input
              className={input}
              placeholder="auto-generated"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
            />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, label: generateCodename() }))}
              className="shrink-0 rounded-md border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 hover:text-brand-600 dark:border-gray-700 dark:hover:bg-gray-800"
              title="Generate a new name"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className={labelText}>Access key ID{req}</span>
        <input
          className={input}
          placeholder="AKIA…"
          value={form.access_key_id}
          onChange={(e) => setForm({ ...form, access_key_id: e.target.value })}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className={labelText}>Secret access key{req}</span>
        <input
          className={input}
          type="password"
          placeholder="••••••••••••••••"
          value={form.secret_access_key}
          onChange={(e) => setForm({ ...form, secret_access_key: e.target.value })}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className={labelText}>Region</span>
        <select
          className={input}
          value={form.default_region}
          onChange={(e) => setForm({ ...form, default_region: e.target.value })}
        >
          {AWS_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 transition ${advancedOpen ? 'rotate-90' : ''}`}
          />
          Advanced
        </button>
        {advancedOpen && (
          <div className="mt-2 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className={labelText}>Endpoint URL</span>
              <input
                className={input}
                list="endpoint-suggestions"
                placeholder="Optional — e.g. http://localhost:4566 (Floci/LocalStack)"
                value={form.endpoint_url}
                onChange={(e) =>
                  setForm({ ...form, endpoint_url: e.target.value })
                }
              />
              <datalist id="endpoint-suggestions">
                <option value="http://localhost:4566" />
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className={labelText}>Session token</span>
              <input
                className={input}
                placeholder="Optional — for temporary credentials"
                value={form.session_token}
                onChange={(e) =>
                  setForm({ ...form, session_token: e.target.value })
                }
              />
            </label>
          </div>
        )}
      </div>

      {error != null && <ErrorAlert error={error} />}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  )
}
