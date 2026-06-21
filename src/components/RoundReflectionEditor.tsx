/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PlayingPartner } from '@/types/golf';

export interface RoundReflectionDraft {
  generalComments: string;
  drivingNotes: string;
  ironsNotes: string;
  shortNotes: string;
  puttingNotes: string;
  mentalNotes: string;
  courseManagementNotes: string;
  playingPartnerIds: string[];
}

interface RoundReflectionEditorProps {
  title: string;
  description: string;
  value: RoundReflectionDraft;
  onChange: (next: RoundReflectionDraft) => void;
  onSave?: () => Promise<boolean | void> | boolean | void;
  isSaving?: boolean;
  saveLabel?: string;
  statusMessage?: string | null;
  statusTone?: 'default' | 'destructive' | 'muted';
  collapsible?: boolean;
  editRequestKey?: number;
  hideReadOnlyWhenCollapsed?: boolean;
  playingPartners?: PlayingPartner[];
  onAddPlayingPartner?: (name: string) => Promise<string | null>;
}

type ReflectionField = {
  key: keyof RoundReflectionDraft;
  label: string;
  placeholder: string;
};

const FIELDS: ReflectionField[] = [
  {
    key: 'generalComments',
    label: 'Comments',
    placeholder: 'Anything worth remembering from the day, even if you did not track shots.',
  },
  {
    key: 'drivingNotes',
    label: 'Driving',
    placeholder: 'Fairways, misses, strike, shape, and what showed up under pressure.',
  },
  {
    key: 'ironsNotes',
    label: 'Irons and Hybrids',
    placeholder: 'Distance control, contact, start line, and patterns with irons and hybrids.',
  },
  {
    key: 'shortNotes',
    label: 'Short',
    placeholder: 'Chipping, pitching, bunker play, and scoring shots around the green.',
  },
  {
    key: 'puttingNotes',
    label: 'Putting',
    placeholder: 'Start line, pace, reads, short putts, and any recurring miss.',
  },
  {
    key: 'mentalNotes',
    label: 'Mental',
    placeholder: 'Confidence, focus, resilience, emotions, and pre-shot commitment.',
  },
  {
    key: 'courseManagementNotes',
    label: 'Course Management',
    placeholder: 'Club choice, targets, strategy, and any holes or decisions that swung the round.',
  },
];

export function createEmptyRoundReflectionDraft(): RoundReflectionDraft {
  return {
    generalComments: '',
    drivingNotes: '',
    ironsNotes: '',
    shortNotes: '',
    puttingNotes: '',
    mentalNotes: '',
    courseManagementNotes: '',
    playingPartnerIds: [],
  };
}

export function hasRoundReflectionContent(value: RoundReflectionDraft): boolean {
  return Object.entries(value).some(([, entry]) => Array.isArray(entry) ? entry.length > 0 : String(entry ?? '').trim().length > 0);
}

