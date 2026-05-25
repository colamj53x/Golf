// Distance to hole filter options and logic

export interface DistanceFilterOption {
  label: string;
  value: string;
  minDistance: number;
  maxDistance: number | null; // null means no upper limit
}

export const DISTANCE_FILTER_OPTIONS: DistanceFilterOption[] = [
  { label: 'All Distances', value: 'all', minDistance: 0, maxDistance: null },
  { label: 'Within 150m', value: '0-150', minDistance: 0, maxDistance: 150 },
  { label: 'Within 100m', value: '0-100', minDistance: 0, maxDistance: 100 },
  { label: '100-150m', value: '100-150', minDistance: 100, maxDistance: 150 },
  { label: '80-99m', value: '80-99', minDistance: 80, maxDistance: 99 },
  { label: '70-79m', value: '70-79', minDistance: 70, maxDistance: 79 },
  { label: '60-69m', value: '60-69', minDistance: 60, maxDistance: 69 },
  { label: '50-59m', value: '50-59', minDistance: 50, maxDistance: 59 },
  { label: '40-49m', value: '40-49', minDistance: 40, maxDistance: 49 },
  { label: '30-39m', value: '30-39', minDistance: 30, maxDistance: 39 },
  { label: '20-29m', value: '20-29', minDistance: 20, maxDistance: 29 },
  { label: '10-19m', value: '10-19', minDistance: 10, maxDistance: 19 },
];

/**
 * Filter shots by target distance (distance to hole when taking the shot)
 * @param shots Array of shots to filter
 * @param filterValue The filter value (e.g., 'all', '80+', '70-79')
 * @returns Filtered array of shots
 */
export function filterShotsByTargetDistance<T extends { target: number }>(
  shots: T[],
  filterValue: string
): T[] {
  if (filterValue === 'all') {
    return shots;
  }

  const option = DISTANCE_FILTER_OPTIONS.find(o => o.value === filterValue);
  if (!option) {
    return shots;
  }

  return shots.filter(shot => {
    const target = Math.round(shot.target);
    if (option.maxDistance === null) {
      // No upper limit (e.g., 80m+)
      return target >= option.minDistance;
    }
    // Range filter (e.g., 70-79m)
    return target >= option.minDistance && target <= option.maxDistance;
  });
}
