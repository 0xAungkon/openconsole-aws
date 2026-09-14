import { Hexagon } from 'lucide-react'
import { cn } from 'cn'
import { BRAND_BADGE, BRAND_NAME } from '../brand'

/** Product wordmark: hexagon + name + badge, as shown in the sidebar. */
export function BrandLogo({ size = 'sm', className }: { size?: 'sm' | 'lg'; className?: string }) {
  const lg = size === 'lg'
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Hexagon className={cn('shrink-0 text-primary', lg ? 'h-8 w-8' : 'h-5 w-5')} />
      <span className={cn('font-semibold leading-tight text-foreground', lg ? 'text-xl' : 'text-sm')}>
        {BRAND_NAME}
        <sup
          className={cn(
            'ml-1.5 font-semibold uppercase tracking-wide text-primary',
            lg ? 'text-[11px]' : 'text-[9px]',
          )}
        >
          {BRAND_BADGE}
        </sup>
      </span>
    </span>
  )
}
