import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { runQuery } from '../api/proxy'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { ComboListbox, ComboOption } from './ComboListbox'

interface Ami {
  ImageId: string
  Name?: string
  Architecture?: string
  CreationDate?: string
  Description?: string
  Tags?: { Key?: string; Value?: string }[]
}

function imageName(ami: Ami): string {
  return ami.Tags?.find((tag) => tag.Key === 'Name')?.Value || ami.Name || 'Unnamed image'
}

function architectureLabel(architecture?: string): string {
  if (architecture === 'x86_64') return '64-bit Intel / AMD'
  if (architecture === 'arm64') return '64-bit ARM'
  return architecture || 'Architecture not provided'
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
  // Retain the name when selecting an ID changes the search results.
  const [selection, setSelection] = useState<{ image: Ami; scope: string } | null>(null)
  const scope = JSON.stringify([mode, userId, profileId, guest?.accessKeyId, region, endpoint])
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
    meta: { silent: true },
  })
  const options = search === value.trim()
    ? [...new Map((images.data?.pages.flatMap((p) => p.Images ?? []) ?? [])
      .filter((ami) => ami.ImageId)
      .map((ami) => [ami.ImageId, ami])).values()]
      .sort((a, b) => (b.CreationDate ?? '').localeCompare(a.CreationDate ?? ''))
    : []
  const custom = value.trim()
  const optionCount = options.length + (custom ? 1 : 0)
  const selectedImage = selection?.scope === scope && selection.image.ImageId === value.trim()
    ? selection.image
    : options.find((ami) => ami.ImageId === value.trim())

  function choose(next: string) {
    const image = options.find((ami) => ami.ImageId === next) ?? (selectedImage?.ImageId === next ? selectedImage : undefined)
    setSelection(image ? { image, scope } : null)
    onChange(next)
    setOpen(false)
    setActive(-1)
  }

  useEffect(() => {
    if (active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, id])

  return (
    <div onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
    }}>
      {selectedImage && (
        <div id={`${id}-selection`} className="mb-2 rounded-md border border-primary/30 bg-accent px-3 py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-accent-foreground">
            <Check aria-hidden="true" className="size-3.5" /> Selected image
          </div>
          <div className="break-words text-sm font-semibold">{imageName(selectedImage)}</div>
          <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{selectedImage.ImageId}</div>
          <div className="mt-1 text-xs text-muted-foreground">{architectureLabel(selectedImage.Architecture)}</div>
          {selectedImage.Description && <p className="mt-2 break-words text-xs text-muted-foreground">{selectedImage.Description}</p>}
        </div>
      )}
      <ComboListbox
        open={open}
        listId={`${id}-options`}
        label="AMI images"
        anchor={
          <div className="relative">
            <Input
              ref={input}
              id={id}
              role="combobox"
              aria-expanded={open}
              aria-controls={`${id}-options`}
              aria-autocomplete="list"
              aria-activedescendant={open && active >= 0 && active < optionCount ? `${id}-option-${active}` : undefined}
              aria-describedby={[selectedImage ? `${id}-selection` : '', open ? `${id}-status` : ''].filter(Boolean).join(' ') || undefined}
              required={required}
              value={value}
              autoComplete="off"
              placeholder="Search by image name or paste an ID"
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onChange={(e) => { onChange(e.target.value); setSelection(null); setActive(-1); setOpen(true) }}
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
              className={cn('pr-8', value && !open && 'bg-accent font-mono text-accent-foreground')}
            />
            {value && <Button type="button" variant="ghost" size="icon-xs" aria-label="Clear image ID" className="absolute inset-y-0 right-1 my-auto text-muted-foreground" onClick={() => {
              onChange('')
              setSelection(null)
              setActive(-1)
              setOpen(true)
              input.current?.focus()
            }}><X /></Button>}
          </div>
        }
        footer={
          <div id={`${id}-status`} role="status" className="border-t px-3 py-2 text-xs text-muted-foreground">
            {!ready ? 'Configure credentials or select a profile to browse images.'
              : images.isError ? `Could not load images: ${images.error.message}. You can still enter a custom ID.`
              : images.isFetching || search !== custom ? 'Loading images…'
              : options.length === 0 ? 'No matching images. You can enter a custom ID.'
              : `Amazon and your images in ${region}. Search by name or ID.`}
            {images.isError && <Button type="button" variant="link" size="xs" onClick={() => void images.refetch()}>Retry</Button>}
            {images.hasNextPage && <Button type="button" variant="link" size="xs" className="mt-1 block px-0" disabled={images.isFetching} onClick={() => void images.fetchNextPage()}>Load more images</Button>}
          </div>
        }
      >
        {options.map((ami, index) => (
          <ComboOption key={ami.ImageId} id={`${id}-option-${index}`} active={active === index} onSelect={() => choose(ami.ImageId)} className="text-xs">
            <div className="break-words text-sm font-medium">{imageName(ami)}</div>
            <div className="mt-1 break-all font-mono text-muted-foreground">{ami.ImageId}</div>
            <div className="mt-1 text-muted-foreground">{architectureLabel(ami.Architecture)}</div>
            {ami.Description && <div className="mt-1 line-clamp-2 break-words text-muted-foreground">{ami.Description}</div>}
          </ComboOption>
        ))}
        {custom && <ComboOption id={`${id}-option-${options.length}`} active={active === options.length} onSelect={() => choose(custom)} className="break-all border-t text-xs text-primary">
          Use “{custom}” as a custom image ID
        </ComboOption>}
      </ComboListbox>
    </div>
  )
}
