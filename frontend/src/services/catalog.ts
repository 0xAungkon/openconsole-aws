import { Database, KeyRound, Server, Boxes, Zap } from 'lucide-react'
import type { Row, ServiceDef } from '../types'

// Declarative source of truth for every service page. Adding a service or action
// is a change here only — the backend proxy is generic.

export const CATALOG: ServiceDef[] = [
  {
    key: 'ec2',
    label: 'EC2',
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
    label: 'S3',
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
    label: 'Lambda',
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
    label: 'IAM',
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
    label: 'RDS',
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
]

export function getService(key: string | undefined): ServiceDef | undefined {
  return CATALOG.find((s) => s.key === key)
}
