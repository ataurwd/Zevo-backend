import { PaginationMeta } from "./response";

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(
  query: { page?: unknown; limit?: unknown },
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams {
  let page = parseInt(String(query.page), 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(String(query.limit), 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }
  if (limit > maxLimit) {
    limit = maxLimit;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const total_pages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
}
