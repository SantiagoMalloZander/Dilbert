"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZonesManager } from "@/components/settings/ZonesManager";
import { PropertiesManager } from "@/components/settings/PropertiesManager";
import { BotPlaceholder } from "@/components/settings/BotPlaceholder";
import { UsersCenter } from "@/components/users-center";
import type { ZoneRecord } from "@/modules/agency/zones/types";
import type { PropertyRecord } from "@/modules/agency/properties/types";
import type { UsersCenterData } from "@/modules/users/queries";

export function SettingsTabs({
  initialZones,
  initialProperties,
  usersData,
}: {
  initialZones: ZoneRecord[];
  initialProperties: PropertyRecord[];
  usersData: UsersCenterData | null;
}) {
  return (
    <Tabs defaultValue="properties" className="w-full">
      <TabsList variant="line" className="mb-4">
        <TabsTrigger value="properties">Productos</TabsTrigger>
        <TabsTrigger value="zones">Zonas</TabsTrigger>
        {usersData ? <TabsTrigger value="users">Usuarios</TabsTrigger> : null}
        <TabsTrigger value="bot">Bot</TabsTrigger>
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
        <BotPlaceholder />
      </TabsContent>
    </Tabs>
  );
}
