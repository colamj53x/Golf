// Track built-in drills that the user has hidden (soft-deleted). Custom drills are
// removed via customDrills.ts. This lets users "delete" library drills without
// losing the original definitions — they can restore later.

import { persistDurableLocalSettingsSoon } from './durableLocalSettings';

const STORAGE_KEY = 'drill_hidden_v1';

export function loadHiddenDrills(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function save(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    persistDurableLocalSettingsSoon();
  } catch {
    /* ignore */
  }
}

export function hideDrill(id: string): string[] {
  const set = new Set(loadHiddenDrills());
  set.add(id);
  const next = Array.from(set);
  save(next);
  return next;
}

export function unhideDrill(id: string): string[] {
  const next = loadHiddenDrills().filter((x) => x !== id);
  save(next);
  return next;
}

export function isHidden(id: string): boolean {
  return loadHiddenDrills().includes(id);
}
