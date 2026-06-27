"use client";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { DOC_TYPE_LABEL } from "@/lib/constants";
import type { DeptCompliance, DocumentType } from "@/lib/types";
import { arNum } from "@/lib/utils";

const AXIS = { fontSize: 11, fill: "rgb(var(--faint))", fontFamily: "var(--font-body)" };

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-elevated px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="tnum text-muted">
          {p.name}: <span className="font-semibold text-ink">{arNum(p.value)}</span>
          {p.unit}
        </p>
      ))}
    </div>
  );
}

export function TypeBarChart({ data }: { data: { type: DocumentType; count: number }[] }) {
  const rows = data.map((d) => ({ name: DOC_TYPE_LABEL[d.type], count: d.count }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} reversed />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} orientation="right" allowDecimals={false} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgb(var(--surface-2))" }} />
        <Bar dataKey="count" name="عدد الوثائق" radius={[6, 6, 0, 0]} fill="rgb(var(--teal))" maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DeptComplianceChart({ data }: { data: DeptCompliance[] }) {
  const rows = data.map((d) => ({ name: d.departmentName, rate: d.rate }));
  const color = (r: number) =>
    r >= 85 ? "rgb(var(--ok))" : r >= 70 ? "rgb(var(--teal))" : r >= 60 ? "rgb(var(--warn))" : "rgb(var(--danger))";
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="rgb(var(--line))" />
        <XAxis type="number" domain={[0, 100]} tick={AXIS} axisLine={false} tickLine={false} unit="٪" />
        <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={84} orientation="right" />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgb(var(--surface-2))" }} />
        <Bar dataKey="rate" name="نسبة الامتثال" unit="٪" radius={[0, 6, 6, 0]} maxBarSize={26}>
          {rows.map((r, i) => (
            <Cell key={i} fill={color(r.rate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data }: { data: { month: string; acknowledged: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="g-ack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--teal))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="rgb(var(--teal))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
        <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} reversed />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} orientation="right" domain={[0, 100]} unit="٪" />
        <Tooltip content={<ChartTip />} />
        <Area type="monotone" dataKey="acknowledged" name="نسبة الإقرار" unit="٪" stroke="rgb(var(--teal))" strokeWidth={2.5} fill="url(#g-ack)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
