import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SessionState {
  region: string
  // register mode: id of the active stored profile
  activeProfileId: number | null
  // endpoint override (Floci / LocalStack); empty = real AWS
  endpointUrl: string
  sidebarCollapsed: boolean

  setRegion: (region: string) => void
  setActiveProfileId: (id: number | null) => void
  setEndpointUrl: (url: string) => void
  toggleSidebar: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      region: 'us-east-1',
      activeProfileId: null,
      endpointUrl: '',
      sidebarCollapsed: false,

      setRegion: (region) => set({ region }),
      setActiveProfileId: (activeProfileId) => set({ activeProfileId }),
      setEndpointUrl: (endpointUrl) => set({ endpointUrl }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
    }),
    { name: 'aws-openconsole-session' },
  ),
)

export const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
]
