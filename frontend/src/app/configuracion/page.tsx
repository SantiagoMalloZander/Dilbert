"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Copy, Check, ExternalLink, QrCode, X } from "lucide-react";

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

function QRModal({ bot, onClose }: { bot: BotInfo; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(bot.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>

        <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-1">
          Conectar vendedor
        </p>
        <h2 className="font-heading text-2xl tracking-wide leading-none mb-4">ESCANEAR QR</h2>

        <div className="flex justify-center mb-4">
          <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
            <QRCode value={bot.link} size={180} />
          </div>
        </div>

        <ol className="space-y-1.5 text-xs text-muted-foreground mb-4">
          <li className="flex gap-2">
            <span className="font-mono text-[#1A7A6E] shrink-0">01</span>
            Abrí la cámara y escaneá el QR
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-[#1A7A6E] shrink-0">02</span>
            Se abre Telegram — tocá <strong className="text-foreground">START</strong>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-[#1A7A6E] shrink-0">03</span>
            El bot te registra y ya podés mandarle conversaciones
          </li>
        </ol>

        <p className="text-[10px] font-mono text-muted-foreground mb-3">@{bot.username}</p>

        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium border border-border hover:bg-muted transition-colors"
          >
            {copied ? <Check size={12} className="text-[#1A7A6E]" /> : <Copy size={12} />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
          <a
            href={bot.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium bg-[#229ED9] hover:bg-[#1a8fc2] text-white transition-colors"
          >
            <ExternalLink size={12} />
            Abrir Telegram
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    fetch("/api/telegram/bot-info")
      .then((r) => r.json())
      .then((d) => { if (d.link) setBot(d); })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full">
      {qrOpen && bot && <QRModal bot={bot} onClose={() => setQrOpen(false)} />}

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Telegram — activo */}
          <div className="rounded-lg border border-[#1A7A6E]/30 bg-card p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                  <Image src="/Canales/Telegram.png" alt="Telegram" width={32} height={32} className="object-contain" />
                </div>
                <p className="text-sm font-medium leading-tight">Telegram</p>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-mono text-[#1A7A6E] uppercase tracking-wide shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A6E] animate-pulse" />
                Activo
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bot activo en grupos de Telegram entre vendedores y clientes.
            </p>
            <p className="text-[10px] font-mono text-muted-foreground/60">
              Lee mensajes, extrae datos con GPT-4o y actualiza el CRM en tiempo real.
            </p>
            <button
              onClick={() => setQrOpen(true)}
              disabled={!bot}
              className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium bg-[#D4420A] hover:bg-[#B83509] text-[#F5F0E8] transition-colors disabled:opacity-40"
            >
              <QrCode size={13} />
              Abrir QR
            </button>
          </div>

          {/* Otros canales */}
          {CHANNELS.filter((c) => !c.active).map((channel) => (
            <div
              key={channel.name}
              className="rounded-lg border bg-card p-4 flex flex-col gap-3 opacity-60"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    <Image src={channel.logo} alt={channel.name} width={32} height={32} className="object-contain" />
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
