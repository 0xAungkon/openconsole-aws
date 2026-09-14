import { CircleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { errorCode, errorMessage } from '../lib/errors'
import { AwsProxyError } from '../api/proxy'

export function ErrorAlert({ error }: { error: unknown }) {
  const code = errorCode(error) ?? 'Error'
  const message =
    error instanceof AwsProxyError ? error.message : errorMessage(error) || 'Something went wrong'

  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
      <CircleAlert />
      <AlertTitle>{code}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
