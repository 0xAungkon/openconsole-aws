import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// Backend base URL comes from the environment (VITE_API_URL). Requests are made
// cross-origin directly to FastAPI; the backend allows this origin via CORS.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

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
        if (window.location.pathname !== '/') window.location.assign('/')
      }
    }
    return Promise.reject(error)
  },
)
