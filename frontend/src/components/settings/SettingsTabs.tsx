"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZonesManager } from "@/components/settings/ZonesManager";
import { PropertiesManager } from "@/components/settings/PropertiesManager";
import { BotPlaceholder } from "@/components/settings/BotPlaceholder";
import type { ZoneRecord } from "@/modules/agency/zones/types";
import type { PropertyRecord } from "@/modules/agency/properties/types";

export function SettingsTabs({
  initialZones,
  initialProperties,
}: {
  initialZones: ZoneRecord[];
  initialProperties: PropertyRecord[];
}) {
  return (
    <Tabs defaultValue="properties" className="w-full">
      <TabsList variant="line" className="mb-4">
        <TabsTrigger value="properties">Productos</TabsTrigger>
        <TabsTrigger value="zones">Zonas</TabsTrigger>
        <TabsTrigger value="bot">Bot</TabsTrigger>
      </TabsList>

      <TabsContent value="properties">
        <PropertiesManager initialProperties={initialProperties} />
      </TabsContent>
      <TabsContent value="zones">
        <ZonesManager initialZones={initialZones} />
      </TabsContent>
      <TabsContent value="bot">
        <BotPlaceholder />
      </TabsContent>
    </Tabs>
  );
}
