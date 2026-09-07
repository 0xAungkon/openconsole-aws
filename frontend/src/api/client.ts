import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// In dev, Vite proxies /api to the FastAPI backend (see vite.config.ts).
export const api = axios.create({ baseURL: '/' })

// Attach the JWT for register-mode requests.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
