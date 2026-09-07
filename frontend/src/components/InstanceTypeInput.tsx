import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { runQuery } from '../api/proxy'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

interface InstanceType {
  InstanceType: string
  VCpuInfo?: { DefaultVCpus?: number }
  MemoryInfo?: { SizeInMiB?: number }
  ProcessorInfo?: { SupportedArchitectures?: string[] }
}

function details(type: InstanceType) {
  const cpus = type.VCpuInfo?.DefaultVCpus
  const memory = type.MemoryInfo?.SizeInMiB
  return `${cpus == null ? 'CPU count unavailable' : `${cpus} virtual CPU${cpus === 1 ? '' : 's'}`} · ${memory == null ? 'Memory unavailable' : `${memory / 1024} GiB memory (${memory.toLocaleString()} MiB)`}`
}

function architecture(type: InstanceType) {
  return type.ProcessorInfo?.SupportedArchitectures?.map((value) =>
    value === 'x86_64' ? '64-bit Intel / AMD' : value === 'arm64' ? '64-bit ARM' : value,
  ).join(', ') || 'Architecture not provided'
}

export function InstanceTypeInput({ id, value, required, onChange }: {
  id: string
  value: string
  required?: boolean
  onChange: (value: string) => void
}) {
  const mode = useAuthStore((s) => s.mode)
  const guest = useAuthStore((s) => s.guestCreds)
  const userId = useAuthStore((s) => s.user?.id)
  const profileId = useSessionStore((s) => s.activeProfileId)
  const sessionRegion = useSessionStore((s) => s.region)
  const sessionEndpoint = useSessionStore((s) => s.endpointUrl)
  const region = mode === 'guest' ? guest?.region || sessionRegion : sessionRegion
  const endpoint = mode === 'guest' ? guest?.endpointUrl || sessionEndpoint : sessionEndpoint
  const ready = mode === 'guest' ? !!guest : mode === 'register' && profileId != null
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const types = useQuery({
    queryKey: ['instance-type-options', mode, userId, profileId, guest?.accessKeyId, region, endpoint],
    queryFn: async ({ signal }) => {
      const results = new Map<string, InstanceType>()
      const tokens = new Set<string>()
      let nextToken: string | undefined
      do {
        signal.throwIfAborted()
        const page = await runQuery<{ InstanceTypes?: InstanceType[]; NextToken?: string }>('ec2', 'describe_instance_types', {
          MaxResults: 100,
          ...(nextToken ? { NextToken: nextToken } : {}),
        })
        signal.throwIfAborted()
        for (const type of page.InstanceTypes ?? []) if (type.InstanceType) results.set(type.InstanceType, type)
        nextToken = page.NextToken || undefined
        if (nextToken) {
          if (tokens.has(nextToken)) throw new Error('Could not retrieve the complete list of server sizes. Please retry.')
          tokens.add(nextToken)
        }
      } while (nextToken)
      return [...results.values()].sort((a, b) =>
        (a.VCpuInfo?.DefaultVCpus ?? Infinity) - (b.VCpuInfo?.DefaultVCpus ?? Infinity)
        || (a.MemoryInfo?.SizeInMiB ?? Infinity) - (b.MemoryInfo?.SizeInMiB ?? Infinity)
        || a.InstanceType.localeCompare(b.InstanceType, undefined, { numeric: true }))
    },
    enabled: ready,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const selected = types.data?.find((type) => type.InstanceType === value.trim())
  const term = search.trim().toLowerCase()
  const options = (types.data ?? []).filter((type) =>
    `${type.InstanceType} ${details(type)} ${architecture(type)}`.toLowerCase().includes(term))
  const custom = search.trim()
  const showCustom = !!custom && !options.some((type) => type.InstanceType === custom)
  const count = options.length + (showCustom ? 1 : 0)

  function choose(next: string) {
    onChange(next)
    setSearch('')
    setActive(-1)
    setOpen(false)
  }

  useEffect(() => {
    if (active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, id])

  return (
    <div className="relative" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) { setOpen(false); setSearch(''); setActive(-1) }
    }}>
      {selected && <div id={`${id}-selection`} className="mb-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5 dark:border-brand-800 dark:bg-brand-900/20">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-200"><Check aria-hidden="true" className="h-3.5 w-3.5" /> Selected server size</div>
        <div className="text-sm font-semibold">{selected.InstanceType}</div>
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">{details(selected)}</div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{architecture(selected)}</div>
      </div>}
      <div className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-brand-500 dark:border-gray-700 dark:bg-gray-950">
        <input ref={input} id={id} role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 && active < count ? `${id}-option-${active}` : undefined}
          aria-describedby={`${id}-status${selected ? ` ${id}-selection` : ''}`}
          required={required} value={value} autoComplete="off" placeholder="Choose a server size or enter a type"
          onFocus={() => { setSearch(''); setOpen(true) }} onClick={() => setOpen(true)}
          onChange={(e) => { onChange(e.target.value); setSearch(e.target.value); setActive(-1); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault(); setOpen(true)
              setActive((i) => Math.max(0, Math.min(count - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))
            } else if (e.key === 'Escape') {
              e.preventDefault(); setOpen(false); setActive(-1)
            } else if (e.key === 'Enter' && open) {
              e.preventDefault(); choose(options[active]?.InstanceType ?? value.trim())
            }
          }} className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none" />
        {value && <button type="button" aria-label="Clear server size" onClick={() => {
          onChange(''); setSearch(''); setActive(-1); input.current?.focus()
        }} className="rounded p-1 text-gray-400"><X className="h-3.5 w-3.5" /></button>}
        <button type="button" aria-label="Browse server sizes" onClick={() => { input.current?.focus(); setSearch(''); setOpen(true) }} className="rounded p-1 text-gray-400"><ChevronDown className="h-4 w-4" /></button>
      </div>
      {open && <div className="absolute z-30 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
        <div id={`${id}-options`} role="listbox" aria-label="Server sizes" className="max-h-64 overflow-y-auto">
          {options.map((type, index) => <div key={type.InstanceType} id={`${id}-option-${index}`} role="option" aria-selected={active === index}
            onMouseDown={(e) => e.preventDefault()} onClick={() => choose(type.InstanceType)}
            className={`cursor-pointer px-3 py-2 hover:bg-brand-50 dark:hover:bg-gray-800 ${active === index ? 'bg-brand-50 dark:bg-gray-800' : ''}`}>
            <div className="text-sm font-medium">{type.InstanceType}</div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">{details(type)}</div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{architecture(type)}</div>
          </div>)}
          {showCustom && <div id={`${id}-option-${options.length}`} role="option" aria-selected={active === options.length}
            onMouseDown={(e) => e.preventDefault()} onClick={() => choose(custom)}
            className={`cursor-pointer break-all px-3 py-2 text-xs text-brand-600 hover:bg-brand-50 dark:hover:bg-gray-800 ${active === options.length ? 'bg-brand-50 dark:bg-gray-800' : ''}`}>Use “{custom}” as a custom instance type</div>}
        </div>
      </div>}
      <div id={`${id}-status`} role="status" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {!ready ? 'Configure credentials or select a profile to browse server sizes.'
          : types.isError ? `Could not load server sizes: ${types.error.message} You can still enter a type manually.`
          : types.isPending ? 'Loading server sizes…'
          : open && options.length === 0 ? 'No matching server sizes. Try another search or enter a custom type.'
          : `Server sizes in ${region}. Memory is shown in GiB and MiB.`}
        {types.isError && <button type="button" onClick={() => void types.refetch()} className="ml-2 text-brand-600">Retry</button>}
      </div>
    </div>
  )
}
