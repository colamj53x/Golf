import { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Phone, Plus, Save, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useGolfData } from '@/context/GolfDataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PlayingPartner } from '@/types/golf';

function normalizePlayingPartner(partner: PlayingPartner): PlayingPartner {
  return {
    id: partner.id,
    name: partner.name,
    notes: partner.notes ?? '',
    hasMobileNumber: partner.hasMobileNumber === true,
    playedDates: Array.isArray(partner.playedDates)
      ? [...new Set(partner.playedDates.filter((date) => typeof date === 'string' && date.trim().length > 0))].sort((a, b) => b.localeCompare(a))
      : [],
  };
}

function latestPlayedDate(partner: PlayingPartner): string | null {
  return partner.playedDates?.[0] ?? null;
}

export function PlayingPartnersTab() {
  const { playingPartners, setPlayingPartners } = useGolfData();
  const [newPartnerName, setNewPartnerName] = useState('');
  const [partnerDrafts, setPartnerDrafts] = useState<PlayingPartner[]>(playingPartners.map(normalizePlayingPartner));
  const [expandedPartnerIds, setExpandedPartnerIds] = useState<Set<string>>(new Set());
  const [partnerDateDrafts, setPartnerDateDrafts] = useState<Record<string, string>>({});
  const [hasPartnerChanges, setHasPartnerChanges] = useState(false);

  useEffect(() => {
    if (hasPartnerChanges) return;
    setPartnerDrafts(playingPartners.map(normalizePlayingPartner));
  }, [hasPartnerChanges, playingPartners]);

  const updatePartnerDraft = (partnerId: string, updates: Partial<PlayingPartner>) => {
    setHasPartnerChanges(true);
    setPartnerDrafts((current) => current.map((partner) => (
      partner.id === partnerId ? normalizePlayingPartner({ ...partner, ...updates }) : partner
    )));
  };

  const addPlayedDate = (partnerId: string) => {
    const date = partnerDateDrafts[partnerId];
    if (!date) return;
    const partner = partnerDrafts.find((item) => item.id === partnerId);
    const dates = new Set(partner?.playedDates ?? []);
    dates.add(date);
    updatePartnerDraft(partnerId, { playedDates: [...dates].sort((a, b) => b.localeCompare(a)) });
    setPartnerDateDrafts((current) => ({ ...current, [partnerId]: '' }));
  };

  const removePlayedDate = (partnerId: string, date: string) => {
    const partner = partnerDrafts.find((item) => item.id === partnerId);
    updatePartnerDraft(partnerId, { playedDates: (partner?.playedDates ?? []).filter((item) => item !== date) });
  };

  const savePlayingPartners = () => {
    const seen = new Set<string>();
    const cleaned = partnerDrafts
      .map(normalizePlayingPartner)
      .filter((partner) => {
        const nameKey = partner.name.trim().toLowerCase();
        if (!nameKey || seen.has(nameKey)) return false;
        seen.add(nameKey);
        return true;
      });
    setPlayingPartners(cleaned);
    setPartnerDrafts(cleaned);
    setExpandedPartnerIds(new Set());
    setHasPartnerChanges(false);
    toast.success('Playing partners saved');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Playing Partners
        </CardTitle>
        <CardDescription>
          Keep a reusable directory for the people you play rounds with.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const name = newPartnerName.trim();
            if (!name) return;
            const exists = partnerDrafts.some((partner) => partner.name.trim().toLowerCase() === name.toLowerCase());
            if (exists) {
              toast.info('That playing partner is already in your directory');
              return;
            }
            const id = crypto.randomUUID();
            setPartnerDrafts((current) => [...current, { id, name, notes: '', hasMobileNumber: false, playedDates: [] }]);
            setExpandedPartnerIds((current) => new Set([...current, id]));
            setHasPartnerChanges(true);
            setNewPartnerName('');
          }}
        >
          <Input
            value={newPartnerName}
            onChange={(event) => setNewPartnerName(event.target.value)}
            placeholder="Add a name"
            className="sm:max-w-xs"
          />
          <Button type="submit" className="gap-2">
            <Plus className="h-4 w-4" />
            Add
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={savePlayingPartners} disabled={!hasPartnerChanges}>
            <Save className="h-4 w-4" />
            Save Partners
          </Button>
        </form>

        {partnerDrafts.length > 0 ? (
          <div className="rounded-md border">
            {partnerDrafts
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((partner) => {
                const expanded = expandedPartnerIds.has(partner.id);
                const latestDate = latestPlayedDate(partner);
                const notes = (partner.notes ?? '').trim();
                return (
                  <div key={partner.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      className="grid w-full gap-3 px-3 py-4 text-left transition hover:bg-muted/30 md:grid-cols-[minmax(90px,160px)_96px_170px_minmax(180px,1fr)] md:items-center"
                      onClick={() => {
                        setExpandedPartnerIds((current) => {
                          const next = new Set(current);
                          if (next.has(partner.id)) next.delete(partner.id);
                          else next.add(partner.id);
                          return next;
                        });
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="truncate font-semibold">{partner.name || 'Unnamed partner'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className={`h-4 w-4 ${partner.hasMobileNumber ? 'text-green-600' : 'text-muted-foreground/40'}`} />
                        <span className="text-muted-foreground">{partner.hasMobileNumber ? 'Mobile' : 'No mobile'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        {latestDate ? `${latestDate} · ${partner.playedDates?.length ?? 0} date${(partner.playedDates?.length ?? 0) === 1 ? '' : 's'}` : 'No dates yet'}
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {notes || 'No notes yet'}
                      </p>
                    </button>
                    {expanded && (
                      <div className="grid gap-4 border-t bg-muted/10 p-4 lg:grid-cols-[minmax(120px,180px)_minmax(220px,1fr)_minmax(220px,320px)]">
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor={`partner-name-${partner.id}`}>Name</Label>
                            <Input
                              id={`partner-name-${partner.id}`}
                              value={partner.name}
                              onChange={(event) => updatePartnerDraft(partner.id, { name: event.target.value })}
                              className="h-9"
                            />
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={partner.hasMobileNumber === true}
                              onCheckedChange={(checked) => updatePartnerDraft(partner.id, { hasMobileNumber: checked === true })}
                            />
                            I have their mobile number
                          </label>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`partner-notes-${partner.id}`}>Comments and Notes</Label>
                          <Textarea
                            id={`partner-notes-${partner.id}`}
                            value={partner.notes ?? ''}
                            onChange={(event) => updatePartnerDraft(partner.id, { notes: event.target.value })}
                            placeholder="Anything useful to remember"
                            className="min-h-[120px]"
                          />
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor={`partner-date-${partner.id}`}>Dates Played Together</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`partner-date-${partner.id}`}
                              type="date"
                              value={partnerDateDrafts[partner.id] ?? ''}
                              onChange={(event) => setPartnerDateDrafts((current) => ({ ...current, [partner.id]: event.target.value }))}
                              className="h-9"
                            />
                            <Button type="button" variant="outline" size="sm" onClick={() => addPlayedDate(partner.id)}>
                              Add
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(partner.playedDates ?? []).map((date) => (
                              <span key={date} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs">
                                {date}
                                <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removePlayedDate(partner.id, date)}>
                                  x
                                </button>
                              </span>
                            ))}
                            {(partner.playedDates ?? []).length === 0 && <span className="text-sm text-muted-foreground">No dates added yet.</span>}
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2 text-destructive hover:text-destructive"
                              onClick={() => {
                                setPartnerDrafts((current) => current.filter((item) => item.id !== partner.id));
                                setHasPartnerChanges(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                            <Button type="button" size="sm" className="gap-2" onClick={savePlayingPartners}>
                              <Save className="h-4 w-4" />
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
            No playing partners saved yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
