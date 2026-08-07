// Shared constants
export const ROLES = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const COMPANY = {
  INVITE_CODE_LENGTH: 6,
  INVITE_CODE_CHARS: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  JOIN_REQUEST_COOLDOWN_MS: 5 * 60 * 1000,
} as const;
