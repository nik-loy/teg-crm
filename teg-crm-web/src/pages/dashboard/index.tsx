

import { useEffect, useState } from "react";
import { backendFetch } from "@/lib/backend";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Stats {
  total: number;
  byStage: Record<string, number>;
  byTier: Record<string, number>;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  newByMonth: Record<string, number>;
}

const STAGE_COLORS: Record<string, string> = {
  Awareness: "#94a3b8",
  "First Attendance": "#60a5fa",
  Engaged: "#4ade80",
  Deepening: "#fbbf24",
  Activated: "#a78bfa",
};

function toChartData(record: Record<string, number>) {
  return Object.entries(record).map(([name, value]) => ({ name, value }));
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}

function ChartSection({
  title,
  data,
  colorMap,
}: {
  title: string;
  data: { name: string; value: number }[];
  colorMap?: Record<string, string>;
}) {
  if (data.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(v) => [v, "contacts"]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={colorMap?.[entry.name] ?? "#6366f1"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2 col-span-full">
      <p className="text-sm font-medium">New contacts per month</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ left: 0, right: 16 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v) => [v, "contacts"]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    backendFetch("/api/contacts/stats/")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch dashboard stats");
        return r.json();
      })
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setStats(d as Stats);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <p className="text-sm text-destructive">Failed to load stats: {error}</p>
    );
  }

  if (!stats) {
    return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  }

  const activated = stats.byStage["Activated"] ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total contacts" value={stats.total} />
        <StatCard label="Activated" value={activated} />
        <StatCard
          label="Activation rate"
          value={stats.total ? `${Math.round((activated / stats.total) * 100)}%` : "—"}
        />
        <StatCard
          label="Stages tracked"
          value={Object.keys(stats.byStage).length}
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartSection
          title="By pipeline stage"
          data={toChartData(stats.byStage)}
          colorMap={STAGE_COLORS}
        />
        <ChartSection
          title="By outreach status"
          data={toChartData(stats.byStatus)}
        />
        <ChartSection
          title="By tier"
          data={toChartData(stats.byTier)}
        />
        <ChartSection
          title="By source"
          data={toChartData(stats.bySource)}
        />
        <MonthChart data={toChartData(stats.newByMonth)} />
      </div>
    </div>
  );
}
