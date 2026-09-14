import { strToU8, zipSync } from 'fflate'

export interface FunctionRow {
  FunctionName: string
  FunctionArn: string
  Runtime: string
  Handler: string
  Role: string
  MemorySize: number
  Timeout: number
  CodeSize: number
  Description: string
  LastModified: string
  State: string
  StateReason: string
  Version: string
  Environment?: { Variables?: Record<string, string> }
  _raw: any
}

export function flattenFunctions(data: any): FunctionRow[] {
  return (data?.Functions ?? []).map(toRow)
}

export function toRow(f: any): FunctionRow {
  return {
    FunctionName: f.FunctionName ?? '',
    FunctionArn: f.FunctionArn ?? '',
    Runtime: f.Runtime ?? (f.PackageType === 'Image' ? 'container' : ''),
    Handler: f.Handler ?? '',
    Role: f.Role ?? '',
    MemorySize: f.MemorySize ?? 0,
    Timeout: f.Timeout ?? 0,
    CodeSize: f.CodeSize ?? 0,
    Description: f.Description ?? '',
    LastModified: f.LastModified ?? '',
    State: f.State ?? 'Active',
    StateReason: f.StateReason ?? f.StateReasonCode ?? '',
    Version: f.Version ?? '$LATEST',
    Environment: f.Environment,
    _raw: f,
  }
}

export interface RuntimeDef {
  id: string
  label: string
  /** Inline code support: file name + starter code + default handler. */
  inline?: { file: string; handler: string; template: string }
}

export const RUNTIMES: RuntimeDef[] = [
  {
    id: 'python3.12',
    label: 'Python 3.12',
    inline: {
      file: 'index.py',
      handler: 'index.handler',
      template: `import json


def handler(event, context):
    """Entry point. \`event\` is the JSON payload you invoke with."""
    name = (event or {}).get("name", "world")
    return {
        "statusCode": 200,
        "body": json.dumps({"message": f"Hello, {name}!"}),
    }
`,
    },
  },
  {
    id: 'python3.11',
    label: 'Python 3.11',
    inline: {
      file: 'index.py',
      handler: 'index.handler',
      template: `import json


def handler(event, context):
    name = (event or {}).get("name", "world")
    return {"statusCode": 200, "body": json.dumps({"message": f"Hello, {name}!"})}
`,
    },
  },
  {
    id: 'nodejs22.x',
    label: 'Node.js 22',
    inline: {
      file: 'index.mjs',
      handler: 'index.handler',
      template: `// Entry point. \`event\` is the JSON payload you invoke with.
export const handler = async (event) => {
  const name = event?.name ?? 'world'
  return {
    statusCode: 200,
    body: JSON.stringify({ message: \`Hello, \${name}!\` }),
  }
}
`,
    },
  },
  {
    id: 'nodejs20.x',
    label: 'Node.js 20',
    inline: {
      file: 'index.mjs',
      handler: 'index.handler',
      template: `export const handler = async (event) => {
  const name = event?.name ?? 'world'
  return { statusCode: 200, body: JSON.stringify({ message: \`Hello, \${name}!\` }) }
}
`,
    },
  },
  { id: 'java21', label: 'Java 21 (upload a .zip/.jar)' },
  { id: 'dotnet8', label: '.NET 8 (upload a .zip)' },
  { id: 'ruby3.3', label: 'Ruby 3.3 (upload a .zip)' },
  { id: 'provided.al2023', label: 'Custom runtime — Amazon Linux 2023 (upload a .zip)' },
]

export const runtimeLabel = (id: string) => RUNTIMES.find((r) => r.id === id)?.label ?? id

/** Zip a single source file in the browser and return it as base64 (for Code.ZipFile). */
export function zipSourceBase64(fileName: string, code: string): string {
  const zipped = zipSync({ [fileName]: strToU8(code) }, { level: 6 })
  let binary = ''
  for (let i = 0; i < zipped.length; i += 0x8000) {
    binary += String.fromCharCode(...zipped.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/** Base64 → text (Lambda's tailed LogResult). */
export function decodeBase64(b64: string): string {
  try {
    return decodeURIComponent(
      Array.from(atob(b64), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    )
  } catch {
    return atob(b64)
  }
}

export function validateFunctionName(name: string): string | null {
  if (name.length < 1 || name.length > 64) return 'Must be 1–64 characters.'
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) return 'Only letters, numbers, hyphens and underscores.'
  return null
}

/** Trust policy that lets Lambda assume a role. */
export const LAMBDA_TRUST_POLICY = JSON.stringify({
  Version: '2012-10-17',
  Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }],
})

export const BASIC_EXECUTION_POLICY_ARN = 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'

export function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}
