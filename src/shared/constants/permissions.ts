export const PERMISSION_GROUPS = {
  customers: {
    label: 'Customers',
    description: 'Manage customer records, debts, and profiles',
    permissions: {
      read: { label: 'View customers', description: 'List, search, and view customer details' },
      create: { label: 'Create customers', description: 'Add new customers to the company' },
      update: { label: 'Update customers', description: 'Edit customer information' },
      delete: { label: 'Delete customers', description: 'Remove customers from the company' },
    },
  },
  products: {
    label: 'Products',
    description: 'Manage product catalog and inventory',
    permissions: {
      read: { label: 'View products', description: 'List and view product details' },
      create: { label: 'Create products', description: 'Add new products to the catalog' },
      update: { label: 'Update products', description: 'Edit product information' },
      delete: { label: 'Delete products', description: 'Remove products from the catalog' },
    },
  },
  invoices: {
    label: 'Invoices',
    description: 'Manage sales invoices and billing',
    permissions: {
      read: { label: 'View invoices', description: 'List and view invoice details' },
      create: { label: 'Create invoices', description: 'Issue new invoices' },
      update: { label: 'Update invoices', description: 'Edit existing invoices' },
      delete: { label: 'Delete invoices', description: 'Cancel or remove invoices' },
    },
  },
  payments: {
    label: 'Payments',
    description: 'Manage payments and collections',
    permissions: {
      read: { label: 'View payments', description: 'List and view payment history' },
      create: { label: 'Create payments', description: 'Record payments against invoices' },
    },
  },
  reports: {
    label: 'Reports',
    description: 'Access business reports and analytics',
    permissions: {
      read: { label: 'View reports', description: 'Access company reports and analytics' },
    },
  },
} as const;

export type PermissionGroup = keyof typeof PERMISSION_GROUPS;
export type PermissionAction = 'read' | 'create' | 'update' | 'delete';

export function buildPermissionObject(selected: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of selected) {
    const [group, action] = key.split('.') as [PermissionGroup, PermissionAction];
    if (!result[group]) result[group] = {};
    result[group][action] = true;
  }
  return result;
}

export function flattenPermissions(perms: Record<string, any>): string[] {
  const result: string[] = [];
  for (const [group, actions] of Object.entries(perms)) {
    if (typeof actions === 'object' && actions !== null) {
      for (const [action, value] of Object.entries(actions)) {
        if (value === true) result.push(`${group}.${action}`);
      }
    }
  }
  return result;
}

export function allPermissionKeys(): string[] {
  const keys: string[] = [];
  for (const [group, groupDef] of Object.entries(PERMISSION_GROUPS)) {
    const actions = Object.keys(groupDef.permissions) as PermissionAction[];
    for (const action of actions) {
      keys.push(`${group}.${action}`);
    }
  }
  return keys;
}
