import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeColor = 'blue' | 'teal' | 'green' | 'violet' | 'orange' | 'rose'

export const THEME_COLORS: { key: ThemeColor; label: string; swatch: string }[] = [
  { key: 'blue', label: 'Blue', swatch: '#1f6feb' },
  { key: 'teal', label: 'Teal', swatch: '#0d9488' },
  { key: 'green', label: 'Green', swatch: '#16a34a' },
  { key: 'violet', label: 'Violet', swatch: '#7c3aed' },
  { key: 'orange', label: 'Orange', swatch: '#ea580c' },
  { key: 'rose', label: 'Rose', swatch: '#e11d48' },
]

interface ThemeState {
  mode: ThemeMode
  color: ThemeColor
  setMode: (mode: ThemeMode) => void
  setColor: (color: ThemeColor) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      color: 'blue',
      setMode: (mode) => set({ mode }),
      setColor: (color) => set({ color }),
    }),
    { name: 'aws-openconsole-theme' },
  ),
)

const media = window.matchMedia('(prefers-color-scheme: dark)')

/** Resolve the effective light/dark value for a mode. */
export function resolveDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && media.matches)
}

function apply({ mode, color }: Pick<ThemeState, 'mode' | 'color'>) {
  const root = document.documentElement
  root.classList.toggle('dark', resolveDark(mode))
  root.dataset.theme = color
}

/** Apply the persisted theme to <html> and keep it in sync with changes. */
export function startThemeSync() {
  apply(useThemeStore.getState())
  useThemeStore.subscribe(apply)
  media.addEventListener('change', () => apply(useThemeStore.getState()))
}
