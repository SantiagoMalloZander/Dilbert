import Image from "next/image";

const CHANNELS = [
  {
    name: "Telegram",
    logo: "/Canales/Telegram.png",
    description: "Bot activo en grupos de Telegram entre vendedores y clientes.",
    active: true,
    detail: "Lee mensajes, extrae datos con GPT-4o y actualiza el CRM en tiempo real.",
  },
  {
    name: "WhatsApp Business",
    logo: "/Canales/wpp.png",
    description: "Integración con la API oficial de WhatsApp Business.",
    active: false,
    detail: "Requiere cuenta Meta Business verificada y aprobación de API.",
  },
  {
    name: "Instagram DM",
    logo: "/Canales/ig.webp",
    description: "Mensajes directos de Instagram para seguimiento de leads.",
    active: false,
    detail: "Disponible via Meta Messenger Platform.",
  },
  {
    name: "Messenger",
    logo: "/Canales/massager.png",
    description: "Facebook Messenger para atención y seguimiento de clientes.",
    active: false,
    detail: "Integración pendiente con Meta Graph API.",
  },
  {
    name: "Gmail",
    logo: "/Canales/gmail.webp",
    description: "Seguimiento de conversaciones comerciales por email.",
    active: false,
    detail: "Extracción de leads desde hilos de Gmail con etiquetas definidas.",
  },
];

export default function ConfiguracionPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b bg-card/60">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Configuración
        </p>
        <h1 className="font-heading text-4xl tracking-wide mt-1 leading-none">CANALES</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
          Elegí desde qué plataformas Dilbert lee conversaciones y extrae datos de ventas.
        </p>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map((channel) => (
            <div
              key={channel.name}
              className={`rounded-lg border bg-card p-4 flex flex-col gap-3 transition-opacity ${
                channel.active ? "border-[#1A7A6E]/30" : "opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    <Image
                      src={channel.logo}
                      alt={channel.name}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </div>
                  <p className="text-sm font-medium leading-tight">{channel.name}</p>
                </div>
                {channel.active ? (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-[#1A7A6E] uppercase tracking-wide shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A6E] animate-pulse" />
                    Activo
                  </span>
                ) : (
                  <span className="text-[9px] font-mono border border-border rounded px-1.5 py-0.5 text-muted-foreground uppercase tracking-wider shrink-0">
                    Pronto
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{channel.description}</p>
              <p className="text-[10px] font-mono text-muted-foreground/60">{channel.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-dashed p-4">
          <p className="text-xs text-muted-foreground text-center">
            ¿Necesitás integrar otra plataforma?{" "}
            <span className="text-foreground font-medium">
              El bot es extensible — cada canal es un módulo independiente.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
