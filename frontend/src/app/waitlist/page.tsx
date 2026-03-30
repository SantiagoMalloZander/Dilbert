"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const BRAND = {
  cream: "#F5F0E8",
  orange: "#D4420A",
  teal: "#1A7A6E",
  dark: "#1A1A1A",
  muted: "rgba(245,240,232,0.45)",
  border: "rgba(245,240,232,0.1)",
};

/* ── tiny particle burst on success ─────────────────────── */
function Burst() {
  const colors = [BRAND.orange, BRAND.teal, "#F5D53F", BRAND.cream];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 18 }).map((_, i) => {
        const angle = (i / 18) * 360;
        const dist = 60 + Math.random() * 60;
        const size = 4 + Math.random() * 6;
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              transform: `rotate(${angle}deg) translateX(${dist}px)`,
              opacity: 0,
              animation: `burst 0.6s ease-out ${i * 20}ms forwards`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes burst {
          0%   { opacity:1; transform: rotate(var(--a,0deg)) translateX(0px) scale(1); }
          100% { opacity:0; transform: rotate(var(--a,0deg)) translateX(var(--d,80px)) scale(0.3); }
        }
      `}</style>
    </div>
  );
}

/* ── animated counter ────────────────────────────────────── */
function Counter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 25);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString("es-AR")}</>;
}

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [count, setCount] = useState(0);
  const [showBurst, setShowBurst] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/waitlist")
      .then((r) => r.json())
      .then((d) => setCount((d.count ?? 0) + 83)) // + seed para que no se vea 0
      .catch(() => setCount(83));
    inputRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("done");
        setCount((c) => c + 1);
        setShowBurst(true);
        setTimeout(() => setShowBurst(false), 800);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BRAND.dark,
        color: BRAND.cream,
        fontFamily: "'DM Sans', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* animated blobs */}
      <div style={{
        position: "absolute", width: 600, height: 600,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(212,66,10,0.12) 0%, transparent 70%)`,
        top: "-200px", right: "-200px",
        animation: "float1 8s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: 500, height: 500,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(26,122,110,0.1) 0%, transparent 70%)`,
        bottom: "-150px", left: "-150px",
        animation: "float2 10s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      <style>{`
        @keyframes float1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-30px,30px)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-20px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        ::placeholder { color: rgba(245,240,232,0.3); }
      `}</style>

      {/* logo */}
      <Link href="/" style={{ textDecoration: "none", marginBottom: 48, animation: "fadeUp 0.5s ease both" }}>
        <span style={{
          fontFamily: "'Anton', sans-serif",
          fontSize: 22, letterSpacing: "0.06em",
          color: BRAND.orange,
        }}>DILBERT.</span>
      </Link>

      {/* tag */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10, letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: BRAND.teal,
        marginBottom: 16,
        animation: "fadeUp 0.5s ease 0.1s both",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND.teal, display: "inline-block", animation: "pulse 2s infinite" }} />
        ACCESO ANTICIPADO
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </div>

      {/* heading */}
      <h1 style={{
        fontFamily: "'Anton', sans-serif",
        fontSize: "clamp(48px, 10vw, 96px)",
        letterSpacing: "0.02em",
        lineHeight: 0.95,
        textAlign: "center",
        marginBottom: 24,
        animation: "fadeUp 0.5s ease 0.15s both",
      }}>
        TU CRM SE<br />
        <span style={{ color: BRAND.orange }}>LLENA SOLO.</span>
      </h1>

      {/* sub */}
      <p style={{
        fontSize: "clamp(14px, 2vw, 17px)",
        color: BRAND.muted,
        textAlign: "center",
        maxWidth: 500,
        lineHeight: 1.65,
        marginBottom: 40,
        animation: "fadeUp 0.5s ease 0.2s both",
      }}>
        Dilbert lee las conversaciones de tu equipo en Telegram y extrae leads, montos y próximos pasos automáticamente. Sin planillas. Sin fricción.
      </p>

      {/* form / success */}
      <div style={{
        width: "100%", maxWidth: 480,
        animation: "fadeUp 0.5s ease 0.25s both",
        position: "relative",
      }}>
        {status === "done" ? (
          <div style={{
            position: "relative",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 12, textAlign: "center",
            padding: "32px 24px",
            background: "rgba(26,122,110,0.08)",
            border: `1.5px solid ${BRAND.teal}`,
            borderRadius: 16,
          }}>
            {showBurst && <Burst />}
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(26,122,110,0.15)",
              border: `2px solid ${BRAND.teal}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>✓</div>
            <p style={{ fontFamily: "'Anton', sans-serif", fontSize: 24, letterSpacing: "0.03em", color: BRAND.teal }}>
              ESTÁS ADENTRO.
            </p>
            <p style={{ fontSize: 14, color: BRAND.muted, lineHeight: 1.6 }}>
              Te avisamos cuando lanzamos. Mientras tanto, podés ver el MVP en vivo.
            </p>
            <Link
              href="/login"
              style={{
                marginTop: 8,
                padding: "10px 24px",
                background: BRAND.orange,
                color: BRAND.cream,
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textDecoration: "none",
              }}
            >
              VER EL MVP →
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              display: "flex",
              gap: 8,
              background: "rgba(245,240,232,0.05)",
              border: `1.5px solid ${BRAND.border}`,
              borderRadius: 12,
              padding: 6,
              transition: "border-color 0.2s",
            }}
              onFocus={(e) => (e.currentTarget.style.borderColor = BRAND.orange)}
              onBlur={(e) => (e.currentTarget.style.borderColor = BRAND.border)}
            >
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: BRAND.cream,
                  fontSize: 15,
                  padding: "10px 14px",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                style={{
                  background: status === "loading" ? "rgba(212,66,10,0.6)" : BRAND.orange,
                  color: BRAND.cream,
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 22px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: "0.03em",
                  cursor: status === "loading" ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.15s, transform 0.15s",
                }}
                onMouseEnter={(e) => { if (status !== "loading") (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.03)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              >
                {status === "loading" ? "..." : "ENTRAR A LA LISTA →"}
              </button>
            </div>
            {status === "error" && (
              <p style={{ fontSize: 12, color: "#ef4444", textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>
                Algo salió mal. Intentá de nuevo.
              </p>
            )}
            <p style={{ fontSize: 11, color: "rgba(245,240,232,0.25)", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
              SIN SPAM · SIN TARJETA · SIN FRICCIÓN
            </p>
          </form>
        )}
      </div>

      {/* counter */}
      <div style={{
        marginTop: 36,
        display: "flex", alignItems: "center", gap: 10,
        animation: "fadeUp 0.5s ease 0.35s both",
      }}>
        <div style={{ display: "flex" }}>
          {[BRAND.orange, BRAND.teal, "#F5D53F", BRAND.cream, BRAND.orange].map((c, i) => (
            <div key={i} style={{
              width: 26, height: 26, borderRadius: "50%",
              background: c,
              border: `2px solid ${BRAND.dark}`,
              marginLeft: i === 0 ? 0 : -8,
              opacity: 0.85,
            }} />
          ))}
        </div>
        <p style={{ fontSize: 13, color: BRAND.muted }}>
          <span style={{ color: BRAND.cream, fontWeight: 700 }}>
            <Counter value={count} />
          </span>{" "}
          equipos de ventas en lista de espera
        </p>
      </div>

      {/* features row */}
      <div style={{
        marginTop: 56,
        display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10,
        animation: "fadeUp 0.5s ease 0.4s both",
      }}>
        {[
          ["⚡", "Extracción IA en tiempo real"],
          ["🔗", "Sync automático a HubSpot"],
          ["📊", "Dashboard comercial live"],
          ["🤖", "Bot de Telegram listo"],
        ].map(([icon, label]) => (
          <div key={label} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px",
            border: `1px solid ${BRAND.border}`,
            borderRadius: 100,
            fontSize: 12,
            color: BRAND.muted,
          }}>
            <span>{icon}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* footer link */}
      <div style={{ marginTop: 48, display: "flex", gap: 20, animation: "fadeUp 0.5s ease 0.45s both" }}>
        <Link href="/login" style={{ fontSize: 12, color: "rgba(245,240,232,0.3)", textDecoration: "none", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
          VER MVP →
        </Link>
        <Link href="/" style={{ fontSize: 12, color: "rgba(245,240,232,0.3)", textDecoration: "none", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
          VOLVER AL INICIO
        </Link>
      </div>
    </div>
  );
}
