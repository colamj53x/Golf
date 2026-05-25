// User-created drills, stored locally and merged into the drill bank.
import type { Drill, DrillKind, DrillLevel, DrillWithMeta } from './practiceDrillsLibrary';

const STORAGE_KEY = 'custom_drills_v1';

export interface CustomDrillInput {
  name: string;
  kind: DrillKind;
  level: DrillLevel;
  description: string;
  metricsAddressed: string[];
  fixes: string[];
  // scorable extras
  balls?: number;
  maxScore?: number;
  scoring?: string;
  pass?: number;
  // technique extras
  setup?: string;
  cue?: string;
  reps?: string;
}

export interface StoredCustomDrill extends CustomDrillInput {
  id: string;
  createdAt: string;
}

export function loadCustomDrills(): StoredCustomDrill[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomDrills(drills: StoredCustomDrill[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drills));
  } catch {
    /* ignore */
  }
}

export function addCustomDrill(input: CustomDrillInput): StoredCustomDrill[] {
  const list = loadCustomDrills();
  const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  list.push({ ...input, id, createdAt: new Date().toISOString() });
  saveCustomDrills(list);
  return list;
}

export function deleteCustomDrill(id: string): StoredCustomDrill[] {
  const list = loadCustomDrills().filter((d) => d.id !== id);
  saveCustomDrills(list);
  return list;
}

export function updateCustomDrill(id: string, input: CustomDrillInput): StoredCustomDrill[] {
  const list = loadCustomDrills().map((d) =>
    d.id === id ? { ...d, ...input, id: d.id, createdAt: d.createdAt } : d,
  );
  saveCustomDrills(list);
  return list;
}

export function customDrillToMeta(c: StoredCustomDrill): DrillWithMeta {
  let drill: Drill;
  if (c.kind === 'technique') {
    drill = {
      id: c.id,
      kind: 'technique',
      name: c.name,
      level: c.level,
      focus: c.description,
      setup: c.setup ?? '',
      reps: c.reps ?? '10 balls',
      cue: c.cue ?? '',
      fixes: c.fixes,
      description: c.description,
      metricsAddressed: c.metricsAddressed,
    };
  } else if (c.kind === 'scorable') {
    drill = {
      id: c.id,
      kind: 'scorable',
      name: c.name,
      level: c.level,
      description: c.description,
      balls: c.balls ?? 20,
      maxScore: c.maxScore ?? 20,
      scoring: c.scoring ?? '1 point per ball that meets the target.',
      pass: c.pass ?? 12,
      fixes: c.fixes,
      metricsAddressed: c.metricsAddressed,
    };
  } else {
    drill = {
      id: c.id,
      kind: 'baseline',
      name: c.name,
      level: c.level,
      what: c.description,
      setup: c.setup ?? '',
      scoring: c.scoring ?? '1 per ball that meets the target. Out of 6.',
      fixes: c.fixes,
      description: c.description,
      metricsAddressed: c.metricsAddressed,
    };
  }
  return { drill, level: c.level, sourceConfigKey: 'custom' };
}
