import { describe, expect, it } from 'vitest';
import { createSettingsIdea, mergeSettingsIdeaTags, parseSettingsIdeas } from './settingsIdeas';

describe('settingsIdeas', () => {
  it('keeps valid ideas and cleans up duplicate tags', () => {
    expect(parseSettingsIdeas([
      { id: 'one', text: '  Try a new drill  ', tags: ['Practice', ' practice ', '', 42], createdAt: '2026-06-21' },
      { id: '', text: 'Missing an id', tags: [] },
      { id: 'two', text: '   ', tags: [] },
    ])).toEqual([
      { id: 'one', text: 'Try a new drill', tags: ['Practice'], createdAt: '2026-06-21' },
    ]);
  });

  it('creates an idea from comma-separated tags', () => {
    const idea = createSettingsIdea('  Add putting report  ', 'Putting, Reports, putting');

    expect(idea.text).toBe('Add putting report');
    expect(idea.tags).toEqual(['Putting', 'Reports']);
    expect(idea.id).toBeTruthy();
    expect(idea.createdAt).toBeTruthy();
  });

  it('keeps remembered tags and merges them case-insensitively', () => {
    expect(mergeSettingsIdeaTags(
      ['Practice', 'Reports'],
      [' practice ', 'Putting', '', 42],
    )).toEqual(['Practice', 'Reports', 'Putting']);
  });
});
