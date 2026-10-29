import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { BrandLogo } from './BrandLogo'
import { SidebarNav } from './Sidebar'

/**
 * The navigation rail as a slide-in drawer, used below `lg` where there isn't
 * room for the always-visible sidebar. Reuses `SidebarNav`, so the two can't
 * drift apart; following any link closes it.
 */
export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="gap-0 bg-sidebar p-0 text-sidebar-foreground"
        aria-describedby={undefined}
      >
        <SheetHeader className="gap-3 border-b py-3 pr-12 pl-3">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <BrandLogo />
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <SidebarNav collapsed={false} onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
