"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleOff,
  DollarSign,
  Loader2,
  Percent,
  Phone,
  TrendingUp,
  User,
  Video,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  position: string | null;
};

type Lead = {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  status: string;
  pipeline_stages: { name: string } | null;
};

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  completed_at: string | null;
  contact_id: string | null;
  lead_id: string | null;
  contacts: Contact | null;
  leads: Lead | null;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function missingContactFields(c: Contact | null) {
  if (!c) return [];
  const missing: { key: string; label: string }[] = [];
  if (!c.company_name) missing.push({ key: "company_name", label: "Empresa" });
  if (!c.position) missing.push({ key: "position", label: "Cargo" });
  if (!c.phone) missing.push({ key: "phone", label: "Teléfono" });
  return missing;
}

function missingLeadFields(l: Lead | null) {
  if (!l) return [];
  const missing: { key: string; label: string }[] = [];
  if (l.value === null) missing.push({ key: "value", label: "Valor estimado ($)" });
  if (!l.expected_close_date) missing.push({ key: "expected_close_date", label: "Fecha de cierre estimada" });
  return missing;
}

function MissingBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-300">
      <AlertCircle className="mr-1 h-3 w-3" />
      {count} dato{count > 1 ? "s" : ""} faltante{count > 1 ? "s" : ""}
    </Badge>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const missingContact = missingContactFields(meeting.contacts);
  const missingLead = missingLeadFields(meeting.leads);
  const totalMissing = missingContact.length + missingLead.length;

  const [contactValues, setContactValues] = useState<Record<string, string>>({});
  const [leadValues, setLeadValues] = useState<Record<string, string>>({});

  // Parse description sections
  const desc = meeting.description ?? "";
  const lines = desc.split("\n");

  async function handleSave() {
    setSaving(true);
    try {
      const contactPatch: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(contactValues)) {
        if (v.trim()) contactPatch[k] = v.trim();
      }

      const leadPatch: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(leadValues)) {
        if (!v.trim()) continue;
        if (k === "value" || k === "probability") leadPatch[k] = Number(v);
        else leadPatch[k] = v.trim();
      }

      const res = await fetch("/app/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: meeting.id,
          contact: Object.keys(contactPatch).length ? contactPatch : undefined,
          lead: Object.keys(leadPatch).length ? leadPatch : undefined,
        }),
      });

      if (res.ok) {
        setSaved(true);
        startTransition(() => router.refresh());
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Video className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">{meeting.title}</CardTitle>
              {meeting.completed_at && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(meeting.completed_at)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalMissing > 0 && !saved && <MissingBadge count={totalMissing} />}
            {saved && (
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Guardado
              </Badge>
            )}
            <button
              onClick={() => setExpanded((p) => !p)}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/10"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Contact + Lead pills */}
        <div className="flex flex-wrap gap-2 pt-2">
          {meeting.contacts && (
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-background/50 px-3 py-1 text-xs">
              <User className="h-3 w-3 text-muted-foreground" />
              <span>{meeting.contacts.first_name} {meeting.contacts.last_name}</span>
              {meeting.contacts.company_name && (
                <span className="text-muted-foreground">· {meeting.contacts.company_name}</span>
              )}
            </div>
          )}
          {meeting.leads && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              <TrendingUp className="h-3 w-3" />
              <span>Deal detectado</span>
              {meeting.leads.value && (
                <span>· ${meeting.leads.value.toLocaleString()}</span>
              )}
            </div>
          )}
          {!meeting.leads && (
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-background/50 px-3 py-1 text-xs text-muted-foreground">
              <CircleOff className="h-3 w-3" />
              Sin deal
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-5 pt-0">
          {/* AI summary */}
          {desc && (
            <div className="space-y-2">
              {lines.map((line, i) => {
                if (!line.trim()) return null;
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <p key={i} className="text-sm font-semibold text-foreground">{line.replace(/\*\*/g, "")}</p>;
                }
                if (line.startsWith("• ")) {
                  return <p key={i} className="ml-3 text-sm text-muted-foreground">{line}</p>;
                }
                if (line.startsWith("[") && line.includes("](")) {
                  const match = line.match(/\[(.+?)\]\((.+?)\)/);
                  if (match) {
                    return (
                      <a key={i} href={match[2]} target="_blank" rel="noopener noreferrer"
                        className="block text-sm text-primary underline underline-offset-4">
                        {match[1]}
                      </a>
                    );
                  }
                }
                return <p key={i} className="text-sm text-muted-foreground">{line}</p>;
              })}
            </div>
          )}

          {/* Missing data forms */}
          {totalMissing > 0 && !saved && (
            <div className="space-y-4 rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
                <AlertCircle className="h-4 w-4" />
                Completá los datos que faltan
              </div>

              {missingContact.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sobre el contacto</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {missingContact.map(({ key, label }) => {
                      const Icon = key === "company_name" ? Building2 : key === "phone" ? Phone : User;
                      return (
                        <div key={key} className="space-y-1.5">
                          <Label className="flex items-center gap-1.5 text-xs">
                            <Icon className="h-3 w-3" />
                            {label}
                          </Label>
                          <Input
                            className="h-8 text-sm"
                            placeholder={key === "phone" ? "+54 11 XXXX XXXX" : label}
                            value={contactValues[key] ?? ""}
                            onChange={(e) => setContactValues((p) => ({ ...p, [key]: e.target.value }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {missingLead.length > 0 && meeting.leads && (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sobre el deal</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {missingLead.map(({ key, label }) => {
                      const Icon = key === "value" ? DollarSign : key === "probability" ? Percent : Calendar;
                      return (
                        <div key={key} className="space-y-1.5">
                          <Label className="flex items-center gap-1.5 text-xs">
                            <Icon className="h-3 w-3" />
                            {label}
                          </Label>
                          <Input
                            className="h-8 text-sm"
                            type={key === "value" || key === "probability" ? "number" : key === "expected_close_date" ? "date" : "text"}
                            placeholder={key === "value" ? "10000" : key === "probability" ? "0-100" : ""}
                            value={leadValues[key] ?? ""}
                            onChange={(e) => setLeadValues((p) => ({ ...p, [key]: e.target.value }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Guardar datos
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function MeetingsInbox({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) {
    return (
      <Card className="bg-card/90">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Video className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">Todavía no hay reuniones procesadas</p>
          <p className="text-sm text-muted-foreground">
            Cuando termines una reunión en Google Meet, Zoom o Teams, Fathom la va a procesar automáticamente y va a aparecer acá.
          </p>
        </CardContent>
      </Card>
    );
  }

  const withMissing = meetings.filter(
    (m) => missingContactFields(m.contacts).length + missingLeadFields(m.leads).length > 0
  );
  const complete = meetings.filter(
    (m) => missingContactFields(m.contacts).length + missingLeadFields(m.leads).length === 0
  );

  return (
    <div className="space-y-6">
      {withMissing.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <AlertCircle className="h-4 w-4" />
            Necesitan tu atención ({withMissing.length})
          </div>
          {withMissing.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}

      {complete.length > 0 && (
        <div className="space-y-3">
          {withMissing.length > 0 && (
            <p className="text-sm font-medium text-muted-foreground">Completas ({complete.length})</p>
          )}
          {complete.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </div>
  );
}
