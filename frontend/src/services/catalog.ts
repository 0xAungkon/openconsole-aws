import { Database, KeyRound, Server, Boxes, Table2, Zap } from 'lucide-react'
import type { Row, ServiceDef } from '../types'

// Declarative source of truth for every service page. Adding a service or action
// is a change here only — the backend proxy is generic.

export const CATALOG: ServiceDef[] = [
  {
    key: 'ec2',
    route: 'compute',
    label: 'Compute',
    code: 'ec2',
    icon: Server,
    summary: 'Elastic Compute Cloud instances',
    actions: [
      {
        id: 'describe_instances',
        label: 'List instances',
        kind: 'list',
        fields: [],
        getRows: (r) =>
          (r?.Reservations ?? []).flatMap((res: any) =>
            (res.Instances ?? []).map(
              (i: any): Row => ({
                InstanceId: i.InstanceId,
                InstanceType: i.InstanceType,
                State: i.State?.Name,
                AZ: i.Placement?.AvailabilityZone,
                PublicIp: i.PublicIpAddress ?? '',
                PrivateIp: i.PrivateIpAddress ?? '',
              }),
            ),
          ),
        columns: [
          { key: 'InstanceId', label: 'Instance ID' },
          { key: 'InstanceType', label: 'Type' },
          { key: 'State', label: 'State' },
          { key: 'AZ', label: 'AZ' },
          { key: 'PublicIp', label: 'Public IP' },
          { key: 'PrivateIp', label: 'Private IP' },
        ],
      },
      {
        id: 'run_instances',
        label: 'Launch',
        kind: 'mutation',
        toParams: ({ Name, ...params }) =>
          typeof Name === 'string' && Name.trim()
            ? {
                ...params,
                TagSpecifications: [
                  {
                    ResourceType: 'instance',
                    Tags: [{ Key: 'Name', Value: Name.trim() }],
                  },
                ],
              }
            : params,
        fields: [
          {
            name: 'Name',
            label: 'Server name',
            suggestions: 'codename',
            type: 'string',
            required: true,
            help: 'Shown in your server list (stored as the "Name" tag). Edit it or generate another.',
          },
          {
            name: 'ImageId',
            label: 'Server image (operating system)',
            suggestions: 'ami',
            type: 'string',
            required: true,
            placeholder: 'ami-0abc1234...',
            help: 'An image provides the operating system and preinstalled software for your server. Choose an image above, or paste your own image ID.',
          },
          {
            name: 'InstanceType',
            label: 'Server size (instance type)',
            suggestions: 'instance-type',
            help: 'Compare processing power and memory. The processor architecture must match your selected image.',
            type: 'string',
            required: true,
            default: 't2.micro',
            placeholder: 't2.micro',
          },
          {
            name: 'MinCount',
            label: 'Min count',
            type: 'number',
            required: true,
            default: '1',
          },
          {
            name: 'MaxCount',
            label: 'Max count',
            type: 'number',
            required: true,
            default: '1',
          },
          {
            name: 'KeyName',
            label: 'Key pair name',
            type: 'string',
            placeholder: 'Optional — existing EC2 key pair',
          },
          {
            name: 'SubnetId',
            label: 'Subnet ID',
            type: 'string',
            placeholder: 'Optional — subnet-0abc...',
          },
        ],
      },
      {
        id: 'start_instances',
        label: 'Start',
        kind: 'mutation',
        fields: [
          {
            name: 'InstanceIds',
            label: 'Instance IDs',
            type: 'list-string',
            required: true,
            placeholder: 'i-0abc..., i-0def...',
          },
        ],
      },
      {
        id: 'stop_instances',
        label: 'Stop',
        kind: 'mutation',
        fields: [
          {
            name: 'InstanceIds',
            label: 'Instance IDs',
            type: 'list-string',
            required: true,
            placeholder: 'i-0abc..., i-0def...',
          },
        ],
      },
      {
        id: 'terminate_instances',
        label: 'Terminate',
        kind: 'mutation',
        fields: [
          {
            name: 'InstanceIds',
            label: 'Instance IDs',
            type: 'list-string',
            required: true,
            placeholder: 'i-0abc...',
          },
        ],
      },
    ],
  },
  {
    key: 's3',
    route: 'storage',
    label: 'Storage',
    code: 's3',
    icon: Boxes,
    summary: 'Simple Storage Service buckets & objects',
    actions: [
      {
        id: 'list_buckets',
        label: 'List buckets',
        kind: 'list',
        fields: [],
        getRows: (r) =>
          (r?.Buckets ?? []).map(
            (b: any): Row => ({ Name: b.Name, CreationDate: b.CreationDate }),
          ),
        columns: [
          { key: 'Name', label: 'Bucket name' },
          { key: 'CreationDate', label: 'Created' },
        ],
      },
      {
        id: 'list_objects_v2',
        label: 'List objects',
        kind: 'list',
        fields: [
          { name: 'Bucket', label: 'Bucket', type: 'string', required: true },
          { name: 'Prefix', label: 'Prefix', type: 'string' },
        ],
        getRows: (r) =>
          (r?.Contents ?? []).map(
            (o: any): Row => ({
              Key: o.Key,
              Size: o.Size,
              StorageClass: o.StorageClass,
              LastModified: o.LastModified,
            }),
          ),
        columns: [
          { key: 'Key', label: 'Key' },
          { key: 'Size', label: 'Size (bytes)' },
          { key: 'StorageClass', label: 'Storage class' },
          { key: 'LastModified', label: 'Last modified' },
        ],
      },
      {
        id: 'create_bucket',
        label: 'Create bucket',
        kind: 'mutation',
        fields: [
          { name: 'Bucket', label: 'Bucket name', type: 'string', required: true },
        ],
      },
      {
        id: 'delete_bucket',
        label: 'Delete bucket',
        kind: 'mutation',
        fields: [
          { name: 'Bucket', label: 'Bucket name', type: 'string', required: true },
        ],
      },
    ],
  },
  {
    key: 'lambda',
    route: 'functions',
    label: 'Functions',
    code: 'lambda',
    icon: Zap,
    summary: 'Serverless functions',
    actions: [
      {
        id: 'list_functions',
        label: 'List functions',
        kind: 'list',
        fields: [],
        getRows: (r) =>
          (r?.Functions ?? []).map(
            (f: any): Row => ({
              FunctionName: f.FunctionName,
              Runtime: f.Runtime,
              MemorySize: f.MemorySize,
              LastModified: f.LastModified,
            }),
          ),
        columns: [
          { key: 'FunctionName', label: 'Function' },
          { key: 'Runtime', label: 'Runtime' },
          { key: 'MemorySize', label: 'Memory (MB)' },
          { key: 'LastModified', label: 'Last modified' },
        ],
      },
      {
        id: 'get_function',
        label: 'Get function',
        kind: 'mutation',
        fields: [
          {
            name: 'FunctionName',
            label: 'Function name',
            type: 'string',
            required: true,
          },
        ],
      },
      {
        id: 'invoke',
        label: 'Invoke',
        kind: 'mutation',
        fields: [
          {
            name: 'FunctionName',
            label: 'Function name',
            type: 'string',
            required: true,
          },
          {
            name: 'Payload',
            label: 'Payload (JSON)',
            type: 'json',
            placeholder: '{"key": "value"}',
            help: 'Sent as the event payload.',
          },
        ],
      },
    ],
  },
  {
    key: 'iam',
    route: 'access',
    label: 'Access',
    code: 'iam',
    icon: KeyRound,
    summary: 'Identity & Access Management',
    actions: [
      {
        id: 'list_users',
        label: 'List users',
        kind: 'list',
        fields: [],
        getRows: (r) =>
          (r?.Users ?? []).map(
            (u: any): Row => ({
              UserName: u.UserName,
              UserId: u.UserId,
              Arn: u.Arn,
              CreateDate: u.CreateDate,
            }),
          ),
        columns: [
          { key: 'UserName', label: 'User' },
          { key: 'UserId', label: 'User ID' },
          { key: 'Arn', label: 'ARN' },
          { key: 'CreateDate', label: 'Created' },
        ],
      },
      {
        id: 'list_roles',
        label: 'List roles',
        kind: 'list',
        fields: [],
        getRows: (r) =>
          (r?.Roles ?? []).map(
            (u: any): Row => ({
              RoleName: u.RoleName,
              RoleId: u.RoleId,
              Arn: u.Arn,
              CreateDate: u.CreateDate,
            }),
          ),
        columns: [
          { key: 'RoleName', label: 'Role' },
          { key: 'RoleId', label: 'Role ID' },
          { key: 'Arn', label: 'ARN' },
          { key: 'CreateDate', label: 'Created' },
        ],
      },
      {
        id: 'get_user',
        label: 'Get user',
        kind: 'mutation',
        fields: [
          {
            name: 'UserName',
            label: 'User name (blank = caller)',
            type: 'string',
          },
        ],
      },
    ],
  },
  {
    key: 'rds',
    route: 'databases',
    label: 'Databases',
    code: 'rds',
    icon: Database,
    summary: 'Relational Database Service',
    actions: [
      {
        id: 'describe_db_instances',
        label: 'List DB instances',
        kind: 'list',
        fields: [],
        getRows: (r) =>
          (r?.DBInstances ?? []).map(
            (d: any): Row => ({
              DBInstanceIdentifier: d.DBInstanceIdentifier,
              DBInstanceStatus: d.DBInstanceStatus,
              Engine: d.Engine,
              DBInstanceClass: d.DBInstanceClass,
            }),
          ),
        columns: [
          { key: 'DBInstanceIdentifier', label: 'Identifier' },
          { key: 'DBInstanceStatus', label: 'Status' },
          { key: 'Engine', label: 'Engine' },
          { key: 'DBInstanceClass', label: 'Class' },
        ],
      },
      {
        id: 'start_db_instance',
        label: 'Start DB',
        kind: 'mutation',
        fields: [
          {
            name: 'DBInstanceIdentifier',
            label: 'DB identifier',
            type: 'string',
            required: true,
          },
        ],
      },
      {
        id: 'stop_db_instance',
        label: 'Stop DB',
        kind: 'mutation',
        fields: [
          {
            name: 'DBInstanceIdentifier',
            label: 'DB identifier',
            type: 'string',
            required: true,
          },
        ],
      },
    ],
  },
  {
    key: 'dynamodb',
    route: 'nosql',
    label: 'NoSQL',
    code: 'dynamodb',
    icon: Table2,
    summary: 'NoSQL database tables',
    actions: [
      {
        id: 'list_tables',
        label: 'List tables',
        kind: 'list',
        fields: [],
        getRows: (r) =>
          (r?.TableNames ?? []).map((name: string): Row => ({ TableName: name })),
        columns: [{ key: 'TableName', label: 'Table' }],
      },
      {
        id: 'describe_table',
        label: 'Describe table',
        kind: 'mutation',
        fields: [
          { name: 'TableName', label: 'Table name', type: 'string', required: true },
        ],
      },
      {
        id: 'delete_table',
        label: 'Delete table',
        kind: 'mutation',
        fields: [
          { name: 'TableName', label: 'Table name', type: 'string', required: true },
        ],
      },
    ],
  },
]

export function getService(key: string | undefined): ServiceDef | undefined {
  return CATALOG.find((s) => s.key === key)
}

/** Look up a service by its non-technical URL slug, e.g. "compute". */
export function getServiceByRoute(route: string | undefined): ServiceDef | undefined {
  return CATALOG.find((s) => s.route === route)
}
