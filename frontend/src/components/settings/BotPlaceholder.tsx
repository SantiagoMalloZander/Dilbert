"use client";

import { Bot, GitBranch, MessageSquareText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function BotPlaceholder() {
  return (
    <div className="space-y-6">
      <Card className="bg-card/90">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Bot de WhatsApp</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Acá vas a configurar cómo el bot recibe leads de Meta Ads y los distribuye entre tus
                vendedores según especialidad, zona y disponibilidad.
              </p>
            </div>
          </div>
          <Badge className="border-amber-400/40 bg-amber-500/10 text-amber-700">
            <Sparkles className="mr-1 h-3 w-3" />
            En desarrollo
          </Badge>
        </CardContent>
      </Card>

      <Card className="bg-card/90">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GitBranch className="h-4 w-4 text-primary" />
            Editor visual de flujo
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            La configuración del bot se va a hacer con un editor de diagramas: nodos para preguntas,
            ramas por respuesta del cliente, y un nodo final que asigna el lead al vendedor que
            corresponda según las reglas que armás. Cada inmobiliaria define su propio flujo.
          </p>

          {/* Placeholder diagram */}
          <div className="mt-5 rounded-2xl border-2 border-dashed border-border bg-muted/50 p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-center">
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <MessageSquareText className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-xs font-semibold">Lead entra</p>
                <p className="text-[11px] text-muted-foreground">de Meta Ads → WhatsApp</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <Bot className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-xs font-semibold">Bot triagea</p>
                <p className="text-[11px] text-muted-foreground">qué busca, zona, presupuesto</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <GitBranch className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-xs font-semibold">Routea</p>
                <p className="text-[11px] text-muted-foreground">según reglas de la agencia</p>
              </div>
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-center">
                <Sparkles className="mx-auto h-5 w-5 text-emerald-700" />
                <p className="mt-2 text-xs font-semibold text-emerald-700">Vendedor asignado</p>
                <p className="text-[11px] text-emerald-700/80">recibe el lead</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Lo que vas a poder hacer</p>
              <ul className="mt-2 space-y-1 list-disc pl-4">
                <li>Definir preguntas y respuestas posibles del bot</li>
                <li>Reglas de routing por zona, operación y presupuesto</li>
                <li>Matriz de vendedores por especialidad</li>
                <li>SLA: si nadie contesta en X min, re-asignar</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Mientras tanto</p>
              <p className="mt-2">
                El agente ya captura las conversaciones reales del vendedor (WhatsApp, Gmail, audios)
                y las convierte en contactos, búsquedas y actividades en el CRM. Esto va a sumarse
                arriba — recibir los leads y decidir a quién mandárselos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
