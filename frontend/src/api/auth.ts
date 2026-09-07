import type { StoredProfile, User } from '../types'
import { api } from './client'

interface TokenOut {
  access_token: string
  token_type: string
  user: User
}

export async function register(name: string, email: string, password: string) {
  const { data } = await api.post<TokenOut>('/api/auth/register', {
    name,
    email,
    password,
  })
  return data
}

export async function login(email: string, password: string) {
  const { data } = await api.post<TokenOut>('/api/auth/login', {
    email,
    password,
  })
  return data
}

export async function listProfiles() {
  const { data } = await api.get<StoredProfile[]>('/api/credentials')
  return data
}

export interface NewProfile {
  label: string
  access_key_id: string
  secret_access_key: string
  session_token?: string
  default_region: string
  endpoint_url?: string
}

export async function createProfile(profile: NewProfile) {
  const { data } = await api.post<StoredProfile>('/api/credentials', profile)
  return data
}

export async function deleteProfile(id: number) {
  await api.delete(`/api/credentials/${id}`)
}
