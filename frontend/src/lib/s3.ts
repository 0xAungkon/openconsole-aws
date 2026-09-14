import { generateCodename } from './codename'

export interface BucketRow {
  Name: string
  CreationDate: string
}

export interface ObjectEntry {
  /** Full key (files) or prefix ending in "/" (folders). */
  key: string
  /** Display name relative to the current folder. */
  name: string
  kind: 'folder' | 'file'
  size: number
  lastModified: string
  storageClass: string
}

export function formatBytes(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB', 'PB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

/** Turn a list_objects_v2 page (with Delimiter="/") into folder + file entries. */
export function parseListing(result: any, prefix: string): ObjectEntry[] {
  const folders = new Map<string, ObjectEntry>()
  const folder = (key: string): ObjectEntry => ({
    key,
    name: key.slice(prefix.length).replace(/\/$/, ''),
    kind: 'folder',
    size: 0,
    lastModified: '',
    storageClass: '',
  })
  for (const p of result?.CommonPrefixes ?? []) folders.set(p.Prefix, folder(p.Prefix))

  const files: ObjectEntry[] = []
  for (const o of result?.Contents ?? []) {
    const key: string = o.Key
    // The placeholder for the current folder itself ("dir/") is not an entry.
    if (key === prefix) continue
    // Some S3 implementations list folder placeholders ("dir/") under Contents.
    if (key.endsWith('/')) {
      if (!folders.has(key)) folders.set(key, folder(key))
      continue
    }
    files.push({
      key,
      name: key.slice(prefix.length),
      kind: 'file',
      size: o.Size ?? 0,
      lastModified: o.LastModified ?? '',
      storageClass: o.StorageClass ?? '',
    })
  }
  return [...folders.values(), ...files]
}

/** Breadcrumb segments for a prefix like "a/b/c/". */
export function breadcrumbs(prefix: string): { name: string; prefix: string }[] {
  const parts = prefix.split('/').filter(Boolean)
  return parts.map((name, i) => ({ name, prefix: parts.slice(0, i + 1).join('/') + '/' }))
}

/** Globally-unique-ish, S3-valid bucket name, e.g. "cosmic-falcon-3f9a1c". */
export function generateBucketName(): string {
  const suffix = Math.random().toString(16).slice(2, 8).padEnd(6, '0')
  return `${generateCodename()}-${suffix}`
}

/** Returns a problem description, or null when the name is a valid bucket name. */
export function validateBucketName(name: string): string | null {
  if (name.length < 3 || name.length > 63) return 'Must be 3–63 characters long.'
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(name))
    return 'Use lowercase letters, numbers, dots and hyphens; start and end with a letter or number.'
  if (name.includes('..')) return 'Cannot contain two consecutive dots.'
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return 'Cannot look like an IP address.'
  if (name.startsWith('xn--') || name.endsWith('-s3alias')) return 'Reserved prefix/suffix.'
  return null
}

/** The wrapper the backend proxy decodes into raw bytes. */
export function bytesParam(base64: string) {
  return { __bytes_base64__: base64 }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.onload = () => {
      const url = reader.result as string
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.readAsDataURL(file)
  })
}

/** Max upload size through the JSON proxy (base64 inflates by ~33%). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export function fileIconKind(name: string): 'image' | 'text' | 'archive' | 'code' | 'file' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image'
  if (['txt', 'md', 'csv', 'log', 'pdf', 'doc', 'docx'].includes(ext)) return 'text'
  if (['zip', 'tar', 'gz', 'tgz', 'bz2', '7z', 'rar'].includes(ext)) return 'archive'
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'yaml', 'yml', 'html', 'css', 'sh', 'go', 'rs', 'java'].includes(ext)) return 'code'
  return 'file'
}
