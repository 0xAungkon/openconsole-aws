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
