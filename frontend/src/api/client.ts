import axios from 'axios'
import { toastError } from '../lib/toast'
import { useAuthStore } from '../store/authStore'
import { API_BASE_URL } from './baseUrl'

// Backend base URL comes from VITE_API_URL (see ./baseUrl.ts). In dev/preview it
// is cross-origin and FastAPI allows that origin via CORS; in the embedded build
// served by FastAPI itself it is empty, so requests stay same-origin.
export const api = axios.create({ baseURL: API_BASE_URL })

// Attach the JWT for register-mode requests.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Clear the session only when a *protected user endpoint* rejects the token as
// invalid/expired (a genuine 401). AWS/proxy errors (which can also be 401, e.g.
// NoCredentials) must NOT log the user out, so /api/proxy is excluded. A backend
// restart keeps the same JWT secret, so valid tokens keep working across it.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url: string = error.config?.url ?? ''
    const isProxy = url.includes('/api/proxy')
    if (status === 401 && !isProxy) {
      const { mode, token, reset } = useAuthStore.getState()
      if (mode === 'register' && token) {
        reset()
        toastError('Your session has expired — please sign in again.', { id: 'session-expired' })
        if (window.location.pathname !== '/') window.location.assign('/')
      }
    }
    return Promise.reject(error)
  },
)
