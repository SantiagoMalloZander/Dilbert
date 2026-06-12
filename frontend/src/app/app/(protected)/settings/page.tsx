import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/workspace-auth";
import { listZones } from "@/modules/agency/zones/queries";
import { listProperties } from "@/modules/agency/properties/queries";
import { getUsersCenterData, type UsersCenterData } from "@/modules/users/queries";
import { getBillingState, getActiveVendorCount, type BillingState } from "@/modules/billing/queries";
import { PRICE_PER_SEAT_USD_CENTS, clampSeats, mpPricePerSeatArs } from "@/lib/billing/config";
import { getDolarTarjeta } from "@/lib/billing/fx";
import { getBotConfig, type BotConfig } from "@/modules/agency/bot/queries";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

export default async function SettingsPage() {
  const session = await requireSession();

  // Tenant configuration is owner-only.
  if (session.user.role !== "owner" && !session.user.isSuperAdmin) {
    redirect("/app/crm");
  }

  const companyId = session.user.companyId;
  const priceUsd = PRICE_PER_SEAT_USD_CENTS / 100;

  const [zones, properties, usersData, billing, activeVendors, rate, botConfig] = await Promise.all([
    listZones(),
    listProperties(),
    // User management lives inside Configuración now. Owner-only; skip for a
    // super-admin browsing without a company.
    companyId
      ? getUsersCenterData(companyId).catch(() => null)
      : Promise.resolve<UsersCenterData | null>(null),
    companyId
      ? getBillingState(companyId).catch(() => null)
      : Promise.resolve<BillingState | null>(null),
    companyId ? getActiveVendorCount(companyId).catch(() => 0) : Promise.resolve(0),
    getDolarTarjeta(),
    companyId
      ? getBotConfig(companyId).catch(() => ({ configured: false, phoneNumber: null, configuredAt: null }))
      : Promise.resolve<BotConfig>({ configured: false, phoneNumber: null, configuredAt: null }),
  ]);

  const billingData = billing
    ? {
        state: billing,
        defaultSeats: clampSeats(Math.max(billing.seats || 0, activeVendors, 1)),
        activeVendors,
        priceUsd,
        priceArs: mpPricePerSeatArs(),
        dolarTarjeta: rate,
        isOwner: session.user.role === "owner" || session.user.isSuperAdmin,
        stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
        mpEnabled: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
      }
    : null;

  return (
    <div className="space-y-6">
      <Card className="bg-card/90">
        <CardContent className="pt-7">
          <div className="space-y-2">
            <Badge className="border border-primary/20 bg-primary/10 text-foreground">
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Configuración
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Configuración de la agencia</h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              Catálogo de propiedades, zonas que cubrís, usuarios del equipo y configuración del bot de WhatsApp.
            </p>
          </div>
        </CardContent>
      </Card>

      <SettingsTabs
        initialZones={zones}
        initialProperties={properties}
        usersData={usersData}
        billingData={billingData}
        botConfig={botConfig}
      />
    </div>
  );
}
