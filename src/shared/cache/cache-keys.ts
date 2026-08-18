export const CacheKeys = {
  products: {
    list: (companyId: string, hash: string) => `products:list:${companyId}:${hash}`,
    detail: (id: string, companyId: string) => `products:detail:${id}:${companyId}`,
    lowStock: (companyId: string, hash: string) => `products:low-stock:${companyId}:${hash}`,
  },

  customers: {
    list: (companyId: string, hash: string) => `customers:list:${companyId}:${hash}`,
    detail: (id: string, companyId: string) => `customers:detail:${id}:${companyId}`,
    summary: (companyId: string) => `customers:summary:${companyId}`,
    debtors: (companyId: string, hash: string) => `customers:debtors:${companyId}:${hash}`,
    debt: (id: string, companyId: string) => `customers:debt:${id}:${companyId}`,
    invoices: (id: string, companyId: string, hash: string) => `customers:invoices:${id}:${companyId}:${hash}`,
    payments: (id: string, companyId: string, hash: string) => `customers:payments:${id}:${companyId}:${hash}`,
  },

  invoices: {
    list: (companyId: string, hash: string) => `invoices:list:${companyId}:${hash}`,
    detail: (id: string, companyId: string) => `invoices:detail:${id}:${companyId}`,
  },

  dashboard: {
    stats: (companyId: string) => `dashboard:stats:${companyId}`,
    lowStock: (companyId: string, hash: string) => `dashboard:low-stock:${companyId}:${hash}`,
    monthlyReport: (companyId: string, hash: string) => `dashboard:monthly-report:${companyId}:${hash}`,
    activity: (companyId: string, hash: string) => `dashboard:activity:${companyId}:${hash}`,
  },

  companies: {
    user: (userId: string) => `companies:user:${userId}`,
    detail: (companyId: string) => `companies:detail:${companyId}`,
    members: (companyId: string, hash: string) => `companies:members:${companyId}:${hash}`,
    permissions: (companyId: string, userId: string) => `companies:permissions:${companyId}:${userId}`,
    lookup: (code: string) => `companies:lookup:${code}`,
    joinRequests: (companyId: string) => `companies:join-requests:${companyId}`,
    userJoinRequests: (userId: string) => `companies:user-join-requests:${userId}`,
  },

  auth: {
    profile: (userId: string) => `auth:profile:${userId}`,
  },
} as const;