export function RoundReflectionEditor({
  title,
  description,
  value,
  onChange,
  onSave,
  isSaving = false,
  saveLabel = 'Save Round Thoughts',
  statusMessage = null,
  statusTone = 'muted',
  collapsible = false,
  editRequestKey = 0,
  hideReadOnlyWhenCollapsed = false,
  playingPartners = [],
  onAddPlayingPartner,
}: RoundReflectionEditorProps) {
  const [isEditing, setIsEditing] = useState(!collapsible);
  const [valueBeforeEditing, setValueBeforeEditing] = useState(value);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [isAddingPartner, setIsAddingPartner] = useState(false);
  const latestValue = useRef(value);
  const statusClassName = statusTone === 'destructive'
    ? 'text-destructive'
    : statusTone === 'default'
      ? 'text-foreground'
      : 'text-muted-foreground';
  const fieldsWithContent = FIELDS.filter((field) => (value[field.key] ?? '').trim().length > 0);
  const selectedPartnerIds = value.playingPartnerIds ?? [];
  const selectedPartners = selectedPartnerIds
    .map((id) => playingPartners.find((partner) => partner.id === id))
    .filter((partner): partner is PlayingPartner => Boolean(partner));
  const filteredPartners = playingPartners
    .filter((partner) => partner.name.toLowerCase().includes(partnerSearch.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exactPartnerExists = playingPartners.some((partner) => partner.name.trim().toLowerCase() === partnerSearch.trim().toLowerCase());

  useEffect(() => {
    setIsEditing(!collapsible);
  }, [collapsible, title]);

  useEffect(() => {
    latestValue.current = value;
  }, [value]);

  useEffect(() => {
    if (editRequestKey > 0) {
      setValueBeforeEditing(latestValue.current);
      setIsEditing(true);
    }
  }, [editRequestKey]);

  const startEditing = () => {
    setValueBeforeEditing(value);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    onChange(valueBeforeEditing);
    setIsEditing(false);
  };

  const save = async () => {
    if (!onSave) {
      setIsEditing(false);
      return;
    }
    const didSave = await onSave();
    if (didSave !== false) {
      setIsEditing(false);
    }
  };

  const togglePlayingPartner = (partnerId: string) => {
    const nextIds = selectedPartnerIds.includes(partnerId)
      ? selectedPartnerIds.filter((id) => id !== partnerId)
      : [...selectedPartnerIds, partnerId];
    onChange({ ...value, playingPartnerIds: nextIds });
  };

  const addPlayingPartnerFromSearch = async () => {
    const trimmed = partnerSearch.trim();
    if (!onAddPlayingPartner || !trimmed || exactPartnerExists || isAddingPartner) return;
    setIsAddingPartner(true);
    try {
      const partnerId = await onAddPlayingPartner(trimmed);
      if (!partnerId) return;
      onChange({ ...value, playingPartnerIds: [...selectedPartnerIds, partnerId] });
      setPartnerSearch('');
    } finally {
      setIsAddingPartner(false);
    }
  };

  if (collapsible && hideReadOnlyWhenCollapsed && !isEditing) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {collapsible && !isEditing && (
          <Button variant="outline" className="shrink-0" onClick={startEditing}>
            {fieldsWithContent.length > 0 || selectedPartners.length > 0 ? 'Edit thoughts' : 'Add thoughts'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="mx-auto grid max-w-3xl gap-5">
            {(playingPartners.length > 0 || onAddPlayingPartner) && (
              <div className="space-y-3">
                <Label>Who did I play with?</Label>
                {selectedPartners.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedPartners.map((partner) => (
                      <Badge key={partner.id} variant="secondary" className="gap-1">
                        {partner.name}
                        <button
                          type="button"
                          aria-label={`Remove ${partner.name}`}
                          onClick={() => togglePlayingPartner(partner.id)}
                          className="rounded-sm hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={partnerSearch}
                    onChange={(event) => setPartnerSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void addPlayingPartnerFromSearch();
                      }
                    }}
                    placeholder="Search or add a playing partner"
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {filteredPartners.map((partner) => {
                    const selected = selectedPartnerIds.includes(partner.id);
                    return (
                      <Button
                        key={partner.id}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => togglePlayingPartner(partner.id)}
                      >
                        {partner.name}
                      </Button>
                    );
                  })}
                  {onAddPlayingPartner && partnerSearch.trim() && !exactPartnerExists && (
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void addPlayingPartnerFromSearch()} disabled={isAddingPartner}>
                      <Plus className="h-4 w-4" />
                      {isAddingPartner ? 'Saving partner...' : `Add ${partnerSearch.trim()}`}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Textarea
                  id={field.key}
                  value={value[field.key] ?? ''}
                  onChange={(event) => onChange({
                    ...value,
                    [field.key]: event.target.value,
                  })}
                  placeholder={field.placeholder}
                  className="min-h-[120px] leading-6"
                />
              </div>
            ))}
          </div>
        ) : fieldsWithContent.length > 0 || selectedPartners.length > 0 ? (
          <div className="mx-auto max-w-3xl space-y-6">
            {selectedPartners.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Played With</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPartners.map((partner) => <Badge key={partner.id} variant="secondary">{partner.name}</Badge>)}
                </div>
              </section>
            )}
            {fieldsWithContent.map((field) => (
              <section key={field.key} className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{field.label}</h4>
                {(value[field.key] ?? '').trim().split(/\n\s*\n/).map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No round thoughts added yet.</p>
        )}
        {statusMessage && (
          <p className={`text-sm ${statusClassName}`}>{statusMessage}</p>
        )}
        {(onSave || collapsible) && isEditing && (
          <div className="flex justify-end gap-2">
            {collapsible && (
              <Button variant="outline" onClick={cancelEditing} disabled={isSaving}>
                Cancel
              </Button>
            )}
            <Button onClick={() => void save()} disabled={isSaving}>
              {isSaving ? 'Saving...' : onSave ? saveLabel : 'Done'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
