import { ChevronRight, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

const Req = () => <span className="text-destructive">*</span>

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
      className="flex flex-col gap-3"
    >
      {withLabel && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cred-label">Name</Label>
          <div className="flex items-center gap-2">
            <Input
              id="cred-label"
              placeholder="auto-generated"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setForm((f) => ({ ...f, label: generateCodename() }))}
              title="Generate a new name"
              aria-label="Generate a new name"
            >
              <RefreshCw />
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cred-access-key">
          Access key ID <Req />
        </Label>
        <Input
          id="cred-access-key"
          placeholder="AKIA…"
          value={form.access_key_id}
          onChange={(e) => setForm({ ...form, access_key_id: e.target.value })}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cred-secret">
          Secret access key <Req />
        </Label>
        <Input
          id="cred-secret"
          type="password"
          placeholder="••••••••••••••••"
          value={form.secret_access_key}
          onChange={(e) => setForm({ ...form, secret_access_key: e.target.value })}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cred-region">Region</Label>
        <Select
          value={form.default_region}
          onValueChange={(v) => setForm({ ...form, default_region: v })}
        >
          <SelectTrigger id="cred-region" className="w-full">
            <SelectValue placeholder="Select a region" />
          </SelectTrigger>
          <SelectContent>
            {AWS_REGIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <ChevronRight className={`transition-transform ${advancedOpen ? 'rotate-90' : ''}`} />
            Advanced
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cred-endpoint">Endpoint URL</Label>
            <Input
              id="cred-endpoint"
              list="endpoint-suggestions"
              placeholder="Optional — e.g. http://localhost:4566 (Floci/LocalStack)"
              value={form.endpoint_url}
              onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })}
            />
            <datalist id="endpoint-suggestions">
              <option value="http://localhost:4566" />
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cred-session-token">Session token</Label>
            <Input
              id="cred-session-token"
              placeholder="Optional — for temporary credentials"
              value={form.session_token}
              onChange={(e) => setForm({ ...form, session_token: e.target.value })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {error != null && <ErrorAlert error={error} />}
      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  )
}
