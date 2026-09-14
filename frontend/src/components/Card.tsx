import type { ReactNode } from 'react'
import { cn } from 'cn'
import {
  Card as UiCard,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface CardProps {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/** App card: shadcn Card with the 1Panel-style vertical blue accent-bar title. */
export function Card({ title, actions, children, className }: CardProps) {
  return (
    <UiCard className={cn('gap-0 py-0', className)}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3">
          {title && (
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="inline-block h-4 w-[3px] rounded-full bg-primary" />
              {title}
            </CardTitle>
          )}
          {actions && (
            <CardAction className="row-span-1 flex items-center gap-2 self-center">
              {actions}
            </CardAction>
          )}
        </CardHeader>
      )}
      <CardContent className="p-4">{children}</CardContent>
    </UiCard>
  )
}
