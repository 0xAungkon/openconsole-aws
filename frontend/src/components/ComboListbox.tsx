import type { ReactNode } from 'react'
import { cn } from 'cn'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'

/**
 * Popover-backed listbox for the free-text combobox inputs (AMI / instance type).
 * Focus stays on the anchored input; options use `onMouseDown` preventDefault so
 * clicking them never blurs it.
 */
export function ComboListbox({
  open,
  anchor,
  listId,
  label,
  children,
  footer,
}: {
  open: boolean
  anchor: ReactNode
  listId: string
  label: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <div>{anchor}</div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) gap-0 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto p-1">
          {children}
        </div>
        {footer}
      </PopoverContent>
    </Popover>
  )
}

export function ComboOption({
  id,
  active,
  onSelect,
  className,
  children,
}: {
  id: string
  active: boolean
  onSelect: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-md px-2.5 py-2 hover:bg-accent hover:text-accent-foreground',
        active && 'bg-accent text-accent-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
