"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZonesManager } from "@/components/settings/ZonesManager";
import { PropertiesManager } from "@/components/settings/PropertiesManager";
import { BotPlaceholder } from "@/components/settings/BotPlaceholder";
import { UsersCenter } from "@/components/users-center";
import { SubscriptionView } from "@/components/billing/subscription-view";
import type { ZoneRecord } from "@/modules/agency/zones/types";
import type { PropertyRecord } from "@/modules/agency/properties/types";
import type { UsersCenterData } from "@/modules/users/queries";
import type { BillingState } from "@/modules/billing/queries";
import type { BotConfig } from "@/modules/agency/bot/queries";

type BillingData = {
  state: BillingState;
  defaultSeats: number;
  activeVendors: number;
  priceUsd: number;
  priceArs: number;
  dolarTarjeta: number;
  isOwner: boolean;
  stripeEnabled: boolean;
  mpEnabled: boolean;
};

export function SettingsTabs({
  initialZones,
  initialProperties,
  usersData,
  billingData,
  botConfig,
}: {
  initialZones: ZoneRecord[];
  initialProperties: PropertyRecord[];
  usersData: UsersCenterData | null;
  billingData: BillingData | null;
  botConfig: BotConfig;
}) {
  return (
    <Tabs defaultValue="properties" className="w-full">
      <TabsList variant="line" className="mb-4">
        <TabsTrigger value="properties">Productos</TabsTrigger>
        <TabsTrigger value="zones">Zonas</TabsTrigger>
        {usersData ? <TabsTrigger value="users">Usuarios</TabsTrigger> : null}
        <TabsTrigger value="bot">Bot</TabsTrigger>
        {billingData ? <TabsTrigger value="billing">Suscripción</TabsTrigger> : null}
      </TabsList>

      <TabsContent value="properties">
        <PropertiesManager initialProperties={initialProperties} />
      </TabsContent>
      <TabsContent value="zones">
        <ZonesManager initialZones={initialZones} />
      </TabsContent>
      {usersData ? (
        <TabsContent value="users">
          <UsersCenter
            vendorLimit={usersData.vendorLimit}
            activeVendors={usersData.activeVendors}
            inviteLink={usersData.inviteLink}
            users={usersData.users}
          />
        </TabsContent>
      ) : null}
      <TabsContent value="bot">
        <BotPlaceholder config={botConfig} />
      </TabsContent>
      {billingData ? (
        <TabsContent value="billing">
          <SubscriptionView
            isOwner={billingData.isOwner}
            state={billingData.state}
            defaultSeats={billingData.defaultSeats}
            activeVendors={billingData.activeVendors}
            priceUsd={billingData.priceUsd}
            priceArs={billingData.priceArs}
            dolarTarjeta={billingData.dolarTarjeta}
            stripeEnabled={billingData.stripeEnabled}
            mpEnabled={billingData.mpEnabled}
          />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
