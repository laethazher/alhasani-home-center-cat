import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { cn } from '../../lib/utils';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

interface ChartsPanelProps {
  barData: { name: string; value: number }[];
  pieData: { name: string; value: number }[];
  /** سلسلة زمنية اختيارية (مثلاً أيام × عدد) */
  lineData?: { name: string; value: number }[];
  className?: string;
  /** إخفاء الرسم إذا لا توجد بيانات كافية */
  minBarItems?: number;
  /** الحد الأدنى لنقاط الخط */
  minLineItems?: number;
}

export function ChartsPanel({
  barData,
  pieData,
  lineData,
  className,
  minBarItems = 1,
  minLineItems = 2,
}: ChartsPanelProps) {
  const showBar = barData.length >= minBarItems;
  const showPie = pieData.length >= 1;
  const showLine = (lineData?.length ?? 0) >= minLineItems;

  if (!showBar && !showPie && !showLine) return null;

  return (
    <div
      className={cn(
        'grid grid-cols-1 lg:grid-cols-2 gap-4 rounded-2xl border border-stone-200 dark:border-stone-700',
        'bg-white dark:bg-stone-900 p-4',
        className
      )}
    >
      {showLine && lineData && (
        <div className="h-56 w-full min-h-[14rem] lg:col-span-2">
          <p className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2 text-right">خط — اتجاه زمني</p>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  direction: 'rtl',
                  textAlign: 'right',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                }}
              />
              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {showBar && (
        <div className="h-56 w-full min-h-[14rem]">
          <p className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2 text-right">أعمدة — العدد حسب التصنيف</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  direction: 'rtl',
                  textAlign: 'right',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {showPie && (
        <div className="h-56 w-full min-h-[14rem]">
          <p className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2 text-right">دائري — التوزيع</p>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={72}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  direction: 'rtl',
                  textAlign: 'right',
                  borderRadius: 12,
                }}
              />
              <Legend wrapperStyle={{ direction: 'rtl' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
