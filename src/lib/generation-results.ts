export function selectFeaturedResult<T extends { id: string }>(
  results: T[],
  featuredResultId: string | null
): T | null {
  if (featuredResultId) {
    const selectedResult = results.find((result) => result.id === featuredResultId);
    if (selectedResult) {
      return selectedResult;
    }
  }

  return results[0] ?? null;
}
