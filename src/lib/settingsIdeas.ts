export const SETTINGS_IDEAS_STORAGE_KEY = 'golf_settings_ideas_v1';
export const SETTINGS_IDEA_TAGS_STORAGE_KEY = 'golf_settings_idea_tags_v1';

export interface SettingsIdea {
  id: string;
  text: string;
  tags: string[];
  createdAt: string;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== 'string') continue;
    const tag = candidate.trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

export function mergeSettingsIdeaTags(...tagGroups: unknown[]): string[] {
  return normalizeTags(tagGroups.flatMap(group => Array.isArray(group) ? group : []));
}

export function parseSettingsIdeas(value: unknown): SettingsIdea[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate): SettingsIdea[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const record = candidate as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const text = typeof record.text === 'string' ? record.text.trim() : '';
    if (!id || !text) return [];

    return [{
      id,
      text,
      tags: normalizeTags(record.tags),
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
    }];
  });
}

export function loadSettingsIdeas(): SettingsIdea[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return parseSettingsIdeas(JSON.parse(localStorage.getItem(SETTINGS_IDEAS_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function loadSettingsIdeaTags(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return normalizeTags(JSON.parse(localStorage.getItem(SETTINGS_IDEA_TAGS_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function persistSettingsSoon(): void {
  void import('@/lib/durableLocalSettings').then(({ persistDurableLocalSettingsSoon }) => {
    persistDurableLocalSettingsSoon();
  });
}

export function saveSettingsIdeas(ideas: SettingsIdea[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SETTINGS_IDEAS_STORAGE_KEY, JSON.stringify(parseSettingsIdeas(ideas)));
  persistSettingsSoon();
}

export function saveSettingsIdeaTags(tags: string[]): string[] {
  const normalized = normalizeTags(tags);
  if (typeof localStorage === 'undefined') return normalized;
  localStorage.setItem(SETTINGS_IDEA_TAGS_STORAGE_KEY, JSON.stringify(normalized));
  persistSettingsSoon();
  return normalized;
}

export function rememberSettingsIdeaTags(tags: string[]): string[] {
  return saveSettingsIdeaTags(mergeSettingsIdeaTags(loadSettingsIdeaTags(), tags));
}

export function createSettingsIdea(text: string, tagsInput: string): SettingsIdea {
  const tags = normalizeTags(tagsInput.split(','));
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `idea-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id,
    text: text.trim(),
    tags,
    createdAt: new Date().toISOString(),
  };
}
