import { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import OperationsPageShell from '../../components/operations/OperationsPageShell';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import {
  operationsModulesRepository,
  type OpsSchedule,
  type OpsScheduleType,
} from '../../data/repositories/operationsModulesRepository';

const TYPE_LABELS: Record<OpsScheduleType, string> = {
  shift: 'وردية',
  deployment: 'انتشار',
  maintenance_window: 'نافذة صيانة',
  meeting: 'اجتماع',
};

export default function OpsScheduling() {
  const [schedules, setSchedules] = useState<OpsSchedule[]>([]);
  const [title, setTitle] = useState('');
  const [teamName, setTeamName] = useState('');
  const [scheduleType, setScheduleType] = useState<OpsScheduleType>('shift');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');

  const load = useCallback(async () => {
    setSchedules(await operationsModulesRepository.listSchedules());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startAt || !endAt) return;
    await operationsModulesRepository.createSchedule({
      title: title.trim(),
      schedule_type: scheduleType,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      team_name: teamName.trim() || null,
      notes: null,
    });
    setTitle('');
    setTeamName('');
    setStartAt('');
    setEndAt('');
    await load();
  }

  return (
    <OperationsPageShell
      title="الجدولة"
      subtitle="جداول الورديات والانتشار ونوافذ التشغيل"
      icon={Calendar}
    >
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2">
          <form onSubmit={(e) => void handleCreate(e)} className="contents">
            <Input placeholder="عنوان الجدول" value={title} onChange={(e) => setTitle(e.target.value)} className="md:col-span-2" />
            <Input placeholder="الفريق" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as OpsScheduleType)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            <Button type="submit" className="font-bold md:col-span-2 md:w-auto"><Plus className="h-4 w-4" /> إضافة جدول</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {schedules.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <p className="font-bold">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {TYPE_LABELS[s.schedule_type]} · {s.team_name ?? '—'}
              </p>
              <p className="mt-2 text-xs text-cyan-700 dark:text-cyan-300">
                {new Date(s.start_at).toLocaleString('ar-IQ')} — {new Date(s.end_at).toLocaleString('ar-IQ')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </OperationsPageShell>
  );
}
