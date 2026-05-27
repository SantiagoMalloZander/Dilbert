import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Legacy single-tenant CRM routes → workspace app equivalents.
    // Soft (307) so old bookmarks land in the right place instead of 404ing.
    return [
      { source: "/login", destination: "/app", permanent: false },
      { source: "/dashboard", destination: "/app/crm", permanent: false },
      { source: "/metricas", destination: "/app/crm/analytics", permanent: false },
      { source: "/analytics", destination: "/app/crm/analytics", permanent: false },
      { source: "/analytics/:path*", destination: "/app/crm/analytics", permanent: false },
      { source: "/leads/:path*", destination: "/app/crm/leads", permanent: false },
      { source: "/configuracion", destination: "/app/integrations", permanent: false },
      { source: "/crm/hubspot", destination: "/app/integrations", permanent: false },
    ];
  },
};

export default nextConfig;
