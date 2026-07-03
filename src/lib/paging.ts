/**
 * Homepage pagination constants. Page 1 = homepage (featured 1 + top 3 +
 * latest 8 = first 12 articles); older pages live at /page/N/ with 12 each.
 */
export const HOME_FIRST_PAGE = 12;
export const OLDER_PER_PAGE = 12;

export function totalPagesFor(total: number): number {
  if (total <= HOME_FIRST_PAGE) return 1;
  return 1 + Math.ceil((total - HOME_FIRST_PAGE) / OLDER_PER_PAGE);
}
