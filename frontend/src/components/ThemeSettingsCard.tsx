import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { cn } from 'cn'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { THEME_COLORS, useThemeStore, type ThemeColor, type ThemeMode } from '../store/themeStore'
import { Card } from './Card'

const MODES: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Monitor },
]

export function ThemeSettingsCard() {
  const { mode, color, setMode, setColor } = useThemeStore()

  return (
    <Card title="Appearance">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label>Theme</Label>
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as ThemeMode)}
          >
            <TabsList className="w-full sm:w-auto">
              {MODES.map((m) => (
                <TabsTrigger key={m.key} value={m.key} className="px-3">
                  <m.icon />
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground">
            System follows your operating system's light/dark preference.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Accent color</Label>
          <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-2">
            {THEME_COLORS.map((c) => {
              const active = c.key === color
              return (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => setColor(c.key as ThemeColor)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
                    active && 'border-primary bg-accent text-accent-foreground',
                  )}
                >
                  <span
                    className="flex size-5 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: c.swatch }}
                  >
                    {active && <Check className="size-3.5" />}
                  </span>
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}
