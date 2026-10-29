import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { errorMessage } from './lib/errors'
import { toastError } from './lib/toast'
import { startHistorySync } from './store/historySync'
import { startThemeSync } from './store/themeStore'

startThemeSync()
startHistorySync()

// Every failed query/mutation surfaces as an error toast, unless it opts out
// with `meta: { silent: true }` (for inputs that show their own inline status).
// Toasts are keyed by message so a burst of identical failures (e.g. bad
// credentials across the Overview counters) collapses into one.
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silent) return
      const message = errorMessage(error)
      toastError(message, { id: `query:${message}` })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silent) return
      const message = errorMessage(error)
      toastError(message, { id: `mutation:${message}` })
    },
  }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
