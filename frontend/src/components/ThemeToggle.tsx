import { Moon, Sun } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsDark } from '../hooks/useIsDark'
import { useThemeStore } from '../store/themeStore'

/** Sun/moon button that flips between light and dark (overriding System). */
export function ThemeToggle({
  className,
  variant = 'ghost',
}: {
  className?: string
  variant?: 'ghost' | 'outline'
}) {
  const dark = useIsDark()
  const setMode = useThemeStore((s) => s.setMode)
  const next = dark ? 'light' : 'dark'
  const label = `Switch to ${next} mode`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          aria-label={label}
          className={cn('text-muted-foreground hover:text-primary', className)}
          onClick={() => setMode(next)}
        >
          {dark ? <Sun /> : <Moon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
