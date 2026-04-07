// @ts-nocheck
import Link from "next/link";

import { PurchaseSignalBadge } from "@/components/purchase-signal-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AnalyticsClient } from "@/lib/types";

function formatMoney(amount: number, currency: string | null) {
  return `${currency ?? "ARS"} ${new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export function ClientIntelligenceTable({
  clients,
}: {
  clients: AnalyticsClient[];
}) {
  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        Todavia no hay suficientes clientes para construir el analisis.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Indicador de compra</TableHead>
            <TableHead>Segmento</TableHead>
            <TableHead>Prediccion 30d</TableHead>
            <TableHead>Proxima compra</TableHead>
            <TableHead>Producto dominante</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.client_key}>
              <TableCell className="align-top">
                <Link
                  href={`/analytics/${client.primary_lead_id}`}
                  className="font-medium hover:underline"
                >
                  {client.client_name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {client.client_company || "Sin empresa"} ·{" "}
                  {client.seller_names.join(", ") || "Sin vendedor"}
                </p>
              </TableCell>
              <TableCell className="align-top">
                <PurchaseSignalBadge signal={client.purchase_signal} />
                <p className="mt-2 max-w-xs text-xs text-muted-foreground">
                  {client.purchase_signal.description}
                </p>
              </TableCell>
              <TableCell className="align-top">{client.segment_label}</TableCell>
              <TableCell className="align-top">
                {formatMoney(client.predicted_30d_amount, client.dominant_currency)}
              </TableCell>
              <TableCell className="align-top">
                {client.predicted_next_purchase_days} dias
              </TableCell>
              <TableCell className="align-top">
                {client.dominant_product || "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
