import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GuestCreds, Mode, User } from '../types'

interface AuthState {
  mode: Mode | null
  // register mode
  token: string | null
  user: User | null
  // guest mode
  guestCreds: GuestCreds | null

  setGuest: (creds: GuestCreds) => void
  setRegister: (token: string, user: User) => void
  updateGuestCreds: (patch: Partial<GuestCreds>) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      mode: null,
      token: null,
      user: null,
      guestCreds: null,

      setGuest: (creds) =>
        set({ mode: 'guest', guestCreds: creds, token: null, user: null }),

      setRegister: (token, user) =>
        set({ mode: 'register', token, user, guestCreds: null }),

      updateGuestCreds: (patch) => {
        const current = get().guestCreds
        if (current) set({ guestCreds: { ...current, ...patch } })
      },

      reset: () =>
        set({ mode: null, token: null, user: null, guestCreds: null }),
    }),
    { name: 'aws-openconsole-auth' },
  ),
)
