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
  Mail,
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
import {
  MEETING_TYPE_LABELS,
  type MeetingMetadata,
  type MeetingQuestion,
} from "@/lib/meeting-questions";

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
  metadata: MeetingMetadata | null;
  contacts: Contact | null;
  leads: Lead | null;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function needsAttention(m: Meeting): boolean {
  const meta = m.metadata;
  // Has smart questions and not complete
  if (meta?.questions?.length) {
    return meta.enrichment_complete !== true;
  }
  // Legacy: check generic missing fields
  if (!m.contacts) return true;
  if (!m.contacts.company_name || !m.contacts.position) return true;
  if (m.leads && (m.leads.value === null || !m.leads.expected_close_date)) return true;
  return false;
}

// ── Question card component ───────────────────────────────────────────────────
function QuestionCard({
  question,
  answer,
  onChange,
}: {
  question: MeetingQuestion;
  answer: string;
  onChange: (value: string) => void;
}) {
  const Icon =
    question.field.includes("email") ? Mail
    : question.field.includes("phone") ? Phone
    : question.field.includes("company") || question.field.includes("deal") ? Building2
    : question.field.includes("value") ? DollarSign
    : question.field.includes("date") ? Calendar
    : question.field.includes("position") || question.field.includes("closing") ? TrendingUp
    : User;

  return (
    <div className="rounded-xl border border-white/10 bg-background/40 p-3.5 space-y-2.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {question.text}
      </Label>

      {question.type === "select" && question.options ? (
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                answer === opt
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <Input
          className="h-8 text-sm"
          type={question.type === "number" ? "number" : question.type === "date" ? "date" : "text"}
          placeholder={question.prefilled ?? (question.type === "number" ? "0" : question.type === "date" ? "YYYY-MM-DD" : "")}
          value={answer}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

// ── Legacy missing-data form (for older meetings without metadata) ─────────────
function LegacyMissingForm({ meeting, onSaved }: { meeting: Meeting; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [wantsDeal, setWantsDeal] = useState(false);
  const [contactValues, setContactValues] = useState<Record<string, string>>({});
  const [leadValues, setLeadValues] = useState<Record<string, string>>({});
  const [newContact, setNewContact] = useState({ first_name: "", last_name: "", email: "" });
  const [newLead, setNewLead] = useState({ title: "", value: "", expected_close_date: "" });

  const noContact = !meeting.contacts;
  const missingContact: { key: string; label: string }[] = [];
  const missingLead: { key: string; label: string }[] = [];

  if (meeting.contacts) {
    if (!meeting.contacts.company_name) missingContact.push({ key: "company_name", label: "Empresa" });
    if (!meeting.contacts.position) missingContact.push({ key: "position", label: "Cargo" });
    if (!meeting.contacts.phone) missingContact.push({ key: "phone", label: "Teléfono" });
  }
  if (meeting.leads) {
    if (meeting.leads.value === null) missingLead.push({ key: "value", label: "Valor estimado ($)" });
    if (!meeting.leads.expected_close_date) missingLead.push({ key: "expected_close_date", label: "Fecha de cierre estimada" });
  }

  const hasSomethingToSave =
    Object.values(contactValues).some((v) => v.trim()) ||
    Object.values(leadValues).some((v) => v.trim()) ||
    (noContact && (newContact.first_name || newContact.email)) ||
    (wantsDeal && newLead.title);

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
      await fetch("/app/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: meeting.id,
          contact: Object.keys(contactPatch).length ? contactPatch : undefined,
          lead: Object.keys(leadPatch).length ? leadPatch : undefined,
          ...(noContact && (newContact.first_name || newContact.email) ? { newContact } : {}),
          ...(wantsDeal && newLead.title ? { newLead } : {}),
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
        <AlertCircle className="h-4 w-4" />
        Completá los datos que faltan
      </div>

      {noContact && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">¿Con quién fue la reunión?</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[["first_name", "Nombre", "Juan"], ["last_name", "Apellido", "Pérez"], ["email", "Email", "juan@empresa.com"]].map(([key, label, ph]) => (
              <div key={key} className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  {key === "email" ? <Mail className="h-3 w-3" /> : <User className="h-3 w-3" />}{label}
                </Label>
                <Input className="h-8 text-sm" placeholder={ph}
                  value={newContact[key as keyof typeof newContact]}
                  onChange={(e) => setNewContact((p) => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>
      )}

      {!noContact && missingContact.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sobre el contacto</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {missingContact.map(({ key, label }) => {
              const Icon = key === "company_name" ? Building2 : key === "phone" ? Phone : User;
              return (
                <div key={key} className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs"><Icon className="h-3 w-3" />{label}</Label>
                  <Input className="h-8 text-sm"
                    placeholder={key === "phone" ? "+54 11 XXXX XXXX" : label}
                    value={contactValues[key] ?? ""}
                    onChange={(e) => setContactValues((p) => ({ ...p, [key]: e.target.value }))} />
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
              const Icon = key === "value" ? DollarSign : Calendar;
              return (
                <div key={key} className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs"><Icon className="h-3 w-3" />{label}</Label>
                  <Input className="h-8 text-sm"
                    type={key === "value" ? "number" : key === "expected_close_date" ? "date" : "text"}
                    value={leadValues[key] ?? ""}
                    onChange={(e) => setLeadValues((p) => ({ ...p, [key]: e.target.value }))} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!meeting.leads && !wantsDeal && (
        <button onClick={() => setWantsDeal(true)}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          + Crear deal manualmente para esta reunión
        </button>
      )}
      {wantsDeal && !meeting.leads && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nuevo deal</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="flex items-center gap-1.5 text-xs"><TrendingUp className="h-3 w-3" />Nombre del deal</Label>
              <Input className="h-8 text-sm" placeholder="Propuesta"
                value={newLead.title} onChange={(e) => setNewLead((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs"><DollarSign className="h-3 w-3" />Valor ($)</Label>
              <Input className="h-8 text-sm" type="number" placeholder="5000"
                value={newLead.value} onChange={(e) => setNewLead((p) => ({ ...p, value: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs"><Calendar className="h-3 w-3" />Cierre estimado</Label>
              <Input className="h-8 text-sm" type="date"
                value={newLead.expected_close_date} onChange={(e) => setNewLead((p) => ({ ...p, expected_close_date: e.target.value }))} />
            </div>
          </div>
        </div>
      )}

      {hasSomethingToSave && (
        <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Guardar datos
        </Button>
      )}
    </div>
  );
}

// ── Main meeting card ─────────────────────────────────────────────────────────
function MeetingCard({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Smart question answers state
  const questions = meeting.metadata?.questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const q of questions) {
      if (q.answer) initial[q.id] = q.answer;
    }
    return initial;
  });

  const meta = meeting.metadata;
  const meetingType = meta?.meeting_type;
  const hasSmartQuestions = questions.length > 0 && meta?.enrichment_complete !== true;
  const isEnrichmentComplete = meta?.enrichment_complete === true || questions.length === 0;

  const desc = meeting.description ?? "";
  const cleanDesc = desc.replace(/<!--\s*fathom:\S+\s*-->/g, "").trim();
  const lines = cleanDesc.split("\n");

  const answeredCount = Object.values(answers).filter((v) => v.trim()).length;
  const totalQuestions = questions.length;

  async function handleSaveAnswers() {
    const toSend = questions
      .map((q) => ({ id: q.id, field: q.field, value: answers[q.id] ?? "" }))
      .filter((a) => a.value.trim());

    if (!toSend.length) return;

    setSaving(true);
    try {
      await fetch("/app/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: meeting.id,
          answers: toSend,
          markComplete: answeredCount >= totalQuestions,
        }),
      });
      setSaved(true);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function handleSkipAll() {
    setSaving(true);
    try {
      await fetch("/app/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: meeting.id, markComplete: true }),
      });
      setSaved(true);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  const hasUnansweredLegacy = needsAttention(meeting) && !hasSmartQuestions;

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
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(meeting.completed_at)}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {meetingType && (
              <Badge variant="outline" className="border-white/10 text-xs text-muted-foreground">
                {MEETING_TYPE_LABELS[meetingType] ?? meetingType}
              </Badge>
            )}
            {hasSmartQuestions && !saved && (
              <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-300">
                <AlertCircle className="mr-1 h-3 w-3" />
                {answeredCount}/{totalQuestions} respondidas
              </Badge>
            )}
            {(saved || isEnrichmentComplete) && !hasSmartQuestions && (
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Completa
              </Badge>
            )}
            {saved && (
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Guardado
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
          {meeting.contacts ? (
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-background/50 px-3 py-1 text-xs">
              <User className="h-3 w-3 text-muted-foreground" />
              <span>{meeting.contacts.first_name} {meeting.contacts.last_name}</span>
              {meeting.contacts.company_name && (
                <span className="text-muted-foreground">· {meeting.contacts.company_name}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
              <User className="h-3 w-3" />
              Contacto desconocido
            </div>
          )}
          {meeting.leads ? (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              <TrendingUp className="h-3 w-3" />
              Deal detectado
              {meeting.leads.value && <span>· ${meeting.leads.value.toLocaleString()}</span>}
            </div>
          ) : (
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
          {cleanDesc && (
            <div className="space-y-2">
              {lines.map((line, i) => {
                if (!line.trim()) return null;
                if (line.startsWith("**") && line.endsWith("**"))
                  return <p key={i} className="text-sm font-semibold text-foreground">{line.replace(/\*\*/g, "")}</p>;
                if (line.startsWith("• "))
                  return <p key={i} className="ml-3 text-sm text-muted-foreground">{line}</p>;
                const linkMatch = line.match(/\[(.+?)\]\((.+?)\)/);
                if (linkMatch)
                  return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
                    className="block text-sm text-primary underline underline-offset-4">{linkMatch[1]}</a>;
                return <p key={i} className="text-sm text-muted-foreground">{line}</p>;
              })}
            </div>
          )}

          {/* Smart question cards */}
          {hasSmartQuestions && !saved && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <p className="text-sm font-medium text-amber-300">
                  El agente necesita un poco más de info para cargar el CRM
                </p>
              </div>
              <div className="space-y-2.5">
                {questions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    answer={answers[q.id] ?? ""}
                    onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
                  />
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleSaveAnswers}
                  disabled={saving || answeredCount === 0}
                  className="flex-1"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Guardar respuestas y actualizar CRM
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSkipAll}
                  disabled={saving}
                  className="text-muted-foreground"
                >
                  Omitir
                </Button>
              </div>
            </div>
          )}

          {/* Legacy missing data form (for meetings without metadata) */}
          {hasUnansweredLegacy && !saved && (
            <LegacyMissingForm
              meeting={meeting}
              onSaved={() => {
                setSaved(true);
                startTransition(() => router.refresh());
              }}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Inbox container ───────────────────────────────────────────────────────────
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

  const attention = meetings.filter(needsAttention);
  const complete = meetings.filter((m) => !needsAttention(m));

  return (
    <div className="space-y-6">
      {attention.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-medium text-amber-300">
              Necesitan tu atención ({attention.length})
            </h2>
          </div>
          {attention.map((m) => <MeetingCard key={m.id} meeting={m} />)}
        </div>
      )}
      {complete.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-medium text-muted-foreground">
              Completas ({complete.length})
            </h2>
          </div>
          {complete.map((m) => <MeetingCard key={m.id} meeting={m} />)}
        </div>
      )}
    </div>
  );
}
