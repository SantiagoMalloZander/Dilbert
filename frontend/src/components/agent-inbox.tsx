"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Clock, SkipForward, User, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
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

// ─── Single question card ─────────────────────────────────────────────────────

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

  const contactName =
    q.contacts
      ? `${q.contacts.first_name ?? ""} ${q.contacts.last_name ?? ""}`.trim() || q.contacts.email || "Desconocido"
      : null;

  function handleAnswer() {
    if (!answer.trim()) return;
    startTransition(() => {
      onAnswered(q.id, "answer", answer.trim());
    });
  }

  function handleSkip() {
    startTransition(() => {
      onAnswered(q.id, "skip");
    });
  }

  const timeAgo = (() => {
    const diff = Date.now() - new Date(q.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${Math.floor(hours / 24)}d`;
  })();

  return (
    <div className={cn(
      "border rounded-xl p-4 space-y-3 transition-opacity",
      q.status === "pending" ? "bg-card border-border" : "bg-muted/30 border-border/40 opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
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
          {timeAgo}
        </span>
      </div>

      {/* Question */}
      <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{q.question}</p>

      {/* Context toggle */}
      {q.context && (
        <div>
          <button
            onClick={() => setShowContext((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            {showContext ? "Ocultar contexto" : "Ver contexto"}
            {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showContext && (
            <div className="mt-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap">
              {q.context}
            </div>
          )}
        </div>
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
            placeholder="Tu respuesta..."
            rows={2}
            className="resize-none text-sm"
            disabled={isPending}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAnswer}
              disabled={!answer.trim() || isPending}
              className="flex-1"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              Responder
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSkip}
              disabled={isPending}
            >
              <SkipForward className="h-3.5 w-3.5 mr-1.5" />
              Saltar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main inbox ───────────────────────────────────────────────────────────────

export function AgentInbox({ initialQuestions }: { initialQuestions: AgentQuestion[] }) {
  const [questions, setQuestions] = useState<AgentQuestion[]>(initialQuestions);
  const [filter, setFilter] = useState<"pending" | "answered" | "skipped" | "all">("pending");

  const pending = questions.filter((q) => q.status === "pending");
  const answered = questions.filter((q) => q.status === "answered");

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
          ? {
              ...q,
              status: action === "answer" ? "answered" : "skipped",
              answer: answer ?? null,
              answered_at: new Date().toISOString(),
            }
          : q
      )
    );
  }

  const filtered =
    filter === "all"
      ? questions
      : questions.filter((q) => q.status === filter);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{pending.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pendientes</p>
        </div>
        <div className="flex-1 rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{answered.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Respondidas</p>
        </div>
        <div className="flex-1 rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{questions.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {(["pending", "answered", "skipped", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              filter === f
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "pending" ? "Pendientes" : f === "answered" ? "Respondidas" : f === "skipped" ? "Saltadas" : "Todas"}
            {f !== "all" && (
              <span className="ml-1 opacity-60">
                ({questions.filter((q) => q.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Questions list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {filter === "pending" ? (
            <div className="space-y-2">
              <CheckCircle className="h-10 w-10 mx-auto opacity-30" />
              <p className="text-sm font-medium">Sin preguntas pendientes</p>
              <p className="text-xs">El agente está procesando tus conversaciones automáticamente.</p>
            </div>
          ) : (
            <p className="text-sm">Sin preguntas en esta categoría.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <QuestionCard key={q.id} q={q} onAnswered={handleAnswered} />
          ))}
        </div>
      )}
    </div>
  );
}
