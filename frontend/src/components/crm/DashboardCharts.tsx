"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LeadsBySourceMetric, LeadsByStageMetric } from "@/modules/crm/leads/types";

const PIE_COLORS = ["#35d6ae", "#f59e0b", "#38bdf8", "#f97316", "#a78bfa", "#ef4444", "#14b8a6"];

function tooltipStyle() {
  return {
    background: "#08111d",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    color: "#f8fafc",
  };
}

export function LeadsByStageChart({ data }: { data: LeadsByStageMetric[] }) {
  const router = useRouter();

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 12, left: -18, bottom: 4 }}>
          <XAxis dataKey="name" tick={{ fill: "#9fb0c8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#9fb0c8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={tooltipStyle()}
            formatter={(value) => [value, "Leads"]}
          />
          <Bar
            dataKey="count"
            radius={[12, 12, 0, 0]}
            onClick={(entry) => {
              const payload = entry?.payload as LeadsByStageMetric | undefined;
              if (!payload?.stageId) return;
              router.push(`/app/crm/leads?stage=${payload.stageId}`);
            }}
          >
            {data.map((item) => (
              <Cell key={item.stageId} fill={item.color} style={{ cursor: "pointer" }} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeadsBySourceChart({ data }: { data: LeadsBySourceMetric[] }) {
  const nonEmpty = data.filter((item) => item.value > 0);
  const safeData = nonEmpty.length > 0 ? nonEmpty : data;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="h-[300px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safeData}
              dataKey="value"
              nameKey="label"
              innerRadius={62}
              outerRadius={100}
              paddingAngle={2}
            >
              {safeData.map((item, index) => (
                <Cell key={item.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle()} formatter={(value) => [value, "Leads"]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        {safeData.map((item, index) => (
          <div
            key={item.source}
            className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
              />
              <span className="text-sm text-[#d8e4f2]">{item.label}</span>
            </div>
            <span className="text-sm font-semibold text-white">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
