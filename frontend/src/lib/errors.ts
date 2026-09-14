import axios from 'axios'
import { AwsProxyError } from '../api/proxy'

/**
 * Turn any thrown value into a human-readable message. Understands the shapes
 * this app produces: AwsProxyError (code + message), FastAPI `{detail}` bodies,
 * axios network failures, and plain Errors.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof AwsProxyError) return `${err.code}: ${err.message}`
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      // FastAPI validation errors: [{loc, msg, type}]
      return detail
        .map((d) => (typeof d?.msg === 'string' ? d.msg : JSON.stringify(d)))
        .join('; ')
    }
    if (!err.response) return `Cannot reach the backend at ${err.config?.baseURL ?? ''}`.trim()
    return `Request failed with status ${err.response.status}`
  }
  if (err instanceof Error) return err.message
  return String(err)
}

/** The short code for an error (e.g. an AWS error code), when there is one. */
export function errorCode(err: unknown): string | undefined {
  if (err instanceof AwsProxyError) return err.code
  if (axios.isAxiosError(err)) {
    const code = err.response?.data?.code
    if (typeof code === 'string') return code
    if (!err.response) return 'NetworkError'
  }
  return undefined
}
