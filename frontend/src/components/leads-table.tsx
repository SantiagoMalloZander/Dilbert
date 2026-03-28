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
import { Badge } from "@/components/ui/badge";
import { Lead } from "@/lib/types";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Nuevo", variant: "outline" },
  contacted: { label: "Contactado", variant: "secondary" },
  negotiating: { label: "Negociando", variant: "default" },
  closed_won: { label: "Ganado", variant: "default" },
  closed_lost: { label: "Perdido", variant: "destructive" },
};

const sentimentConfig: Record<string, { label: string; className: string }> = {
  positive: { label: "Positivo", className: "text-green-700 bg-green-50 border-green-200" },
  neutral: { label: "Neutral", className: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  negative: { label: "Negativo", className: "text-red-700 bg-red-50 border-red-200" },
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
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Cargando leads...
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No hay leads todavia</p>
        <p className="text-sm">Los leads apareceran cuando el bot procese conversaciones</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Sentimiento</TableHead>
            <TableHead>Ultima Interaccion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const status = statusConfig[lead.status] || statusConfig.new;
            const sentiment = lead.sentiment
              ? sentimentConfig[lead.sentiment]
              : null;

            return (
              <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                    {lead.client_name || "Sin nombre"}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.client_company || "-"}
                </TableCell>
                <TableCell>{lead.sellers?.name || "-"}</TableCell>
                <TableCell>{lead.product_interest || "-"}</TableCell>
                <TableCell>
                  {lead.estimated_amount
                    ? `${lead.currency || "$"} ${lead.estimated_amount.toLocaleString()}`
                    : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  {sentiment ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${sentiment.className}`}>
                      {sentiment.label}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
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
