// Local storage of which drills are "active" against which club + shot type
// combinations. Keyed by drill id -> array of "club_shotType" tokens.

import { persistDurableLocalSettingsSoon } from './durableLocalSettings';

const STORAGE_KEY = 'drill_bank_assignments_v1';

export type AssignmentMap = Record<string, string[]>; // drillId -> ["dr_full", ...]

export function assignmentToken(club: string, shotType: string): string {
  return `${club}_${shotType}`;
}

export function parseAssignmentToken(token: string): { club: string; shotType: string } {
  const [club, shotType] = token.split('_');
  return { club, shotType };
}

export function loadAssignments(): AssignmentMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAssignments(map: AssignmentMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    persistDurableLocalSettingsSoon();
  } catch {
    // ignore
  }
}

export function setDrillAssignments(drillId: string, tokens: string[]): AssignmentMap {
  const map = loadAssignments();
  if (tokens.length === 0) {
    delete map[drillId];
  } else {
    map[drillId] = Array.from(new Set(tokens));
  }
  saveAssignments(map);
  return map;
}
