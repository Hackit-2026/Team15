export function clampPage(pageNumber: number, totalPages: number): number {
  if (totalPages < 1) {
    return 1;
  }
  return Math.min(Math.max(Math.trunc(pageNumber), 1), totalPages);
}
