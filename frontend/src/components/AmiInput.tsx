import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { runQuery } from '../api/proxy'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

interface Ami {
  ImageId: string
  Name?: string
  Architecture?: string
  CreationDate?: string
}

interface ImagePage {
  Images?: Ami[]
  NextToken?: string
}

export function AmiInput({ id, value, required, onChange }: {
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
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(value.trim())
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const ready = mode === 'guest' ? !!guest : mode === 'register' && profileId != null

  useEffect(() => {
    const timer = setTimeout(() => setSearch(value.trim()), 300)
    return () => clearTimeout(timer)
  }, [value])

  const images = useInfiniteQuery({
    queryKey: ['ami-options', mode, userId, profileId, guest?.accessKeyId, region, endpoint, search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => runQuery<ImagePage>('ec2', 'describe_images', {
      Owners: ['amazon', 'self'],
      Filters: [
        { Name: 'state', Values: ['available'] },
        { Name: 'image-type', Values: ['machine'] },
        ...(search ? [{ Name: search.startsWith('ami-') ? 'image-id' : 'name', Values: [`*${search}*`] }] : []),
      ],
      MaxResults: 100,
      ...(pageParam ? { NextToken: pageParam } : {}),
    }),
    getNextPageParam: (page) => page.NextToken || undefined,
    enabled: ready && open && search === value.trim(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const options = search === value.trim()
    ? [...new Map((images.data?.pages.flatMap((p) => p.Images ?? []) ?? [])
      .filter((ami) => ami.ImageId)
      .map((ami) => [ami.ImageId, ami])).values()]
      .sort((a, b) => (b.CreationDate ?? '').localeCompare(a.CreationDate ?? ''))
    : []
  const custom = value.trim()
  const optionCount = options.length + (custom ? 1 : 0)

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    setActive(-1)
  }

  useEffect(() => {
    if (active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, id])

  return (
    <div className="relative" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
    }}>
      <div className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-brand-500 dark:border-gray-700 dark:bg-gray-950">
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 && active < optionCount ? `${id}-option-${active}` : undefined}
          aria-describedby={open ? `${id}-status` : undefined}
          required={required}
          value={value}
          autoComplete="off"
          placeholder="Search images or enter an AMI ID"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => { onChange(e.target.value); setActive(-1); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setOpen(true)
              setActive((i) => Math.max(0, Math.min(optionCount - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
            } else if (e.key === 'Enter' && open) {
              e.preventDefault()
              choose(options[active]?.ImageId ?? custom)
            }
          }}
          className={`min-w-0 flex-1 rounded px-1 py-0.5 text-sm outline-none ${value && !open ? 'bg-brand-50 font-mono text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' : 'bg-transparent'}`}
        />
        {value && <button type="button" aria-label="Clear image ID" onClick={() => {
          onChange('')
          setActive(-1)
          setOpen(true)
          input.current?.focus()
        }} className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X className="h-3.5 w-3.5" /></button>}
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div id={`${id}-options`} role="listbox" aria-label="AMI images" className="max-h-64 overflow-y-auto">
            {options.map((ami, index) => (
              <div key={ami.ImageId} id={`${id}-option-${index}`} role="option" aria-selected={active === index}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(ami.ImageId)}
                className={`cursor-pointer px-3 py-2 text-xs hover:bg-brand-50 dark:hover:bg-gray-800 ${active === index ? 'bg-brand-50 dark:bg-gray-800' : ''}`}>
                <div className="break-words font-medium">{ami.Name || ami.ImageId}</div>
                <div className="mt-1 text-gray-500">{ami.ImageId} · {ami.Architecture || 'Unknown architecture'}</div>
              </div>
            ))}
            {custom && <div id={`${id}-option-${options.length}`} role="option" aria-selected={active === options.length}
              onMouseDown={(e) => e.preventDefault()} onClick={() => choose(custom)}
              className={`cursor-pointer break-all border-t border-gray-100 px-3 py-2 text-xs text-brand-600 hover:bg-brand-50 dark:border-gray-800 dark:hover:bg-gray-800 ${active === options.length ? 'bg-brand-50 dark:bg-gray-800' : ''}`}>
              Use “{custom}” as a custom image ID
            </div>}
          </div>
          <div id={`${id}-status`} role="status" className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500 dark:border-gray-800">
            {!ready ? 'Configure credentials or select a profile to browse images.'
              : images.isError ? `Could not load images: ${images.error.message}. You can still enter a custom ID.`
              : images.isFetching || search !== custom ? 'Loading images…'
              : options.length === 0 ? 'No matching images. You can enter a custom ID.'
              : `Amazon and your images in ${region}. Search by name or ID.`}
            {images.isError && <button type="button" onClick={() => void images.refetch()} className="ml-2 text-brand-600">Retry</button>}
            {images.hasNextPage && <button type="button" disabled={images.isFetching} onClick={() => void images.fetchNextPage()} className="mt-2 block text-brand-600 disabled:opacity-50">Load more images</button>}
          </div>
        </div>
      )}
    </div>
  )
}
