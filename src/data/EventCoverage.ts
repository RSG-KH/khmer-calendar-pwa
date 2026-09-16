export const eventCoverage = {
  fromYear: 1980, throughYear: 2050,
  capturedFromYear: 2000, capturedThroughYear: 2030
} as const;

export function hasCapturedYear(year: number): boolean {
  return year >= eventCoverage.capturedFromYear && year <= eventCoverage.capturedThroughYear;
}
