"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Copy, Check, ExternalLink } from "lucide-react";

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

type BotInfo = { username: string; name: string; link: string };

function TelegramConnectPanel() {
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/telegram/bot-info")
      .then((r) => r.json())
      .then((d) => {
        if (d.link) setBot(d);
        else setError(true);
      })
      .catch(() => setError(true));
  }, []);

  function copyLink() {
    if (!bot) return;
    navigator.clipboard.writeText(bot.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) {
    return (
      <p className="text-xs text-muted-foreground font-mono">
        Configurá <code className="text-foreground">TELEGRAM_BOT_TOKEN</code> en el servidor para activar el QR.
      </p>
    );
  }

  if (!bot) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-start">
      {/* QR */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-border">
          <QRCode value={bot.link} size={140} />
        </div>
        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.15em]">
          Escanear con el celular
        </p>
      </div>

      {/* Instructions */}
      <div className="flex flex-col gap-3 min-w-0">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Bot activo
          </p>
          <p className="text-sm font-semibold">@{bot.username}</p>
        </div>

        <ol className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex gap-2">
            <span className="font-mono text-[#1A7A6E] shrink-0">01</span>
            Abrí la cámara del celular y escaneá el QR
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-[#1A7A6E] shrink-0">02</span>
            Se abre Telegram — tocá <strong className="text-foreground">START</strong>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-[#1A7A6E] shrink-0">03</span>
            El bot registra tu cuenta y ya podés mandarle conversaciones
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-[#1A7A6E] shrink-0">04</span>
            Dilbert empieza a extraer datos automáticamente
          </li>
        </ol>

        <div className="flex flex-wrap items-center gap-2 mt-1">
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border border-border hover:bg-muted transition-colors"
          >
            {copied ? <Check size={12} className="text-[#1A7A6E]" /> : <Copy size={12} />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
          <a
            href={bot.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-[#229ED9] hover:bg-[#1a8fc2] text-white transition-colors"
          >
            <ExternalLink size={12} />
            Abrir en Telegram
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 py-4 md:py-5 border-b bg-card/60">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Configuración
        </p>
        <h1 className="font-heading text-3xl md:text-4xl tracking-wide mt-1 leading-none">CANALES</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
          Elegí desde qué plataformas Dilbert lee conversaciones y extrae datos de ventas.
        </p>
      </div>

      <div className="p-4 md:p-6 space-y-4 md:space-y-5">
        {/* Telegram connect panel — always visible at top */}
        <div className="rounded-lg border border-[#1A7A6E]/30 bg-card p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                <Image src="/Canales/Telegram.png" alt="Telegram" width={32} height={32} className="object-contain" />
              </div>
              <div>
                <p className="text-sm font-medium leading-tight">Telegram</p>
                <p className="text-[10px] font-mono text-muted-foreground">Canal activo</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#1A7A6E] uppercase tracking-wide shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A6E] animate-pulse" />
              Activo
            </span>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
              Conectar vendedor via QR
            </p>
            <TelegramConnectPanel />
          </div>
        </div>

        {/* Other channels */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.filter((c) => !c.active).map((channel) => (
            <div
              key={channel.name}
              className="rounded-lg border bg-card p-4 flex flex-col gap-3 opacity-60"
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
                <span className="text-[9px] font-mono border border-border rounded px-1.5 py-0.5 text-muted-foreground uppercase tracking-wider shrink-0">
                  Pronto
                </span>
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
