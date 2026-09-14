import type { ReactNode } from 'react'
import { cn } from 'cn'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Tailwind max-width class for the panel, e.g. "sm:max-w-md". */
  width?: string
}

/** Right-side slide-over panel built on shadcn Sheet. Backdrop click and Esc close it. */
export function Drawer({ open, onClose, title, description, children, width = 'sm:max-w-md' }: DrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className={cn('gap-0 p-0', width)}>
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-4 w-[3px] rounded-full bg-primary" />
            {title}
          </SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">Side panel</SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
