/**
 * A random unique id, safe on insecure origins.
 *
 * `crypto.randomUUID()` is only exposed in *secure* contexts. This app is
 * routinely opened over plain HTTP on a LAN/Tailscale IP (e.g.
 * http://100.106.225.24:4567), where `crypto.randomUUID` is simply
 * `undefined` and every call throws `TypeError: crypto.randomUUID is not a
 * function`. `localhost` counts as trustworthy, so the failure stays hidden
 * during local development and only shows up on the network URL.
 *
 * `crypto.getRandomValues()` *is* available in insecure contexts, so build a
 * v4 UUID from it. Only if crypto is missing entirely do we fall back to a
 * weaker id — still unique enough for React keys and history records.
 */
export function uid(): string {
  const c = globalThis.crypto

  if (typeof c?.randomUUID === 'function') return c.randomUUID()

  if (typeof c?.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40 // version 4
    b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 variant
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'))
    return [
      h.slice(0, 4).join(''),
      h.slice(4, 6).join(''),
      h.slice(6, 8).join(''),
      h.slice(8, 10).join(''),
      h.slice(10, 16).join(''),
    ].join('-')
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
