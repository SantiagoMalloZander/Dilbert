"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CheckCircle2, Clock, Copy, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { emitGlobalToast } from "@/lib/global-toast";
import { markLeadAttended } from "@/modules/seguimiento/actions";
import type { FollowUpData, FollowUpItem } from "@/modules/seguimiento/queries";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

export function FollowUpInbox({ initial }: { initial: FollowUpData }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Se actualiza solo: el agente va cambiando el estado a medida que lee las
  // conversaciones, así que refrescamos los datos del server cada 30s.
  useEffect(() => {
    const id = setInterval(() => startTransition(() => router.refresh()), 30000);
    return () => clearInterval(id);
  }, [router]);

  async function copyReply(item: FollowUpItem) {
    if (!item.suggestedReply) return;
    try {
      await navigator.clipboard.writeText(item.suggestedReply);
      setCopiedId(item.leadId);
      setTimeout(() => setCopiedId((c) => (c === item.leadId ? null : c)), 2000);
    } catch {
      emitGlobalToast({ tone: "error", text: "No pude copiar el mensaje." });
    }
  }

  async function markAttended(item: FollowUpItem) {
    setBusyId(item.leadId);
    try {
      await markLeadAttended(item.leadId);
      startTransition(() => router.refresh());
    } catch {
      emitGlobalToast({ tone: "error", text: "No pude marcar como atendido." });
    } finally {
      setBusyId(null);
    }
  }

  const { counts, items } = initial;

  return (
    <div className="space-y-6">
      {/* Conteos */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="bg-card/90">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[#D4420A]" />
              Desatendidos
            </CardDescription>
            <CardTitle className="text-4xl text-[#D4420A]">{counts.desatendidos}</CardTitle>
            <p className="text-xs text-muted-foreground">Esperan tu respuesta.</p>
          </CardHeader>
        </Card>
        <Card className="bg-card/90">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Atendidos
            </CardDescription>
            <CardTitle className="text-4xl text-emerald-700">{counts.atendidos}</CardTitle>
            <p className="text-xs text-muted-foreground">Al día.</p>
          </CardHeader>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="bg-card/90">
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Todavía no hay conversaciones para seguir. A medida que el agente lea los chats,
              van a aparecer acá.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Sin responder</th>
                    <th className="px-4 py-3 font-medium">Mensaje sugerido</th>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const desatendido = item.status === "desatendido";
                    return (
                      <tr key={item.leadId} className="border-t border-border align-top">
                        <td className="px-4 py-4">
                          <p className="font-medium text-foreground">{item.contactName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.phone ? `+${item.phone}` : item.title}
                            {item.zone ? ` · ${item.zone}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {desatendido ? (
                            <Badge className="border-[#D4420A]/30 bg-[#D4420A]/10 text-[#D4420A]">
                              Desatendido
                            </Badge>
                          ) : (
                            <Badge className="border-emerald-400/40 bg-emerald-500/10 text-emerald-700">
                              Atendido
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {desatendido ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {timeAgo(item.lastClientMessageAt)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <p className="max-w-md text-sm text-foreground/90">
                            {item.suggestedReply || <span className="text-muted-foreground">—</span>}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => copyReply(item)}
                              disabled={!item.suggestedReply}
                            >
                              {copiedId === item.leadId ? (
                                <Check className="mr-2 h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="mr-2 h-4 w-4" />
                              )}
                              {copiedId === item.leadId ? "Copiado" : "Copiar"}
                            </Button>
                            {desatendido ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markAttended(item)}
                                disabled={busyId !== null}
                              >
                                {busyId === item.leadId ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                )}
                                Dar por atendido
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
