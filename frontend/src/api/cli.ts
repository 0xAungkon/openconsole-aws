import { useAuthStore } from '../store/authStore'
import { useLogStore } from '../store/logStore'
import { useSessionStore } from '../store/sessionStore'
import { api } from './client'

export interface CliResult {
  ok: boolean
  exit_code: number
  stdout: string
  stderr: string
  /** The effective command executed (region/endpoint appended by the server). */
  command: string
}

/**
 * Send a raw `aws ...` command line to the backend, which runs the real AWS CLI
 * with the current session's credentials and returns stdout/stderr. Every run is
 * recorded in the Inspector (log store) with its command + output.
 */
export async function runCli(command: string): Promise<CliResult> {
  const { mode, guestCreds } = useAuthStore.getState()
  const { region, endpointUrl, activeProfileId } = useSessionStore.getState()

  const body: Record<string, unknown> = { command, region }

  if (mode === 'guest') {
    if (!guestCreds) throw new Error('No guest credentials configured')
    body.region = guestCreds.region || region
    body.endpoint_url = guestCreds.endpointUrl || endpointUrl || undefined
    body.credentials = {
      access_key_id: guestCreds.accessKeyId,
      secret_access_key: guestCreds.secretAccessKey,
      session_token: guestCreds.sessionToken || undefined,
    }
  } else {
    if (activeProfileId == null) throw new Error('No AWS profile selected')
    body.profile_id = activeProfileId
    if (endpointUrl) body.endpoint_url = endpointUrl
  }

  const started = performance.now()
  const res = await api.post<CliResult>('/api/cli', body, {
    validateStatus: () => true,
  })
  const durationMs = Math.round(performance.now() - started)

  const data: CliResult = res.data ?? {
    ok: false,
    exit_code: -1,
    stdout: '',
    stderr: `Request failed with status ${res.status}`,
    command,
  }

  useLogStore.getState().add({
    source: 'cli',
    command: data.command || command,
    status: data.ok ? 'ok' : 'error',
    durationMs,
    stdout: data.stdout,
    stderr: data.stderr,
    exitCode: data.exit_code,
  })

  return data
}
