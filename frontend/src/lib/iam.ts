import { runQuery } from '../api/proxy'

export interface IamUser { UserName: string; UserId: string; Arn: string; CreateDate: string; PasswordLastUsed?: string; Path: string }
export interface IamRole { RoleName: string; RoleId: string; Arn: string; CreateDate: string; Description?: string; AssumeRolePolicyDocument?: any; MaxSessionDuration?: number; RoleLastUsed?: { LastUsedDate?: string; Region?: string }; Path: string }
export interface IamGroup { GroupName: string; GroupId: string; Arn: string; CreateDate: string; Path: string }
export interface IamPolicy { PolicyName: string; PolicyId: string; Arn: string; AttachmentCount?: number; DefaultVersionId?: string; CreateDate: string; UpdateDate?: string; Description?: string; IsAttachable?: boolean; Path: string }

export function validateIamName(name: string): string | null {
  if (name.length < 1 || name.length > 64) return 'Must be 1–64 characters.'
  if (!/^[\w+=,.@-]+$/.test(name)) return 'Letters, numbers and + = , . @ _ - only.'
  return null
}

/** boto3 returns URL-encoded policy documents in some responses; normalise to an object. */
export function policyDoc(doc: unknown): any {
  if (doc == null) return null
  if (typeof doc === 'object') return doc
  try {
    return JSON.parse(decodeURIComponent(String(doc)))
  } catch {
    try {
      return JSON.parse(String(doc))
    } catch {
      return null
    }
  }
}

export const isAwsManaged = (arn: string) => arn.startsWith('arn:aws:iam::aws:')

/** Common services that assume roles, for the trusted-entity picker. */
export const SERVICE_PRINCIPALS: { id: string; label: string }[] = [
  { id: 'lambda.amazonaws.com', label: 'Lambda' },
  { id: 'ec2.amazonaws.com', label: 'EC2' },
  { id: 'ecs-tasks.amazonaws.com', label: 'ECS tasks' },
  { id: 'eks.amazonaws.com', label: 'EKS' },
  { id: 'rds.amazonaws.com', label: 'RDS' },
  { id: 'glue.amazonaws.com', label: 'Glue' },
  { id: 'states.amazonaws.com', label: 'Step Functions' },
  { id: 'events.amazonaws.com', label: 'EventBridge' },
  { id: 'apigateway.amazonaws.com', label: 'API Gateway' },
  { id: 'codebuild.amazonaws.com', label: 'CodeBuild' },
  { id: 'cloudformation.amazonaws.com', label: 'CloudFormation' },
  { id: 'sagemaker.amazonaws.com', label: 'SageMaker' },
]

export function trustPolicyForService(service: string) {
  return { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Service: service }, Action: 'sts:AssumeRole' }] }
}
export function trustPolicyForAccount(accountId: string) {
  return { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { AWS: `arn:aws:iam::${accountId}:root` }, Action: 'sts:AssumeRole' }] }
}

/** One-line summary of who can assume a role. */
export function trustSummary(doc: any): string {
  const stmts: any[] = doc?.Statement ? (Array.isArray(doc.Statement) ? doc.Statement : [doc.Statement]) : []
  const who = new Set<string>()
  for (const s of stmts) {
    const p = s.Principal
    if (!p) continue
    if (p === '*') who.add('anyone')
    for (const k of ['Service', 'AWS', 'Federated'] as const) {
      const v = p[k]
      if (!v) continue
      for (const x of Array.isArray(v) ? v : [v]) who.add(k === 'Service' ? String(x).replace('.amazonaws.com', '') : String(x).replace(/^arn:aws:iam::(\d+):root$/, 'account $1'))
    }
  }
  return who.size ? [...who].join(', ') : '—'
}

export const POLICY_TEMPLATES: { id: string; label: string; doc: any }[] = [
  {
    id: 's3-read',
    label: 'Read one S3 bucket',
    doc: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: ['s3:GetObject', 's3:ListBucket'], Resource: ['arn:aws:s3:::my-bucket', 'arn:aws:s3:::my-bucket/*'] }] },
  },
  {
    id: 'dynamodb-table',
    label: 'Read/write one DynamoDB table',
    doc: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan'], Resource: 'arn:aws:dynamodb:*:*:table/my-table' }] },
  },
  {
    id: 'lambda-logs',
    label: 'Write CloudWatch logs',
    doc: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'], Resource: 'arn:aws:logs:*:*:*' }] },
  },
  {
    id: 'ec2-describe',
    label: 'Describe EC2 (read-only)',
    doc: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: 'ec2:Describe*', Resource: '*' }] },
  },
  { id: 'blank', label: 'Blank', doc: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: [], Resource: '*' }] } },
]

/** Human summary of a permissions policy: N statements, allow/deny, actions. */
export function policySummary(doc: any): string {
  const stmts: any[] = doc?.Statement ? (Array.isArray(doc.Statement) ? doc.Statement : [doc.Statement]) : []
  if (!stmts.length) return 'No statements'
  const actions = new Set<string>()
  let deny = 0
  for (const s of stmts) {
    if (s.Effect === 'Deny') deny++
    for (const a of Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : []) actions.add(String(a))
  }
  const list = [...actions]
  return `${stmts.length} statement${stmts.length === 1 ? '' : 's'}${deny ? ` (${deny} deny)` : ''} · ${list.slice(0, 4).join(', ')}${list.length > 4 ? ` +${list.length - 4} more` : ''}`
}

