// Per-drill overrides for built-in drills. Custom drills are edited in customDrills.ts directly.
import type { CustomDrillInput } from './customDrills';
import type { Drill, DrillWithMeta } from './practiceDrillsLibrary';
import { persistDurableLocalSettingsSoon } from './durableLocalSettings';

const STORAGE_KEY = 'drill_overrides_v1';

export type DrillOverride = Partial<CustomDrillInput>;
export type OverrideMap = Record<string, DrillOverride>;

export function loadOverrides(): OverrideMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveOverrides(map: OverrideMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    persistDurableLocalSettingsSoon();
  } catch {
    /* ignore */
  }
}

export function setOverride(id: string, override: DrillOverride): OverrideMap {
  const map = loadOverrides();
  map[id] = override;
  saveOverrides(map);
  return map;
}

export function clearOverride(id: string): OverrideMap {
  const map = loadOverrides();
  delete map[id];
  saveOverrides(map);
  return map;
}

// Apply an override to a built-in drill, returning a new DrillWithMeta.
export function applyOverride(meta: DrillWithMeta, override: DrillOverride | undefined): DrillWithMeta {
  if (!override) return meta;
  const base = meta.drill;
  const merged: Drill = (() => {
    if (base.kind === 'technique') {
      return {
        ...base,
        name: override.name ?? base.name,
        level: override.level ?? base.level,
        description: override.description ?? base.description,
        focus: override.description ?? base.focus,
        setup: override.setup ?? base.setup,
        cue: override.cue ?? base.cue,
        reps: override.reps ?? base.reps,
        metricsAddressed: override.metricsAddressed ?? base.metricsAddressed,
        fixes: override.fixes ?? base.fixes,
      };
    }
    if (base.kind === 'scorable') {
      return {
        ...base,
        name: override.name ?? base.name,
        level: override.level ?? base.level,
        description: override.description ?? base.description,
        balls: override.balls ?? base.balls,
        maxScore: override.maxScore ?? base.maxScore,
        scoring: override.scoring ?? base.scoring,
        pass: override.pass ?? base.pass,
        metricsAddressed: override.metricsAddressed ?? base.metricsAddressed,
        fixes: override.fixes ?? base.fixes,
      };
    }
    return {
      ...base,
      name: override.name ?? base.name,
      level: override.level ?? base.level,
      description: override.description ?? base.description,
      what: override.description ?? base.what,
      setup: override.setup ?? base.setup,
      scoring: override.scoring ?? base.scoring,
      metricsAddressed: override.metricsAddressed ?? base.metricsAddressed,
      fixes: override.fixes ?? base.fixes,
    };
  })();
  return { ...meta, drill: merged, level: override.level ?? meta.level };
}

// Build a CustomDrillInput from a drill, suitable for prefilling the edit form.
export function drillToInput(meta: DrillWithMeta): CustomDrillInput {
  const d = meta.drill;
  const common = {
    name: d.name,
    kind: d.kind,
    level: meta.level,
    description: d.description ?? (d.kind === 'technique' ? d.focus : d.kind === 'baseline' ? d.what : ''),
    metricsAddressed: d.metricsAddressed ?? [],
    fixes: d.fixes ?? [],
  };
  if (d.kind === 'technique') {
    return { ...common, setup: d.setup, cue: d.cue, reps: d.reps };
  }
  if (d.kind === 'scorable') {
    return { ...common, balls: d.balls, maxScore: d.maxScore, scoring: d.scoring, pass: d.pass };
  }
  return { ...common, setup: d.setup, scoring: d.scoring };
}
