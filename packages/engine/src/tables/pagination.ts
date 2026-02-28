/**
 * Table pagination: slice data into pages.
 */

/**
 * Paginate data rows.
 *
 * Returns the current page's rows along with pagination metadata.
 * Page is 0-indexed and clamped to valid range.
 * If pageSize is 0 or negative, pagination is disabled (returns all rows).
 */
export function paginateData(
  data: Record<string, unknown>[],
  page: number,
  pageSize: number,
): {
  rows: Record<string, unknown>[];
  totalRows: number;
  totalPages: number;
  page: number;
} {
  const totalRows = data.length;

  // Disabled pagination
  if (pageSize <= 0) {
    return {
      rows: data,
      totalRows,
      totalPages: 1,
      page: 0,
    };
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  // Clamp page to valid range
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = clampedPage * pageSize;
  const end = Math.min(start + pageSize, totalRows);

  return {
    rows: data.slice(start, end),
    totalRows,
    totalPages,
    page: clampedPage,
  };
}
