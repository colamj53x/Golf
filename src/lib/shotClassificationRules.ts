import { useSyncExternalStore } from 'react';

export const SHOT_CLASSIFICATION_RULES_KEY = 'golf_shot_classification_rules_v1';
export const SHOT_CLASSIFICATION_RULES_EVENT = 'golf-shot-classification-rules-change';

export interface ShotClassificationRule {
  fullMinTarget: number | null;
  allFullNormal?: boolean;
}

export type ShotClassificationRules = Record<string, ShotClassificationRule>;
let cache: ShotClassificationRules | null = null;

export function shotClassificationRuleKey(clubId: string, shotType: string): string {
  return `${clubId}_${shotType}`;
}

export function clubFullNormalRuleKey(clubId: string): string {
  return `${clubId}__all_full_normal`;
}

function emitRulesChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SHOT_CLASSIFICATION_RULES_EVENT));
}

function normalizeRule(value: unknown): ShotClassificationRule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const fullMinTarget = (value as { fullMinTarget?: unknown }).fullMinTarget;
  const allFullNormal = (value as { allFullNormal?: unknown }).allFullNormal === true;
  if (fullMinTarget === null || fullMinTarget === undefined || fullMinTarget === '') {
    return { fullMinTarget: null, ...(allFullNormal ? { allFullNormal } : {}) };
  }
  if (typeof fullMinTarget !== 'number' || !Number.isFinite(fullMinTarget) || fullMinTarget < 0) return null;
  return { fullMinTarget, ...(allFullNormal ? { allFullNormal } : {}) };
}

function normalizeRules(value: unknown): ShotClassificationRules {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const rules: ShotClassificationRules = {};
  for (const [key, ruleValue] of Object.entries(value)) {
    const rule = normalizeRule(ruleValue);
    if (rule && (rule.fullMinTarget !== null || rule.allFullNormal)) rules[key] = rule;
  }
  return rules;
}

function readShotClassificationRules(): ShotClassificationRules {
  if (typeof localStorage === 'undefined') return {};
  try {
    return normalizeRules(JSON.parse(localStorage.getItem(SHOT_CLASSIFICATION_RULES_KEY) || '{}'));
  } catch {
    return {};
  }
}

export function loadShotClassificationRules(): ShotClassificationRules {
  if (cache === null) cache = readShotClassificationRules();
  return cache;
}

export function saveShotClassificationRules(rules: ShotClassificationRules): void {
  if (typeof localStorage === 'undefined') return;
  const normalized = normalizeRules(rules);
  cache = normalized;
  localStorage.setItem(SHOT_CLASSIFICATION_RULES_KEY, JSON.stringify(normalized));
  void import('@/lib/durableLocalSettings').then(({ persistDurableLocalSettingsSoon }) => {
    persistDurableLocalSettingsSoon();
  });
  emitRulesChanged();
}

export function getShotClassificationRule(
  rules: ShotClassificationRules,
  clubId: string,
  shotType: string,
): ShotClassificationRule | null {
  return rules[shotClassificationRuleKey(clubId, shotType)] ?? null;
}

export function isClubFullNormalClassification(rules: ShotClassificationRules, clubId: string): boolean {
  return rules[clubFullNormalRuleKey(clubId)]?.allFullNormal === true;
}

export function classifyPowerByTarget(rule: ShotClassificationRule | null, target: number): 'full' | '9pm' | null {
  if (!rule || rule.fullMinTarget === null || !Number.isFinite(target)) return null;
  return target >= rule.fullMinTarget ? 'full' : '9pm';
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handleChange = () => {
    cache = null;
    callback();
  };
  window.addEventListener('storage', handleChange);
  window.addEventListener(SHOT_CLASSIFICATION_RULES_EVENT, handleChange);
  window.addEventListener('golf-durable-local-settings-hydrated', handleChange);
  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(SHOT_CLASSIFICATION_RULES_EVENT, handleChange);
    window.removeEventListener('golf-durable-local-settings-hydrated', handleChange);
  };
}

export function useShotClassificationRules(): ShotClassificationRules {
  return useSyncExternalStore(
    subscribe,
    loadShotClassificationRules,
    () => ({}),
  );
}
