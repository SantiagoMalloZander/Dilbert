"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle, Clock, SkipForward, User, MessageSquare,
  ChevronDown, ChevronUp, Bot, Activity, Mail, Phone, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactSnap {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
}

interface AgentQuestion {
  id: string;
  question: string;
  context: string | null;
  status: "pending" | "answered" | "skipped";
  answer: string | null;
  created_at: string;
  answered_at: string | null;
  contact_id: string | null;
  contacts: ContactSnap | null;
}

interface AgentActivity {
  id: string;
  type: "email" | "whatsapp" | "meeting" | "note" | "task" | string;
  title: string;
  description: string | null;
  completed_at: string | null;
  created_at: string;
  contact_id: string | null;
  lead_id: string | null;
  contacts: { id: string; first_name: string | null; last_name: string | null; company_name: string | null } | null;
  leads: { id: string; title: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

function isIdentityQuestion(context: string | null): boolean {
  if (!context) return false;
  try { return (JSON.parse(context) as { type?: string }).type === "identity_unknown"; }
  catch { return false; }
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  q,
  onAnswered,
}: {
  q: AgentQuestion;
  onAnswered: (id: string, action: "answer" | "skip", answer?: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [isPending, startTransition] = useTransition();

  const contactName = q.contacts
    ? `${q.contacts.first_name ?? ""} ${q.contacts.last_name ?? ""}`.trim() || q.contacts.email || "Desconocido"
    : null;

  const isIdentity = isIdentityQuestion(q.context);

  // For identity questions, try to parse the raw context snippet
  let contextSnippet: string | null = null;
  if (q.context) {
    try {
      const meta = JSON.parse(q.context) as { rawText?: string; channelIdentifier?: string };
      contextSnippet = meta.rawText ?? null;
    } catch {
      contextSnippet = q.context;
    }
  }

  function handleAnswer() {
    if (!answer.trim()) return;
    startTransition(() => { onAnswered(q.id, "answer", answer.trim()); });
  }

  function handleSkip() {
    startTransition(() => { onAnswered(q.id, "skip"); });
  }

  return (
    <div className={cn(
      "border rounded-xl p-4 space-y-3 transition-opacity",
      q.status === "pending" ? "bg-card border-border" : "bg-muted/30 border-border/40 opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isIdentity && (
            <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
              Identidad desconocida
            </Badge>
          )}
          {contactName && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              <User className="h-3 w-3" />
              {contactName}
            </Badge>
          )}
          {q.contacts?.company_name && (
            <span className="text-xs text-muted-foreground">{q.contacts.company_name}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(q.created_at)}
        </span>
      </div>

      {/* Question */}
      <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{q.question}</p>

      {/* Context toggle */}
      {contextSnippet && (
        <div>
          <button
            onClick={() => setShowContext((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            {showContext ? "Ocultar contexto" : "Ver mensaje original"}
            {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showContext && (
            <div className="mt-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
              {contextSnippet.slice(0, 400)}
            </div>
          )}
        </div>
      )}

      {/* Hint for identity questions */}
      {isIdentity && q.status === "pending" && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          Escribí el nombre o email del contacto que corresponde. El agente va a linkear la identidad y completar la carga automáticamente.
        </p>
      )}

      {/* Already answered */}
      {q.status === "answered" && q.answer && (
        <div className="flex items-start gap-2 p-2 bg-green-500/10 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
          <p className="text-xs text-green-700 dark:text-green-400">{q.answer}</p>
        </div>
      )}
      {q.status === "skipped" && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
          <SkipForward className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Saltada</p>
        </div>
      )}

      {/* Answer form */}
      {q.status === "pending" && (
        <div className="space-y-2">
          <Textarea
            value={answer}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswer(e.target.value)}
            placeholder={isIdentity ? "Ej: Juan Pérez, o juan@empresa.com" : "Tu respuesta..."}
            rows={2}
            className="resize-none text-sm"
            disabled={isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAnswer();
            }}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAnswer} disabled={!answer.trim() || isPending} className="flex-1">
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              {isIdentity ? "Identificar y relanzar" : "Responder"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSkip} disabled={isPending}>
              <SkipForward className="h-3.5 w-3.5 mr-1.5" />
              Saltar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Activity log item ────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  whatsapp: Phone,
  meeting: Video,
};

const TYPE_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  meeting: "Reunión",
  note: "Nota",
  task: "Tarea",
};

function ActivityItem({ a }: { a: AgentActivity }) {
  const Icon = TYPE_ICONS[a.type] ?? Activity;
  const contactName = a.contacts
    ? `${a.contacts.first_name ?? ""} ${a.contacts.last_name ?? ""}`.trim() || "Contacto"
    : null;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="rounded-full bg-muted p-1.5 shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{a.title}</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {TYPE_LABELS[a.type] ?? a.type}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {contactName && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {contactName}
              {a.contacts?.company_name && ` · ${a.contacts.company_name}`}
            </span>
          )}
          {a.leads && (
            <span className="text-xs text-muted-foreground">
              · Deal: {a.leads.title}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(a.created_at)}</span>
    </div>
  );
}

// ─── Main inbox ───────────────────────────────────────────────────────────────

type Tab = "pending" | "answered" | "activity";

export function AgentInbox({
  initialQuestions,
  initialActivities,
}: {
  initialQuestions: AgentQuestion[];
  initialActivities: AgentActivity[];
}) {
  const [questions, setQuestions] = useState<AgentQuestion[]>(initialQuestions);
  const [tab, setTab] = useState<Tab>("pending");

  const pending = questions.filter((q) => q.status === "pending");
  const answered = questions.filter((q) => q.status !== "pending");

  async function handleAnswered(id: string, action: "answer" | "skip", answer?: string) {
    const res = await fetch("/app/api/agent/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: id, action, answer }),
    });
    if (!res.ok) return;

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, status: action === "answer" ? "answered" : "skipped", answer: answer ?? null, answered_at: new Date().toISOString() }
          : q
      )
    );

    // Auto-switch to activity tab after answering last pending question
    if (pending.length === 1 && action !== "skip") {
      setTimeout(() => setTab("activity"), 600);
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "pending", label: "Pendientes", count: pending.length },
    { id: "answered", label: "Respondidas", count: answered.length },
    { id: "activity", label: "Actividad reciente", count: initialActivities.length },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{pending.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pendientes</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{answered.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Respondidas</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{initialActivities.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Acciones del agente</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5",
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                tab === t.id ? "bg-muted text-muted-foreground" : "bg-muted/50"
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "pending" && (
        pending.length === 0 ? (
          <div className="text-center py-12 space-y-2 text-muted-foreground">
            <Bot className="h-10 w-10 mx-auto opacity-25" />
            <p className="text-sm font-medium">El agente está al día</p>
            <p className="text-xs">No hay preguntas pendientes. Todo fue cargado automáticamente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((q) => (
              <QuestionCard key={q.id} q={q} onAnswered={handleAnswered} />
            ))}
          </div>
        )
      )}

      {tab === "answered" && (
        answered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Todavía no respondiste ninguna pregunta.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {answered.map((q) => (
              <QuestionCard key={q.id} q={q} onAnswered={handleAnswered} />
            ))}
          </div>
        )
      )}

      {tab === "activity" && (
        initialActivities.length === 0 ? (
          <div className="text-center py-12 space-y-2 text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto opacity-25" />
            <p className="text-sm font-medium">Sin actividad registrada aún</p>
            <p className="text-xs">El agente va a listar acá todo lo que cargue automáticamente.</p>
          </div>
        ) : (
          <div className="border rounded-xl bg-card divide-y divide-border/50 px-4">
            {initialActivities.map((a) => (
              <ActivityItem key={a.id} a={a} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
