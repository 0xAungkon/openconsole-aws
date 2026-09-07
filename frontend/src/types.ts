import type { LucideIcon } from 'lucide-react'

export type Mode = 'guest' | 'register'

export interface GuestCreds {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  endpointUrl?: string
  region: string
}

export interface User {
  id: number
  name: string
  email: string
  created_at: string
}

export interface StoredProfile {
  id: number
  label: string
  access_key_id: string
  default_region: string
  endpoint_url: string | null
  created_at: string
}

export interface ProxyError {
  code: string
  message: string
}

export interface ProxyResponse<T = unknown> {
  ok: boolean
  result?: T
  error?: ProxyError
}

// ---- Service catalog types ----

export type FieldType = 'string' | 'number' | 'boolean' | 'list-string' | 'json'

export interface ActionField {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  help?: string
  /** Prefilled value for the input (e.g. a sensible default instance type). */
  default?: string
}

export interface Column {
  /** Top-level key into a (flattened) row object. */
  key: string
  label: string
}

export type Row = Record<string, unknown>

export interface ServiceAction {
  id: string // boto3 operation name, e.g. "describe_instances"
  label: string
  kind: 'list' | 'mutation'
  fields: ActionField[]
  /** For list actions: extract/flatten the array of rows from the AWS response. */
  getRows?: (result: any) => Row[]
  columns?: Column[]
  description?: string
}

export interface ServiceDef {
  key: string // route + boto3 service name, e.g. "ec2"
  label: string
  /** Lowercase service code shown as a badge next to the friendly label. */
  code: string
  icon: LucideIcon
  summary: string
  actions: ServiceAction[]
}