export function generatePassword(length = 16): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*()_+-=']
  const all = sets.join('')
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (b, i) => (i < sets.length ? sets[i][b % sets[i].length] : all[b % all.length]))
  // shuffle so the guaranteed classes aren't always first
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export function validateJsonPolicy(text: string): { doc: any } | { error: string } {
  try {
    const doc = JSON.parse(text)
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { error: 'The policy must be a JSON object.' }
    if (!doc.Statement) return { error: 'Missing "Statement".' }
    return { doc }
  } catch (e) {
    return { error: `Invalid JSON: ${(e as Error).message}` }
  }
}

/** Paginate any IAM list_* call. */
export async function listAll<T>(op: string, key: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const all: T[] = []
  let marker: string | undefined
  do {
    const p = await runQuery<any>('iam', op, { MaxItems: 1000, ...params, ...(marker ? { Marker: marker } : {}) })
    all.push(...(p[key] ?? []))
    marker = p.IsTruncated ? p.Marker : undefined
  } while (marker)
  return all
}


/* ---------------- safe deletes (IAM refuses to delete entities with dependencies) ---------------- */

export async function deleteUserCompletely(UserName: string) {
  for (const p of await listAll<{ PolicyArn: string }>('list_attached_user_policies', 'AttachedPolicies', { UserName })) await runQuery('iam', 'detach_user_policy', { UserName, PolicyArn: p.PolicyArn })
  for (const n of await listAll<string>('list_user_policies', 'PolicyNames', { UserName })) await runQuery('iam', 'delete_user_policy', { UserName, PolicyName: n })
  for (const g of await listAll<{ GroupName: string }>('list_groups_for_user', 'Groups', { UserName })) await runQuery('iam', 'remove_user_from_group', { UserName, GroupName: g.GroupName })
  for (const k of await listAll<{ AccessKeyId: string }>('list_access_keys', 'AccessKeyMetadata', { UserName })) await runQuery('iam', 'delete_access_key', { UserName, AccessKeyId: k.AccessKeyId })
  for (const m of await listAll<{ SerialNumber: string }>('list_mfa_devices', 'MFADevices', { UserName })) await runQuery('iam', 'deactivate_mfa_device', { UserName, SerialNumber: m.SerialNumber })
  try { await runQuery('iam', 'delete_login_profile', { UserName }) } catch { /* no console password */ }
  await runQuery('iam', 'delete_user', { UserName })
}
export async function deleteRoleCompletely(RoleName: string) {
  for (const p of await listAll<{ PolicyArn: string }>('list_attached_role_policies', 'AttachedPolicies', { RoleName })) await runQuery('iam', 'detach_role_policy', { RoleName, PolicyArn: p.PolicyArn })
  for (const n of await listAll<string>('list_role_policies', 'PolicyNames', { RoleName })) await runQuery('iam', 'delete_role_policy', { RoleName, PolicyName: n })
  for (const ip of await listAll<{ InstanceProfileName: string }>('list_instance_profiles_for_role', 'InstanceProfiles', { RoleName })) await runQuery('iam', 'remove_role_from_instance_profile', { RoleName, InstanceProfileName: ip.InstanceProfileName })
  await runQuery('iam', 'delete_role', { RoleName })
}
export async function deleteGroupCompletely(GroupName: string) {
  const g = await runQuery<{ Users?: { UserName: string }[] }>('iam', 'get_group', { GroupName })
  for (const u of g.Users ?? []) await runQuery('iam', 'remove_user_from_group', { GroupName, UserName: u.UserName })
  for (const p of await listAll<{ PolicyArn: string }>('list_attached_group_policies', 'AttachedPolicies', { GroupName })) await runQuery('iam', 'detach_group_policy', { GroupName, PolicyArn: p.PolicyArn })
  for (const n of await listAll<string>('list_group_policies', 'PolicyNames', { GroupName })) await runQuery('iam', 'delete_group_policy', { GroupName, PolicyName: n })
  await runQuery('iam', 'delete_group', { GroupName })
}
export async function deletePolicyCompletely(PolicyArn: string) {
  const ents = await runQuery<{ PolicyUsers?: { UserName: string }[]; PolicyRoles?: { RoleName: string }[]; PolicyGroups?: { GroupName: string }[] }>('iam', 'list_entities_for_policy', { PolicyArn, MaxItems: 1000 })
  for (const u of ents.PolicyUsers ?? []) await runQuery('iam', 'detach_user_policy', { UserName: u.UserName, PolicyArn })
  for (const r of ents.PolicyRoles ?? []) await runQuery('iam', 'detach_role_policy', { RoleName: r.RoleName, PolicyArn })
  for (const g of ents.PolicyGroups ?? []) await runQuery('iam', 'detach_group_policy', { GroupName: g.GroupName, PolicyArn })
  const v = await runQuery<{ Versions?: { VersionId: string; IsDefaultVersion?: boolean }[] }>('iam', 'list_policy_versions', { PolicyArn })
  for (const ver of v.Versions ?? []) if (!ver.IsDefaultVersion) await runQuery('iam', 'delete_policy_version', { PolicyArn, VersionId: ver.VersionId })
  await runQuery('iam', 'delete_policy', { PolicyArn })
}

