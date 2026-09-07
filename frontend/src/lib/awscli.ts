// Renders a boto3-style (service, operation, params) call as a copy-pasteable
// AWS CLI command. Params are emitted via --cli-input-json, which takes the exact
// same PascalCase shapes boto3 uses, so the command is always valid and faithful.

// boto3 service name -> AWS CLI command. Almost all match; S3's low-level API
// lives under `s3api` (the bare `aws s3` namespace is high-level ls/cp/sync).
const CLI_SERVICE: Record<string, string> = {
  s3: 's3api',
}

export interface CliContext {
  region?: string
  endpoint?: string
}

export function toAwsCliCommand(
  service: string,
  operation: string,
  params: Record<string, unknown> = {},
  ctx: CliContext = {},
): string {
  const svc = CLI_SERVICE[service] ?? service
  const op = operation.replace(/_/g, '-')
  let cmd = `aws ${svc} ${op}`

  if (params && Object.keys(params).length > 0) {
    cmd += ` --cli-input-json '${JSON.stringify(params)}'`
  }
  if (ctx.region) cmd += ` --region ${ctx.region}`
  if (ctx.endpoint) cmd += ` --endpoint-url ${ctx.endpoint}`
  return cmd
}
