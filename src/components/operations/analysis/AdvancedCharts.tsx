import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieIcon, Activity, Maximize2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { ChartData, ChartType } from '../../../lib/dataAnalysis/types';
import { CHART_COLORS, CHART_TYPE_LABELS } from '../../../lib/dataAnalysis/types';

interface ChartCardProps {
  chart: ChartData;
  index?: number;
  onExpand?: () => void;
}

const CHART_ICONS: Record<ChartType, typeof BarChart3> = {
  bar: BarChart3,
  line: TrendingUp,
  pie: PieIcon,
  area: Activity,
  scatter: Activity,
  histogram: BarChart3,
  donut: PieIcon,
};

function ChartCard({ chart, index = 0, onExpand }: ChartCardProps) {
  const Icon = CHART_ICONS[chart.type] || BarChart3;

  const renderChart = (height: number) => {
    const colors = chart.colors || CHART_COLORS;

    switch (chart.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey={chart.xKey}
                tick={{ fontSize: 11, fill: '#64748b' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{
                  direction: 'rtl',
                  textAlign: 'right',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Bar dataKey={chart.yKey || 'value'} radius={[6, 6, 0, 0]}>
                {chart.data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey={chart.xKey}
                tick={{ fontSize: 11, fill: '#64748b' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{
                  direction: 'rtl',
                  textAlign: 'right',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                }}
              />
              <Line
                type="monotone"
                dataKey={chart.yKey || 'value'}
                stroke={colors[0]}
                strokeWidth={3}
                dot={{ fill: colors[0], r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chart.data}
                dataKey={chart.yKey || 'value'}
                nameKey={chart.xKey}
                cx="50%"
                cy="50%"
                outerRadius={height / 3}
                innerRadius={chart.type === 'donut' ? height / 5 : 0}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#64748b' }}
              >
                {chart.data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  direction: 'rtl',
                  textAlign: 'right',
                  borderRadius: 12,
                }}
              />
              <Legend wrapperStyle={{ direction: 'rtl', paddingTop: 16 }} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey={chart.xKey}
                tick={{ fontSize: 11, fill: '#64748b' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{
                  direction: 'rtl',
                  textAlign: 'right',
                  borderRadius: 12,
                }}
              />
              <defs>
                <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors[0]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={colors[0]} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey={chart.yKey || 'value'}
                stroke={colors[0]}
                strokeWidth={2}
                fill={`url(#gradient-${index})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey={chart.xKey}
                tick={{ fontSize: 11, fill: '#64748b' }}
                name={chart.xKey}
              />
              <YAxis
                dataKey={chart.yKey || 'value'}
                tick={{ fontSize: 11, fill: '#64748b' }}
                name={chart.yKey}
              />
              <Tooltip
                contentStyle={{
                  direction: 'rtl',
                  textAlign: 'right',
                  borderRadius: 12,
                }}
              />
              <Scatter data={chart.data} fill={colors[0]}>
                {chart.data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-500">
            نوع الرسم غير مدعوم
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
            <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white">{chart.title}</h4>
            <p className="text-xs text-slate-500">{CHART_TYPE_LABELS[chart.type]}</p>
          </div>
        </div>
        {onExpand && (
          <button
            onClick={onExpand}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Maximize2 className="h-4 w-4 text-slate-500" />
          </button>
        )}
      </div>
      <div className="p-4">{renderChart(280)}</div>
    </motion.div>
  );
}

interface AdvancedChartsProps {
  charts: ChartData[];
  className?: string;
}

export default function AdvancedCharts({ charts, className }: AdvancedChartsProps) {
  const [expandedChart, setExpandedChart] = useState<ChartData | null>(null);

  if (charts.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>لا توجد رسوم بيانية متاحة</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn('grid gap-6 md:grid-cols-2', className)}>
        {charts.map((chart, idx) => (
          <ChartCard
            key={`${chart.title}-${idx}`}
            chart={chart}
            index={idx}
            onExpand={() => setExpandedChart(chart)}
          />
        ))}
      </div>

      {expandedChart && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setExpandedChart(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-lg">{expandedChart.title}</h3>
              <button
                onClick={() => setExpandedChart(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <ChartCard chart={expandedChart} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}

// رسم بياني لتوزيع الفواتير الرئيسية
interface InvoiceDistributionChartProps {
  deliveryCount: number;
  installationCount: number;
  title?: string;
}

export function InvoiceDistributionChart({ 
  deliveryCount, 
  installationCount,
  title = 'توزيع الفواتير الرئيسية - التجهيز والتركيب'
}: InvoiceDistributionChartProps) {
  const data = [
    { name: 'تجهيز', value: deliveryCount, color: '#22c55e' },
    { name: 'تركيب', value: installationCount, color: '#3b82f6' },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h4 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{title}</h4>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ direction: 'rtl' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// رسم بياني للنجاح والتعويض
interface SuccessCompensationChartProps {
  deliverySuccess: number;
  deliveryCompensation: number;
  installationSuccess: number;
  installationCompensation: number;
  title?: string;
}

export function SuccessCompensationChart({
  deliverySuccess,
  deliveryCompensation,
  installationSuccess,
  installationCompensation,
  title = 'نسب النجاح والتعويض'
}: SuccessCompensationChartProps) {
  const data = [
    { name: 'تجهيز', نجاح: deliverySuccess, تعويض: deliveryCompensation },
    { name: 'تركيب', نجاح: installationSuccess, تعويض: installationCompensation },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h4 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{title}</h4>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
          <Legend wrapperStyle={{ direction: 'rtl' }} />
          <Bar dataKey="نجاح" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="تعويض" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// رسم بياني لتوزيع Stage
interface StageDistributionChartProps {
  stages: { stage: string; count: number; percentage: number }[];
  title?: string;
}

export function StageDistributionChart({ stages, title = 'توزيع Stage' }: StageDistributionChartProps) {
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#6b7280'];
  
  const data = stages.slice(0, 7).map((s, i) => ({
    name: s.stage.length > 15 ? s.stage.substring(0, 15) + '...' : s.stage,
    value: s.count,
    percentage: s.percentage,
    color: colors[i % colors.length]
  }));

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h4 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{title}</h4>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            label={({ name, percentage }) => `${name} (${percentage.toFixed(1)}%)`}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number, name: string, entry: any) => [`${v} (${entry.payload.percentage.toFixed(1)}%)`, name]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// رسم بياني لأداء الموظفين
interface EmployeePerformanceChartProps {
  employees: { name: string; total: number; delivery: number; installation: number }[];
  title?: string;
}

export function EmployeePerformanceChart({ 
  employees, 
  title = 'أداء الموظفين' 
}: EmployeePerformanceChartProps) {
  const data = employees.slice(0, 10).map(e => ({
    name: e.name.length > 12 ? e.name.substring(0, 12) + '...' : e.name,
    تجهيز: e.delivery,
    تركيب: e.installation,
    total: e.total
  }));

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h4 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{title}</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 80, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
          <Tooltip />
          <Legend wrapperStyle={{ direction: 'rtl' }} />
          <Bar dataKey="تجهيز" stackId="a" fill="#22c55e" />
          <Bar dataKey="تركيب" stackId="a" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// رسم بياني لأداء المشرفين
interface SupervisorPerformanceChartProps {
  supervisors: { 
    name: string; 
    deliveryInvoices: number; 
    deliverySuccess: number;
    installationInvoices: number;
    installationSuccess: number;
  }[];
  title?: string;
}

export function SupervisorPerformanceChart({ 
  supervisors, 
  title = 'أداء المشرفين' 
}: SupervisorPerformanceChartProps) {
  const data = supervisors.slice(0, 6).map(s => ({
    name: s.name.length > 10 ? s.name.substring(0, 10) + '...' : s.name,
    'تجهيز': s.deliveryInvoices,
    'تركيب': s.installationInvoices,
    'نجاح تجهيز': s.deliverySuccess,
    'نجاح تركيب': s.installationSuccess
  }));

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h4 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{title}</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
          <YAxis />
          <Tooltip />
          <Legend wrapperStyle={{ direction: 'rtl' }} />
          <Bar dataKey="تجهيز" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="تركيب" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { ChartCard };
