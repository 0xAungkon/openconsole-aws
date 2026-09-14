import { useSyncExternalStore } from 'react'

const html = () => document.documentElement

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(html(), { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

/** True while `<html>` carries the `.dark` class (the app's dark-mode switch). */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => html().classList.contains('dark'),
    () => false,
  )
}
