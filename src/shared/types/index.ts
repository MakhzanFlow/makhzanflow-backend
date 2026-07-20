// Shared types exports
export * from "./company-scope.type.js";

// We can define standard types here:
export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}
