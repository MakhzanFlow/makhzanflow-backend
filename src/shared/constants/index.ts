// Shared constants
export const ROLES = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];
