import { useQuery } from '@tanstack/react-query'
import { runQuery } from '../../api/proxy'
import type { IamPolicy } from '../../lib/iam'
import { useSessionStore } from '../../store/sessionStore'

/** Load every managed policy (Local = customer managed, All = incl. AWS managed). */
export function useManagedPolicies(scope: 'Local' | 'All') {
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  return useQuery({
    queryKey: ['iam-policies', scope, activeProfileId],
    queryFn: async () => {
      const all: IamPolicy[] = []
      let marker: string | undefined
      do {
        const p = await runQuery<{ Policies?: IamPolicy[]; Marker?: string; IsTruncated?: boolean }>('iam', 'list_policies', { Scope: scope, MaxItems: 1000, ...(marker ? { Marker: marker } : {}) })
        all.push(...(p.Policies ?? []))
        marker = p.IsTruncated ? p.Marker : undefined
      } while (marker)
      return all.sort((a, b) => a.PolicyName.localeCompare(b.PolicyName))
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

