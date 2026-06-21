import { FileText, Inbox, Send, Archive, PenLine, Clock } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import type { AdminLetterStats } from '../../../data/repositories/operationsAdminLettersRepository';

interface LetterStatsCardsProps {
  stats: AdminLetterStats | null;
  loading?: boolean;
}

const ITEMS = [
  { key: 'total' as const, label: 'إجمالي الكتب', icon: FileText, accent: 'from-cyan-500 to-blue-600' },
  { key: 'outgoing' as const, label: 'كتب صادرة', icon: Send, accent: 'from-emerald-500 to-teal-600' },
  { key: 'incoming' as const, label: 'كتب واردة', icon: Inbox, accent: 'from-violet-500 to-purple-600' },
  { key: 'unsigned' as const, label: 'بانتظار التوقيع', icon: PenLine, accent: 'from-amber-500 to-orange-600' },
  { key: 'archived' as const, label: 'مؤرشف', icon: Archive, accent: 'from-slate-500 to-slate-700' },
  { key: 'pendingResponse' as const, label: 'تحتاج رد', icon: Clock, accent: 'from-rose-500 to-pink-600' },
];

export default function LetterStatsCards({ stats, loading }: LetterStatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {ITEMS.map(({ key, label, icon: Icon, accent }) => (
        <Card key={key} className="overflow-hidden border-cyan-200/40 dark:border-cyan-800/40">
          <CardContent className="p-0">
            <div className={`bg-gradient-to-br ${accent} px-4 py-3 text-white`}>
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 opacity-90" />
                <span className="text-2xl font-black">{loading ? '—' : (stats?.[key] ?? 0)}</span>
              </div>
              <p className="mt-1 text-xs font-semibold opacity-90">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
