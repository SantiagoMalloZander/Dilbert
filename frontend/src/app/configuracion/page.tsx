import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CHANNELS = [
  {
    name: "Telegram",
    icon: "✈️",
    description: "Bot activo en grupos de Telegram entre vendedores y clientes.",
    active: true,
    detail: "Lee mensajes, extrae datos con GPT-4o y actualiza el CRM en tiempo real.",
  },
  {
    name: "WhatsApp Business",
    icon: "💬",
    description: "Integración con la API oficial de WhatsApp Business.",
    active: false,
    detail: "Requiere cuenta Meta Business verificada y aprobación de API.",
  },
  {
    name: "Instagram DM",
    icon: "📸",
    description: "Mensajes directos de Instagram para seguimiento de leads.",
    active: false,
    detail: "Disponible via Meta Messenger Platform.",
  },
  {
    name: "Messenger",
    icon: "💙",
    description: "Facebook Messenger para atención y seguimiento de clientes.",
    active: false,
    detail: "Integración pendiente con Meta Graph API.",
  },
  {
    name: "Slack",
    icon: "⚡",
    description: "Canales internos de Slack para comunicación B2B.",
    active: false,
    detail: "Para equipos de ventas enterprise con clientes en Slack Connect.",
  },
];

export default function ConfiguracionPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Configuración
        </p>
        <h2 className="text-3xl font-semibold tracking-tight">Canales del bot</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Elegí desde qué plataformas Dilbert va a leer conversaciones y extraer datos de ventas.
          Solo los canales habilitados alimentan el CRM.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CHANNELS.map((channel) => (
          <Card
            key={channel.name}
            className={`relative transition-all ${
              channel.active
                ? "border-green-200 bg-green-50/30 dark:border-green-900 dark:bg-green-950/20"
                : "opacity-70"
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{channel.icon}</span>
                  <CardTitle className="text-base">{channel.name}</CardTitle>
                </div>
                {channel.active ? (
                  <Badge className="bg-green-500 hover:bg-green-500 text-white text-xs shrink-0">
                    Activo
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">
                    Próximamente
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{channel.description}</p>
              <p className="text-xs text-muted-foreground/70">{channel.detail}</p>
              {channel.active && (
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-600 font-medium">
                    Conectado y escuchando
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground text-center">
            ¿Necesitás integrar otra plataforma?{" "}
            <span className="text-foreground font-medium">
              El bot es extensible — cada canal es un módulo independiente.
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
