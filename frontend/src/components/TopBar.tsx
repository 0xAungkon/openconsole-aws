import { useQuery } from '@tanstack/react-query'
import { Check, Plus, UserCircle2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listProfiles } from '../api/auth'
import { slugify } from '../lib/slug'
import { useAuthStore } from '../store/authStore'
import { AWS_REGIONS, useSessionStore } from '../store/sessionStore'

export function TopBar({ title }: { title: string }) {
  const navigate = useNavigate()
  const { profile: profileParam } = useParams()
  const { mode, user } = useAuthStore()
  const { region, setRegion } = useSessionStore()

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: mode === 'register',
  })
  const profiles = profilesQuery.data ?? []

  return (
    <header className="flex items-center justify-between border-b bg-card px-4 py-2">
      <h1 className="text-sm font-medium">{title}</h1>

      <div className="flex items-center gap-3">
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger size="sm" aria-label="Region" className="w-40 text-xs">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            {AWS_REGIONS.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {mode === 'guest' && (
          <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            Guest Mode
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account" className="rounded-full text-muted-foreground hover:text-primary">
              <UserCircle2 className="size-7" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {mode === 'register' ? (
              <>
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{user?.name ?? 'Account'}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Profiles
                  </DropdownMenuLabel>
                  <div className="max-h-56 overflow-y-auto">
                    {profiles.map((p) => {
                      const active = slugify(p.label) === profileParam
                      return (
                        <DropdownMenuItem
                          key={p.id}
                          onSelect={() => navigate(`/${slugify(p.label)}`)}
                          className="justify-between"
                        >
                          <span className="truncate">
                            {p.label}
                            <span className="ml-1 text-xs text-muted-foreground">{p.default_region}</span>
                          </span>
                          {active && <Check className="shrink-0 text-primary" />}
                        </DropdownMenuItem>
                      )
                    })}
                  </div>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/onboarding')} className="text-primary focus:text-primary">
                  <Plus />
                  Add profile
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Guest session</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Credentials are stored only in this browser.
                </span>
              </DropdownMenuLabel>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
