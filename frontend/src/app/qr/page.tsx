"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { Copy, Check, ExternalLink } from "lucide-react";

const BOT_LINK = "https://t.me/Dilbott_bot";
const GROUP_LINK = "https://t.me/+QVoAdLIwdLpkNDgx";

function QRCard({
  title,
  subtitle,
  link,
  steps,
  accent,
}: {
  title: string;
  subtitle: string;
  link: string;
  steps: string[];
  accent: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-6 w-full max-w-xs">
      <div className="text-center">
        <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-1">
          Telegram
        </p>
        <h2 className="font-heading text-2xl tracking-wide leading-none">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
        <QRCode value={link} size={160} />
      </div>

      <ol className="w-full space-y-1.5 text-xs text-muted-foreground">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono shrink-0" style={{ color: accent }}>0{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="flex w-full gap-2">
        <button
          onClick={copy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium border border-border hover:bg-muted transition-colors"
        >
          {copied ? <Check size={12} className="text-[#1A7A6E]" /> : <Copy size={12} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-white transition-colors"
          style={{ background: "#229ED9" }}
        >
          <ExternalLink size={12} />
          Abrir
        </a>
      </div>
    </div>
  );
}

export default function QRPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-1">
          hackITBA 2026
        </p>
        <h1 className="font-heading text-4xl tracking-wide text-[#D4420A] leading-none">DILBERT.</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Escaneá el QR para conectarte al bot de Telegram
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 items-start justify-center w-full max-w-2xl">
        <QRCard
          title="CONECTAR BOT"
          subtitle="Primer mensaje: /start"
          link={BOT_LINK}
          accent="#D4420A"
          steps={[
            "Escaneá el QR con la cámara",
            "Se abre Telegram — tocá START",
            "El bot te registra como vendedor",
            "Mandá conversaciones y Dilbert extrae los leads",
          ]}
        />
        <QRCard
          title="GRUPO DEMO"
          subtitle="Conversaciones en vivo"
          link={GROUP_LINK}
          accent="#1A7A6E"
          steps={[
            "Escaneá el QR con la cámara",
            "Aceptá unirte al grupo",
            "El bot escucha las conversaciones",
            "Los leads se cargan automáticamente",
          ]}
        />
      </div>

      <a
        href="/login"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
      >
        Ir al dashboard →
      </a>
    </div>
  );
}
