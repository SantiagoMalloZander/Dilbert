"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, Building2 } from "lucide-react";

const PLACEHOLDER = `Completá este texto para que el agente entienda tu negocio y sepa qué emails importan y cuáles ignorar.

--- QUÉ HACE LA EMPRESA ---
Ejemplo: "Vendemos muebles de diseño (mesas, sillas, estantes) al por mayor y minorista. Operamos en Argentina. Nuestros precios van de $50.000 a $500.000 ARS."

--- PRODUCTOS Y SERVICIOS PRINCIPALES ---
Ejemplo:
- Mesa ratona roble: $120.000 ARS
- Silla Shanshan (varios colores): $45.000 ARS
- Estante modular: $80.000 ARS

--- PERFIL DEL CLIENTE IDEAL ---
Ejemplo: "Nuestros clientes son principalmente decoradores de interiores, inmobiliarias y particulares que renuevan su hogar. También vendemos a negocios de gastronomía (restaurantes, cafeterías)."

--- EMAILS A IGNORAR SIEMPRE ---
Ejemplo:
- Cualquier email de newsletters o promociones
- Emails de proveedores (maderas, herrajes, logística)
- Emails de servicios internos (facturación, AFIP, bancos)
- Emails del equipo (@miempresa.com.ar)
- Confirmaciones automáticas de envío o pago

--- SEÑALES QUE INDICAN INTENCIÓN DE COMPRA ---
Ejemplo: "El cliente pregunta por precio, disponibilidad, colores, tiempos de entrega, o quiere comprar varias unidades. Frases como 'cuánto sale', 'tenés stock', 'quiero pedir' son señales claras."

--- REGLAS ESPECIALES PARA EL AGENTE ---
Ejemplo:
- Si alguien pregunta por más de 3 unidades del mismo producto, es una venta mayorista y tiene más prioridad
- Los clientes que mencionan un proyecto de decoración suelen cerrar más rápido
- No crear contacto si el email es una consulta genérica sin datos de contacto`;

interface Props {
  initialContext: string;
}

export function AgentCompanyContext({ initialContext }: Props) {
  const [context, setContext] = useState(initialContext);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/app/api/agent/company-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="bg-card/90">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Contexto del negocio</CardTitle>
        </div>
        <CardDescription>
          Explicale al agente qué hace tu empresa, qué emails son relevantes y cuáles ignorar.
          Cuanto más detallado, mejor va a filtrar y clasificar las interacciones automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={PLACEHOLDER}
          className="min-h-[420px] font-mono text-sm resize-y"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Este texto se inyecta en cada análisis de email, WhatsApp y reunión.
          </p>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Guardado
              </span>
            )}
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
