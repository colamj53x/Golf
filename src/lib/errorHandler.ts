/**
 * Error handler utility for mapping database errors to user-friendly messages
 * This prevents exposing internal implementation details to users
 */

export function getUserFriendlyError(error: unknown): string {
  // Log full error for debugging in development only
  if (import.meta.env.DEV) {
    console.error('[Debug] Full error:', error);
  }

  // Handle null/undefined
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  // Extract error properties safely
  const errorObj = error as { code?: string; message?: string };
  const code = errorObj.code;
  const message = errorObj.message || '';

  // Map Postgres error codes to user-friendly messages
  if (code === '23505') return 'This record already exists.';
  if (code === '23503') return 'Invalid reference to related data.';
  if (code === '23514') return 'Data validation failed. Please check your input.';
  if (code === '42501') return 'Permission denied.';
  if (code === '42P01') return 'Operation failed. Please try again.';
  if (code === '42703') return 'The app is waiting on a database update. Please try again in a moment.';
  if (code === 'PGRST116') return 'No data found.';
  if (code === 'PGRST204' || code === 'PGRST205') {
    return 'The app is waiting on a database update. Please refresh and try again.';
  }

  // Check error message patterns (without exposing details)
  if (message.includes('JWT')) return 'Session expired. Please refresh the page and log in again.';
  if (message.includes('constraint')) return 'Data validation failed. Please check your input.';
  if (message.includes('duplicate')) return 'This record already exists.';
  if (message.includes('foreign key')) return 'Invalid reference to related data.';
  if (message.includes('not null')) return 'Required field is missing.';
  if (message.toLowerCase().includes('schema cache') || message.toLowerCase().includes('could not find the')) {
    return 'The app is waiting on a database update. Please refresh and try again.';
  }
  if (message.includes('permission') || message.includes('denied')) return 'Permission denied.';
  if (message.includes('network') || message.includes('fetch')) return 'Network error. Please check your connection.';

  // Default safe message
  return 'An error occurred. Please try again.';
}

/**
 * Validate shot data before insertion
 */
export interface ShotValidation {
  club: string;
  total: number;
  target: number;
  side: number;
  date: Date;
  endDistanceFromTarget?: number;
}

function localCalendarDayValue(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function validateShot(shot: ShotValidation): string | null {
  if (!shot.club || shot.club.trim().length === 0) {
    return 'Club name is required';
  }
  if (shot.club.length > 10) {
    return 'Club name must be 10 characters or less';
  }
  if (shot.total < 0 || shot.total > 600) {
    return 'Distance must be between 0 and 600 meters';
  }
  if (shot.target < 0 || shot.target > 600) {
    return 'Target distance must be between 0 and 600 meters';
  }
  if (Math.abs(shot.side) > 200) {
    return 'Lateral distance must be between -200 and 200 meters';
  }
  if (shot.endDistanceFromTarget !== undefined && (shot.endDistanceFromTarget < 0 || shot.endDistanceFromTarget > 600)) {
    return 'End distance must be between 0 and 600 meters';
  }
  
  if (Number.isNaN(shot.date.getTime())) {
    return 'Invalid date';
  }

  const today = localCalendarDayValue(new Date());
  const shotDay = localCalendarDayValue(shot.date);
  const minDay = 20200101;
  if (shotDay > today) {
    return 'Future dates are not allowed';
  }
  if (shotDay < minDay) {
    return 'Date must be after January 1, 2020';
  }
  
  return null;
}
