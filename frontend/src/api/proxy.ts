import type { ProxyError, ProxyResponse } from '../types'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { api } from './client'

export class AwsProxyError extends Error {
  code: string
  constructor(err: ProxyError) {
    super(err.message)
    this.code = err.code
    this.name = 'AwsProxyError'
  }
}

/**
 * Assemble a raw AWS query from the current auth/session state and send it to
 * the backend proxy. Guest mode attaches inline credentials + endpoint; register
 * mode attaches the active profile id (the JWT is added by the axios interceptor).
 */
export async function runQuery<T = unknown>(
  service: string,
  operation: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const { mode, guestCreds } = useAuthStore.getState()
  const { region, endpointUrl, activeProfileId } = useSessionStore.getState()

  const body: Record<string, unknown> = { service, operation, region, params }

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
    if (activeProfileId == null)
      throw new Error('No AWS profile selected')
    body.profile_id = activeProfileId
    if (endpointUrl) body.endpoint_url = endpointUrl
  }

  // The proxy returns 200 for success and 4xx/5xx for AWS/validation errors,
  // both carrying a ProxyResponse body. Read the body regardless of status.
  const res = await api.post<ProxyResponse<T>>('/api/proxy', body, {
    validateStatus: () => true,
  })
  const data = res.data

  if (!data || data.ok === false) {
    if (data?.error) throw new AwsProxyError(data.error)
    throw new Error(`Request failed with status ${res.status}`)
  }
  return data.result as T
}

export interface TestConnectionInput {
  access_key_id: string
  secret_access_key: string
  session_token?: string
  region: string
  endpoint_url?: string
}

/**
 * Validate credentials + endpoint before persisting a profile. Uses
 * sts:GetCallerIdentity, which requires no IAM permissions and works against
 * LocalStack too. Throws AwsProxyError (code + message) on any failure — e.g. a
 * bad endpoint URL surfaces as EndpointConnectionError.
 */
export async function testConnection(input: TestConnectionInput): Promise<void> {
  const res = await api.post<ProxyResponse>(
    '/api/proxy',
    {
      service: 'sts',
      operation: 'get_caller_identity',
      region: input.region,
      params: {},
      endpoint_url: input.endpoint_url || undefined,
      credentials: {
        access_key_id: input.access_key_id,
        secret_access_key: input.secret_access_key,
        session_token: input.session_token || undefined,
      },
    },
    { validateStatus: () => true },
  )
  const data = res.data
  if (!data || data.ok === false) {
    if (data?.error) throw new AwsProxyError(data.error)
    throw new Error(`Connection test failed with status ${res.status}`)
  }
}
