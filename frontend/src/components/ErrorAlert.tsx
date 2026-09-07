import { AwsProxyError } from '../api/proxy'

export function ErrorAlert({ error }: { error: unknown }) {
  let code = 'Error'
  let message = 'Something went wrong'

  if (error instanceof AwsProxyError) {
    code = error.code
    message = error.message
  } else if (error instanceof Error) {
    message = error.message
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900/50 dark:bg-red-950/40">
      <div className="font-semibold text-red-700 dark:text-red-300">{code}</div>
      <div className="mt-0.5 text-red-600 dark:text-red-400">{message}</div>
    </div>
  )
}
