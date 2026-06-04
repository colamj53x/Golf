/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export interface RoundReflectionDraft {
  drivingNotes: string;
  ironsNotes: string;
  shortNotes: string;
  puttingNotes: string;
  mentalNotes: string;
  courseManagementNotes: string;
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
}

type ReflectionField = {
  key: keyof RoundReflectionDraft;
  label: string;
  placeholder: string;
};

const FIELDS: ReflectionField[] = [
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
    drivingNotes: '',
    ironsNotes: '',
    shortNotes: '',
    puttingNotes: '',
    mentalNotes: '',
    courseManagementNotes: '',
  };
}

export function hasRoundReflectionContent(value: RoundReflectionDraft): boolean {
  return Object.values(value).some((entry) => entry.trim().length > 0);
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
}: RoundReflectionEditorProps) {
  const [isEditing, setIsEditing] = useState(!collapsible);
  const [valueBeforeEditing, setValueBeforeEditing] = useState(value);
  const statusClassName = statusTone === 'destructive'
    ? 'text-destructive'
    : statusTone === 'default'
      ? 'text-foreground'
      : 'text-muted-foreground';
  const fieldsWithContent = FIELDS.filter((field) => value[field.key].trim().length > 0);

  useEffect(() => {
    setIsEditing(!collapsible);
  }, [collapsible, title]);

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

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {collapsible && !isEditing && (
          <Button variant="outline" className="shrink-0" onClick={startEditing}>
            {fieldsWithContent.length > 0 ? 'Edit thoughts' : 'Add thoughts'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="mx-auto grid max-w-3xl gap-5">
            {FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Textarea
                  id={field.key}
                  value={value[field.key]}
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
        ) : fieldsWithContent.length > 0 ? (
          <div className="mx-auto max-w-3xl space-y-6">
            {fieldsWithContent.map((field) => (
              <section key={field.key} className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{field.label}</h4>
                {value[field.key].trim().split(/\n\s*\n/).map((paragraph, index) => (
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
