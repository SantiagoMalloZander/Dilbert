"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Lead } from "@/lib/types";

const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: "Nuevo", className: "bg-[#EDE8DF] text-[#6B6B6B] border-[rgba(42,26,10,0.15)]" },
  contacted: { label: "Contactado", className: "bg-[#F5D53F]/20 text-[#7A6A00] border-[#F5D53F]/40" },
  negotiating: { label: "Negociando", className: "bg-[#D4420A]/10 text-[#D4420A] border-[#D4420A]/25" },
  closed_won: { label: "Ganado", className: "bg-[#1A7A6E]/10 text-[#1A7A6E] border-[#1A7A6E]/25" },
  closed_lost: { label: "Perdido", className: "bg-red-50 text-red-700 border-red-200" },
};

const sentimentConfig: Record<string, { label: string; className: string }> = {
  positive: { label: "Positivo", className: "text-[#1A7A6E] bg-[#1A7A6E]/8 border-[#1A7A6E]/20" },
  neutral: { label: "Neutral", className: "text-[#6B6B6B] bg-[#EDE8DF] border-[rgba(42,26,10,0.12)]" },
  negative: { label: "Negativo", className: "text-[#C0392B] bg-red-50 border-red-200" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadsTable({ leads, loading }: { leads: Lead[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Cargando leads...</span>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <p className="font-heading text-2xl tracking-wide text-muted-foreground">SIN LEADS</p>
        <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-wider">
          Los leads aparecen cuando el bot procesa conversaciones
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b hover:bg-transparent">
            {["Cliente", "Empresa", "Vendedor", "Producto", "Monto", "Estado", "Sentimiento", "Última Interacción"].map((h) => (
              <TableHead key={h} className="text-[9px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground py-3">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const status = statusConfig[lead.status] || statusConfig.new;
            const sentiment = lead.sentiment ? sentimentConfig[lead.sentiment] : null;

            return (
              <TableRow
                key={lead.id}
                className="cursor-pointer hover:bg-[#EDE8DF]/40 transition-colors border-b border-border/50"
              >
                <TableCell className="py-3">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-sm hover:text-[#D4420A] transition-colors"
                  >
                    {lead.client_name || "Sin nombre"}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground py-3">
                  {lead.client_company || "—"}
                </TableCell>
                <TableCell className="text-sm py-3">{lead.sellers?.name || "—"}</TableCell>
                <TableCell className="text-sm py-3">{lead.product_interest || "—"}</TableCell>
                <TableCell className="text-sm font-medium py-3">
                  {lead.estimated_amount
                    ? `${lead.currency || "$"} ${lead.estimated_amount.toLocaleString()}`
                    : "—"}
                </TableCell>
                <TableCell className="py-3">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded border ${status.className}`}
                  >
                    {status.label}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  {sentiment ? (
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded border ${sentiment.className}`}
                    >
                      {sentiment.label}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground py-3">
                  {formatDate(lead.last_interaction)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
