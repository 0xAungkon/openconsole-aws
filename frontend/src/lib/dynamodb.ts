/** DynamoDB helpers: typed attribute-value (un)marshalling and table shapes. */

export type AttrType = 'S' | 'N' | 'B'
export type Plain = string | number | boolean | null | Plain[] | { [k: string]: Plain }
export type AttributeValue = Record<string, any>
export type Item = Record<string, AttributeValue>

/** DynamoDB typed value → plain JSON value. */
export function unmarshall(av: AttributeValue): Plain {
  if ('S' in av) return av.S
  if ('N' in av) {
    const n = Number(av.N)
    // Keep big/precise numbers as strings so we never silently corrupt them.
    return Number.isSafeInteger(n) || (String(n) === av.N) ? n : av.N
  }
  if ('BOOL' in av) return av.BOOL
  if ('NULL' in av) return null
  if ('L' in av) return (av.L as AttributeValue[]).map(unmarshall)
  if ('M' in av) return Object.fromEntries(Object.entries(av.M as Item).map(([k, v]) => [k, unmarshall(v)]))
  if ('SS' in av) return av.SS as string[]
  if ('NS' in av) return (av.NS as string[]).map(Number)
  if ('BS' in av) return av.BS as string[]
  if ('B' in av) return av.B
  return null
}

export function unmarshallItem(item: Item): Record<string, Plain> {
  return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, unmarshall(v)]))
}

/** Plain JSON value → DynamoDB typed value. Arrays become lists, objects maps. */
export function marshall(value: Plain): AttributeValue {
  if (value === null || value === undefined) return { NULL: true }
  if (typeof value === 'string') return { S: value }
  if (typeof value === 'number') return { N: String(value) }
  if (typeof value === 'boolean') return { BOOL: value }
  if (Array.isArray(value)) return { L: value.map(marshall) }
  return { M: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, marshall(v)])) }
}

export function marshallItem(obj: Record<string, Plain>): Item {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, marshall(v)]))
}

/** Typed value for a key attribute given its declared key type. */
export function keyValue(type: AttrType, raw: string): AttributeValue {
  if (type === 'N') return { N: raw.trim() }
  if (type === 'B') return { B: raw }
  return { S: raw }
}

export interface KeyDef { name: string; type: AttrType }

export interface TableRow {
  Name: string
  Arn: string
  Status: string
  ItemCount: number
  SizeBytes: number
  BillingMode: 'PAY_PER_REQUEST' | 'PROVISIONED'
  ReadCapacity: number
  WriteCapacity: number
  PartitionKey?: KeyDef
  SortKey?: KeyDef
  Created: string
  DeletionProtection: boolean
  StreamEnabled: boolean
  StreamViewType: string
  StreamArn: string
  GSIs: { name: string; status: string; keys: KeyDef[]; projection: string }[]
  _raw: any
}

export function toTableRow(t: any): TableRow {
  const types: Record<string, AttrType> = Object.fromEntries((t.AttributeDefinitions ?? []).map((a: any) => [a.AttributeName, a.AttributeType]))
  const keyOf = (schema: any[] | undefined, kind: 'HASH' | 'RANGE'): KeyDef | undefined => {
    const k = (schema ?? []).find((s: any) => s.KeyType === kind)
    return k ? { name: k.AttributeName, type: types[k.AttributeName] ?? 'S' } : undefined
  }
  const billing = t.BillingModeSummary?.BillingMode ?? (t.ProvisionedThroughput?.ReadCapacityUnits ? 'PROVISIONED' : 'PAY_PER_REQUEST')
  return {
    Name: t.TableName ?? '',
    Arn: t.TableArn ?? '',
    Status: t.TableStatus ?? '',
    ItemCount: t.ItemCount ?? 0,
    SizeBytes: t.TableSizeBytes ?? 0,
    BillingMode: billing,
    ReadCapacity: t.ProvisionedThroughput?.ReadCapacityUnits ?? 0,
    WriteCapacity: t.ProvisionedThroughput?.WriteCapacityUnits ?? 0,
    PartitionKey: keyOf(t.KeySchema, 'HASH'),
    SortKey: keyOf(t.KeySchema, 'RANGE'),
    Created: t.CreationDateTime ?? '',
    DeletionProtection: !!t.DeletionProtectionEnabled,
    StreamEnabled: !!t.StreamSpecification?.StreamEnabled,
    StreamViewType: t.StreamSpecification?.StreamViewType ?? '',
    StreamArn: t.LatestStreamArn ?? '',
    GSIs: (t.GlobalSecondaryIndexes ?? []).map((g: any) => ({
      name: g.IndexName,
      status: g.IndexStatus ?? 'ACTIVE',
      keys: [keyOf(g.KeySchema, 'HASH'), keyOf(g.KeySchema, 'RANGE')].filter(Boolean) as KeyDef[],
      projection: g.Projection?.ProjectionType ?? 'ALL',
    })),
    _raw: t,
  }
}

export const TABLE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  CREATING: 'Creating',
  UPDATING: 'Updating',
  DELETING: 'Deleting',
  INACCESSIBLE_ENCRYPTION_CREDENTIALS: 'Key inaccessible',
  ARCHIVING: 'Archiving',
  ARCHIVED: 'Archived',
}
export const TABLE_BUSY = new Set(['CREATING', 'UPDATING', 'DELETING', 'ARCHIVING'])

