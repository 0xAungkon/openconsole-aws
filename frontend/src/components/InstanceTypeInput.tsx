import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { runQuery } from '../api/proxy'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { ComboListbox, ComboOption } from './ComboListbox'

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
    meta: { silent: true },
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
    <div onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) { setOpen(false); setSearch(''); setActive(-1) }
    }}>
      {selected && <div id={`${id}-selection`} className="mb-2 rounded-md border border-primary/30 bg-accent px-3 py-2.5">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-accent-foreground"><Check aria-hidden="true" className="size-3.5" /> Selected server size</div>
        <div className="text-sm font-semibold">{selected.InstanceType}</div>
        <div className="mt-1 text-xs text-muted-foreground">{details(selected)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{architecture(selected)}</div>
      </div>}
      <ComboListbox
        open={open}
        listId={`${id}-options`}
        label="Server sizes"
        anchor={
          <div className="relative">
            <Input ref={input} id={id} role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-autocomplete="list"
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
              }} className="pr-16" />
            <div className="absolute inset-y-0 right-1 flex items-center">
              {value && <Button type="button" variant="ghost" size="icon-xs" aria-label="Clear server size" className="text-muted-foreground" onClick={() => {
                onChange(''); setSearch(''); setActive(-1); input.current?.focus()
              }}><X /></Button>}
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Browse server sizes" className="text-muted-foreground" onClick={() => { input.current?.focus(); setSearch(''); setOpen(true) }}><ChevronDown /></Button>
            </div>
          </div>
        }
      >
        {options.map((type, index) => <ComboOption key={type.InstanceType} id={`${id}-option-${index}`} active={active === index} onSelect={() => choose(type.InstanceType)}>
          <div className="text-sm font-medium">{type.InstanceType}</div>
          <div className="mt-1 text-xs text-muted-foreground">{details(type)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{architecture(type)}</div>
        </ComboOption>)}
        {showCustom && <ComboOption id={`${id}-option-${options.length}`} active={active === options.length} onSelect={() => choose(custom)} className="break-all text-xs text-primary">
          Use “{custom}” as a custom instance type
        </ComboOption>}
      </ComboListbox>
      <div id={`${id}-status`} role="status" className="mt-1 text-xs text-muted-foreground">
        {!ready ? 'Configure credentials or select a profile to browse server sizes.'
          : types.isError ? `Could not load server sizes: ${types.error.message} You can still enter a type manually.`
          : types.isPending ? 'Loading server sizes…'
          : open && options.length === 0 ? 'No matching server sizes. Try another search or enter a custom type.'
          : `Server sizes in ${region}. Memory is shown in GiB and MiB.`}
        {types.isError && <Button type="button" variant="link" size="xs" onClick={() => void types.refetch()}>Retry</Button>}
      </div>
    </div>
  )
}
