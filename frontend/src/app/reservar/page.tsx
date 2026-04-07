"use client";
import { useState } from "react";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_ES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function argToday() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

export default function ReservarPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", teamSize: "" });
  const [formError, setFormError] = useState("");
  const [calYear, setCalYear] = useState(() => new Date(Date.now() - 3 * 3600_000).getUTCFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date(Date.now() - 3 * 3600_000).getUTCMonth());
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsLabel, setSlotsLabel] = useState("");
  const [slotError, setSlotError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ date: string; time: string } | null>(null);

  // ── Step 1 ──────────────────────────────────────────────────────────────
  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.company || !form.email || !form.teamSize) {
      setFormError("Completá todos los campos obligatorios."); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError("Email inválido."); return;
    }
    setFormError("");
    setStep(2);
  }

  // ── Calendar ─────────────────────────────────────────────────────────────
  function calNav(dir: number) {
    let m = calMonth + dir, y = calYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setCalMonth(m); setCalYear(y);
  }

  async function selectDate(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedTime("");
    setSlotError("");
    setSlotsLoading(true);
    setSlotsLabel("Cargando horarios...");
    setSlots([]);
    try {
      const res = await fetch(`/api/availability?date=${dateStr}`);
      const data = await res.json();
      const [y, m, d] = dateStr.split("-").map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      setSlotsLabel(`${DAYS_ES[dow]} ${d} de ${MONTHS_ES[m - 1]} · Buenos Aires`);
      setSlots(data.slots ?? []);
    } catch {
      setSlotsLabel("");
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  function renderCal() {
    const today = argToday();
    const firstDow = new Date(calYear, calMonth, 1).getDay();
    const mondayFirst = (firstDow + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < mondayFirst; i++) {
      cells.push(<div key={`e${i}`} />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isPast = ds < today;
      const isSel = ds === selectedDate;
      const isToday = ds === today;

      cells.push(
        <button
          key={ds}
          type="button"
          onClick={() => !isPast && selectDate(ds)}
          disabled={isPast}
          style={{
            aspectRatio: "1",
            borderRadius: 8,
            border: isSel ? "2px solid #D4420A" : isToday ? "1.5px solid rgba(212,66,10,0.5)" : "1px solid transparent",
            background: isSel ? "#D4420A" : "transparent",
            color: isPast ? "rgba(245,240,232,0.15)" : isSel ? "#F5F0E8" : isToday ? "#D4420A" : "rgba(245,240,232,0.75)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: isSel || isToday ? 700 : 500,
            cursor: isPast ? "default" : "pointer",
            transition: "background 0.12s, border-color 0.12s",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {day}
        </button>
      );
    }
    return cells;
  }

  // ── Step 3 ──────────────────────────────────────────────────────────────
  async function confirm() {
    if (!selectedDate || !selectedTime) {
      setSlotError("Seleccioná un día y un horario."); return;
    }
    setConfirming(true);
    setSlotError("");
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, company: form.company,
          email: form.email, phone: form.phone,
          team_size: form.teamSize, date: selectedDate, time: selectedTime,
        }),
      });
      const text = await res.text();
      let data: { ok?: boolean; error?: string; date?: string; time?: string };
      try { data = JSON.parse(text); } catch { throw new Error("Respuesta inválida del servidor"); }
      if (!res.ok) throw new Error(data.error || "Error al agendar");
      setConfirmResult({ date: data.date!, time: data.time! });
      setStep(3);
    } catch (err: unknown) {
      setSlotError(err instanceof Error ? err.message : "Error al agendar. Intentá de nuevo.");
    } finally {
      setConfirming(false);
    }
  }

  const todayStr = argToday();
  const [minY, minM] = todayStr.slice(0, 7).split("-").map(Number);
  const canPrevMonth = !(calYear === minY && calMonth <= minM - 1);

  const S: Record<string, React.CSSProperties> = {
    page:    { minHeight: "100vh", background: "#1A1A1A", color: "#F5F0E8", fontFamily: "'DM Sans', sans-serif", padding: "0 0 80px" },
    nav:     { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid rgba(245,240,232,0.07)" },
    logo:    { fontFamily: "Anton, sans-serif", fontSize: 22, color: "#D4420A", letterSpacing: "0.04em", textDecoration: "none" },
    back:    { fontSize: 13, color: "rgba(245,240,232,0.4)", textDecoration: "none", fontWeight: 500 },
    wrap:    { maxWidth: 560, margin: "0 auto", padding: "48px 24px 0" },
    tag:     { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#D4420A", marginBottom: 10 },
    title:   { fontFamily: "Anton, sans-serif", fontSize: "clamp(28px,5vw,44px)", lineHeight: 1.05, color: "#F5F0E8", marginBottom: 8 },
    sub:     { fontSize: 14, color: "rgba(245,240,232,0.4)", marginBottom: 28, lineHeight: 1.6 },
    label:   { fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "rgba(245,240,232,0.4)", marginBottom: 6, display: "block" },
    input:   { background: "rgba(245,240,232,0.05)", border: "1.5px solid rgba(245,240,232,0.12)", borderRadius: 10, padding: "11px 14px", color: "#F5F0E8", fontFamily: "'DM Sans', sans-serif", fontSize: 14, width: "100%", boxSizing: "border-box" as const },
    row:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    btnOr:   { background: "#D4420A", color: "#F5F0E8", border: "none", borderRadius: 100, padding: "12px 28px", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" },
    btnGh:   { background: "transparent", color: "rgba(245,240,232,0.55)", border: "1.5px solid rgba(245,240,232,0.15)", borderRadius: 100, padding: "12px 24px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" },
    calWrap: { background: "rgba(245,240,232,0.03)", border: "1px solid rgba(245,240,232,0.08)", borderRadius: 16, padding: 20, marginBottom: 16 },
    calHdr:  { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    calMon:  { fontFamily: "Anton, sans-serif", fontSize: 18, color: "#F5F0E8", letterSpacing: "0.04em" },
    calNav:  { background: "transparent", border: "1.5px solid rgba(245,240,232,0.12)", color: "rgba(245,240,232,0.5)", borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
    calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
    calDow:  { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 },
    slotGrid:{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, maxHeight: 220, overflowY: "auto" as const },
    error:   { fontSize: 13, color: "#f87171", marginTop: 8 },
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={S.page}>
        <nav style={S.nav}>
          <a href="/landing.html" style={S.logo}>DILBERT</a>
          <a href="/landing.html" style={S.back}>← Volver al inicio</a>
        </nav>

        <div style={S.wrap}>

          {/* ── Step 1: Form ── */}
          {step === 1 && (
            <>
              <p style={S.tag}>PASO 1 DE 2 · DEMO DILBERT</p>
              <h1 style={S.title}>Agendar tu demo.</h1>
              <p style={S.sub}>30 minutos. Te mostramos el producto en acción con datos reales de tu equipo.</p>
              <form onSubmit={submitForm} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={S.row}>
                  <div>
                    <label style={S.label}>Nombre completo *</label>
                    <input style={S.input} type="text" placeholder="Martín López" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} autoComplete="name" />
                  </div>
                  <div>
                    <label style={S.label}>Empresa *</label>
                    <input style={S.input} type="text" placeholder="Acme S.A." value={form.company} onChange={e => setForm(f => ({...f, company: e.target.value}))} autoComplete="organization" />
                  </div>
                </div>
                <div style={S.row}>
                  <div>
                    <label style={S.label}>Email *</label>
                    <input style={S.input} type="email" placeholder="martin@acme.com" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} autoComplete="email" />
                  </div>
                  <div>
                    <label style={S.label}>Teléfono</label>
                    <input style={S.input} type="tel" placeholder="+54 11 1234-5678" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} autoComplete="tel" />
                  </div>
                </div>
                <div>
                  <label style={S.label}>¿Cuántos vendedores tiene el equipo? *</label>
                  <select style={{...S.input, cursor: "pointer"}} value={form.teamSize} onChange={e => setForm(f => ({...f, teamSize: e.target.value}))}>
                    <option value="">Seleccioná una opción</option>
                    <option value="1-5">1 a 5 vendedores</option>
                    <option value="6-20">6 a 20 vendedores</option>
                    <option value="20+">Más de 20 vendedores</option>
                  </select>
                </div>
                {formError && <p style={S.error}>{formError}</p>}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="submit" style={S.btnOr}>Elegir horario →</button>
                </div>
              </form>
            </>
          )}

          {/* ── Step 2: Calendar + slots ── */}
          {step === 2 && (
            <>
              <p style={S.tag}>PASO 2 DE 2 · ELEGÍ FECHA Y HORA</p>
              <h1 style={S.title}>¿Cuándo hablamos?</h1>

              {/* Calendar */}
              <div style={S.calWrap}>
                <div style={S.calHdr}>
                  <button type="button" style={S.calNav} onClick={() => calNav(-1)} disabled={!canPrevMonth}>‹</button>
                  <span style={S.calMon}>{MONTHS[calMonth]} {calYear}</span>
                  <button type="button" style={S.calNav} onClick={() => calNav(1)}>›</button>
                </div>
                <div style={S.calDow}>
                  {["LU","MA","MI","JU","VI","SA","DO"].map(d => (
                    <span key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(245,240,232,0.25)" }}>{d}</span>
                  ))}
                </div>
                <div style={S.calGrid}>{renderCal()}</div>
              </div>

              {/* Slots */}
              {selectedDate && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(245,240,232,0.35)", marginBottom: 12 }}>
                    {slotsLoading ? "Cargando horarios..." : slotsLabel}
                  </p>
                  {!slotsLoading && (
                    slots.length === 0
                      ? <p style={{ fontSize: 13, color: "rgba(245,240,232,0.3)", fontStyle: "italic" }}>Sin horarios disponibles. Elegí otro día.</p>
                      : <div style={S.slotGrid}>
                          {slots.map(slot => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelectedTime(slot)}
                              style={{
                                padding: "10px 0", borderRadius: 8,
                                border: selectedTime === slot ? "1.5px solid #D4420A" : "1.5px solid rgba(245,240,232,0.1)",
                                background: selectedTime === slot ? "rgba(212,66,10,0.15)" : "transparent",
                                color: selectedTime === slot ? "#F5F0E8" : "rgba(245,240,232,0.6)",
                                fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                                fontWeight: selectedTime === slot ? 700 : 500,
                                cursor: "pointer", textAlign: "center",
                              }}
                            >{slot}</button>
                          ))}
                        </div>
                  )}
                </div>
              )}

              {slotError && <p style={S.error}>{slotError}</p>}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" style={S.btnGh} onClick={() => setStep(1)}>← Atrás</button>
                <button type="button" style={{...S.btnOr, opacity: (!selectedDate || !selectedTime || confirming) ? 0.35 : 1}} onClick={confirm} disabled={!selectedDate || !selectedTime || confirming}>
                  {confirming ? "Agendando..." : "Confirmar →"}
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Confirmation ── */}
          {step === 3 && confirmResult && (
            <div style={{ textAlign: "center", paddingTop: 24 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(26,122,110,0.2)", border: "2px solid #1A7A6E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#1A7A6E", margin: "0 auto 24px" }}>✓</div>
              <h1 style={{...S.title, textAlign: "center"}}>¡Demo agendada!</h1>
              <p style={{ fontFamily: "Anton, sans-serif", fontSize: 20, color: "#D4420A", marginTop: 8 }}>
                {confirmResult.date} a las {confirmResult.time} hs
              </p>
              <p style={{ color: "rgba(245,240,232,0.4)", fontSize: 14, marginTop: 16, lineHeight: 1.65 }}>
                Revisá tu email — te mandamos la confirmación.<br />
                Cualquier duda escribinos.
              </p>
              <a href="/landing.html" style={{ display: "inline-block", marginTop: 28, ...S.btnGh, textDecoration: "none" }}>← Volver al inicio</a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
