import type { StoredProfile } from '../types'

/** Turn a profile label into a URL-safe slug, e.g. "Cosmic Falcon" -> "cosmic-falcon". */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Find the profile whose slug matches the URL param. */
export function findProfileBySlug(
  profiles: StoredProfile[],
  slug: string | undefined,
): StoredProfile | undefined {
  if (!slug) return undefined
  return profiles.find((p) => slugify(p.label) === slug)
}
