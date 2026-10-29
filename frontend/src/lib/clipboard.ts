/**
 * Copy text to the clipboard, reporting success instead of throwing.
 *
 * The async Clipboard API is only exposed in *secure* contexts, so on this
 * app's plain-HTTP LAN/Tailscale URL `navigator.clipboard` is `undefined`.
 * `document.execCommand('copy')` has no such restriction (it does need a user
 * gesture, which a button click provides), so fall back to it.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission denied or a sandboxed iframe — try the legacy path below.
    }
  }
  return legacyCopy(text)
}

/** Fills an offscreen textarea and runs the legacy copy command. */
function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    // Offscreen, but not `display:none` — execCommand needs it rendered.
    area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
    document.body.appendChild(area)

    const selection = document.getSelection()
    const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

    area.select()
    area.setSelectionRange(0, area.value.length)
    const ok = document.execCommand('copy')

    area.remove()
    if (selection && previous) {
      selection.removeAllRanges()
      selection.addRange(previous)
    }
    return ok
  } catch {
    return false
  }
}