export function tableStatusTone(status: string): 'green' | 'amber' | 'red' | 'gray' {
  if (status === 'ACTIVE') return 'green'
  if (TABLE_BUSY.has(status)) return 'amber'
  if (status === 'ARCHIVED') return 'gray'
  return 'red'
}

export function validateTableName(name: string): string | null {
  if (name.length < 3 || name.length > 255) return 'Must be 3–255 characters.'
  if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return 'Letters, numbers, underscores, hyphens and dots only.'
  return null
}

export const ATTR_TYPES: { id: AttrType; label: string }[] = [
  { id: 'S', label: 'String' },
  { id: 'N', label: 'Number' },
  { id: 'B', label: 'Binary' },
]

/** Compact one-line preview of a plain value for table cells. */
export function previewValue(v: Plain): string {
  if (v === null) return 'null'
  if (typeof v === 'object') {
    const s = JSON.stringify(v)
    return s.length > 60 ? s.slice(0, 57) + '…' : s
  }
  const s = String(v)
  return s.length > 60 ? s.slice(0, 57) + '…' : s
}

export type FilterOp = '=' | '<>' | '<' | '<=' | '>' | '>=' | 'contains' | 'begins_with' | 'exists' | 'not_exists'
export const FILTER_OPS: { id: FilterOp; label: string; needsValue: boolean }[] = [
  { id: '=', label: 'equals', needsValue: true },
  { id: '<>', label: 'not equals', needsValue: true },
  { id: '<', label: 'less than', needsValue: true },
  { id: '<=', label: 'less or equal', needsValue: true },
  { id: '>', label: 'greater than', needsValue: true },
  { id: '>=', label: 'greater or equal', needsValue: true },
  { id: 'contains', label: 'contains', needsValue: true },
  { id: 'begins_with', label: 'begins with', needsValue: true },
  { id: 'exists', label: 'exists', needsValue: false },
  { id: 'not_exists', label: 'does not exist', needsValue: false },
]

/** Build a FilterExpression + placeholders for one condition. */
export function buildFilter(attr: string, op: FilterOp, value: string, type: 'S' | 'N' | 'BOOL') {
  const names = { '#f': attr }
  const typed: AttributeValue = type === 'N' ? { N: value } : type === 'BOOL' ? { BOOL: value === 'true' } : { S: value }
  switch (op) {
    case 'exists':
      return { FilterExpression: 'attribute_exists(#f)', ExpressionAttributeNames: names }
    case 'not_exists':
      return { FilterExpression: 'attribute_not_exists(#f)', ExpressionAttributeNames: names }
    case 'contains':
      return { FilterExpression: 'contains(#f, :v)', ExpressionAttributeNames: names, ExpressionAttributeValues: { ':v': typed } }
    case 'begins_with':
      return { FilterExpression: 'begins_with(#f, :v)', ExpressionAttributeNames: names, ExpressionAttributeValues: { ':v': typed } }
    default:
      return { FilterExpression: `#f ${op} :v`, ExpressionAttributeNames: names, ExpressionAttributeValues: { ':v': typed } }
  }
}

export type SortOp = '=' | '<' | '<=' | '>' | '>=' | 'begins_with' | 'between'
export const SORT_OPS: { id: SortOp; label: string }[] = [
  { id: '=', label: 'equals' },
  { id: '<', label: 'less than' },
  { id: '<=', label: 'less or equal' },
  { id: '>', label: 'greater than' },
  { id: '>=', label: 'greater or equal' },
  { id: 'begins_with', label: 'begins with' },
  { id: 'between', label: 'between' },
]

/** Build a KeyConditionExpression for a query. */
export function buildKeyCondition(pk: KeyDef, pkValue: string, sk?: KeyDef, skOp?: SortOp, skValue?: string, skValue2?: string) {
  const names: Record<string, string> = { '#pk': pk.name }
  const values: Record<string, AttributeValue> = { ':pk': keyValue(pk.type, pkValue) }
  let expr = '#pk = :pk'
  if (sk && skOp && skValue !== undefined && skValue !== '') {
    names['#sk'] = sk.name
    values[':sk'] = keyValue(sk.type, skValue)
    if (skOp === 'between') {
      values[':sk2'] = keyValue(sk.type, skValue2 ?? '')
      expr += ' AND #sk BETWEEN :sk AND :sk2'
    } else if (skOp === 'begins_with') expr += ' AND begins_with(#sk, :sk)'
    else expr += ` AND #sk ${skOp} :sk`
  }
  return { KeyConditionExpression: expr, ExpressionAttributeNames: names, ExpressionAttributeValues: values }
}

/** Extract the key attributes from an item (typed form) for get/delete. */
export function itemKey(item: Item, pk: KeyDef, sk?: KeyDef): Item {
  const key: Item = { [pk.name]: item[pk.name] }
  if (sk) key[sk.name] = item[sk.name]
  return key
}

/** A stable identity string for an item (for selection state). */
export function itemId(item: Item, pk: KeyDef, sk?: KeyDef): string {
  return JSON.stringify(itemKey(item, pk, sk))
}
