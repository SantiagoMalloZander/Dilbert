// @ts-nocheck
"use client";

import Image from "next/image";
import { useState } from "react";
import QRCode from "react-qr-code";
import { Copy, Check, ExternalLink, QrCode, Users, X } from "lucide-react";

const CHANNELS = [
  {
    name: "WhatsApp Business",
    logo: "/Canales/wpp.png",
    description: "Integración con la API oficial de WhatsApp Business.",
    detail: "Requiere cuenta Meta Business verificada y aprobación de API.",
  },
  {
    name: "Instagram DM",
    logo: "/Canales/ig.webp",
    description: "Mensajes directos de Instagram para seguimiento de leads.",
    detail: "Disponible via Meta Messenger Platform.",
  },
  {
    name: "Messenger",
    logo: "/Canales/massager.png",
    description: "Facebook Messenger para atención y seguimiento de clientes.",
    detail: "Integración pendiente con Meta Graph API.",
  },
  {
    name: "Gmail",
    logo: "/Canales/gmail.webp",
    description: "Seguimiento de conversaciones comerciales por email.",
    detail: "Extracción de leads desde hilos de Gmail con etiquetas definidas.",
  },
];

const BOT_LINK = "https://t.me/Dilbott_bot";
const GROUP_LINK = "https://t.me/+QVoAdLIwdLpkNDgx";

type QRTarget = {
  title: string;
  label: string;
  link: string;
  steps: string[];
};

const QR_BOT: QRTarget = {
  title: "CONECTAR BOT",
  label: "@Dilbott_bot",
  link: BOT_LINK,
  steps: [
    "Escaneá el QR con la cámara del celular",
    "Se abre Telegram — tocá START",
    "El bot te registra como vendedor automáticamente",
    "Mandá conversaciones y Dilbert extrae los leads",
  ],
};

const QR_GROUP: QRTarget = {
  title: "UNIRSE AL GRUPO",
  label: "Grupo demo Dilbert",
  link: GROUP_LINK,
  steps: [
    "Escaneá el QR con la cámara del celular",
    "Se abre Telegram — aceptá unirte al grupo",
    "El bot escucha las conversaciones del grupo",
    "Los leads se extraen y cargan automáticamente",
  ],
};

function QRModal({ target, onClose }: { target: QRTarget; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(target.link);
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
          Telegram
        </p>
        <h2 className="font-heading text-2xl tracking-wide leading-none mb-4">{target.title}</h2>

        <div className="flex justify-center mb-4">
          <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
            <QRCode value={target.link} size={180} />
          </div>
        </div>

        <ol className="space-y-1.5 text-xs text-muted-foreground mb-4">
          {target.steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-[#1A7A6E] shrink-0">0{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <p className="text-[10px] font-mono text-muted-foreground mb-3">{target.label}</p>

        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium border border-border hover:bg-muted transition-colors"
          >
            {copied ? <Check size={12} className="text-[#1A7A6E]" /> : <Copy size={12} />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
          <a
            href={target.link}
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
  const [qrTarget, setQrTarget] = useState<QRTarget | null>(null);

  return (
    <div className="flex flex-col h-full">
      {qrTarget && <QRModal target={qrTarget} onClose={() => setQrTarget(null)} />}

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
        {/* Telegram — activo, dos QRs */}
        <div className="rounded-lg border border-[#1A7A6E]/30 bg-card p-4 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                <Image src="/Canales/Telegram.png" alt="Telegram" width={32} height={32} className="object-contain" />
              </div>
              <div>
                <p className="text-sm font-medium leading-tight">Telegram</p>
                <p className="text-[10px] font-mono text-muted-foreground/60">
                  Lee mensajes, extrae datos con GPT-4o y actualiza el CRM en tiempo real.
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#1A7A6E] uppercase tracking-wide shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A6E] animate-pulse" />
              Activo
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setQrTarget(QR_BOT)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-xs font-medium bg-[#D4420A] hover:bg-[#B83509] text-[#F5F0E8] transition-colors"
            >
              <QrCode size={13} />
              QR — Conectar bot
            </button>
            <button
              onClick={() => setQrTarget(QR_GROUP)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-xs font-medium border border-[#1A7A6E]/40 text-[#1A7A6E] hover:bg-[#1A7A6E]/8 transition-colors"
            >
              <Users size={13} />
              QR — Unirse al grupo demo
            </button>
          </div>
        </div>

        {/* Otros canales */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map((channel) => (
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
