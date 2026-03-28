"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Error al iniciar sesión.");
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#F5F0E8" }}
    >
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-10 text-center">
          <div
            className="font-heading text-5xl tracking-widest mb-2"
            style={{ color: "#D4420A" }}
          >
            DILBERT.
          </div>
          <p
            className="text-[10px] font-mono uppercase tracking-[0.25em]"
            style={{ color: "#6B6B6B" }}
          >
            hackITBA 2026
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-8 space-y-5"
          style={{
            background: "#FAF7F2",
            border: "1.5px solid rgba(42,26,10,0.1)",
          }}
        >
          <div className="space-y-1 mb-6">
            <p
              className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em]"
              style={{ color: "#6B6B6B" }}
            >
              Acceso al producto
            </p>
            <h1
              className="font-heading text-3xl tracking-wide leading-none"
              style={{ color: "#1A1A1A" }}
            >
              INICIAR SESIÓN
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="block text-[9px] font-mono uppercase tracking-[0.2em]"
                style={{ color: "#6B6B6B" }}
              >
                Usuario
              </label>
              <input
                type="text"
                autoComplete="username"
                placeholder="demo"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
                style={{
                  background: "#F5F0E8",
                  border: "1.5px solid rgba(42,26,10,0.15)",
                  color: "#1A1A1A",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="block text-[9px] font-mono uppercase tracking-[0.2em]"
                style={{ color: "#6B6B6B" }}
              >
                Contraseña
              </label>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
                style={{
                  background: "#F5F0E8",
                  border: "1.5px solid rgba(42,26,10,0.15)",
                  color: "#1A1A1A",
                }}
              />
            </div>

            {error && (
              <p className="text-xs font-mono text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: "#D4420A",
                color: "#F5F0E8",
              }}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>

        <p
          className="mt-6 text-center text-[9px] font-mono uppercase tracking-[0.2em]"
          style={{ color: "rgba(42,26,10,0.25)" }}
        >
          AI-powered CRM — Dilbert
        </p>
      </div>
    </div>
  );
}
