import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import OperationsPageShell from '../../components/operations/OperationsPageShell';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import {
  operationsModulesRepository,
  type OpsTask,
  type OpsTaskPriority,
  type OpsTaskStatus,
} from '../../data/repositories/operationsModulesRepository';

const STATUS_LABELS: Record<OpsTaskStatus, string> = {
  pending: 'قيد الانتظار',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
};

const PRIORITY_LABELS: Record<OpsTaskPriority, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  urgent: 'عاجلة',
};

export default function OpsTaskManagement() {
  const [tasks, setTasks] = useState<OpsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<OpsTaskPriority>('medium');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await operationsModulesRepository.listTasks());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await operationsModulesRepository.createTask({
        title: title.trim(),
        description: null,
        priority,
        assignee_name: assignee.trim() || null,
        due_date: null,
      });
      setTitle('');
      setAssignee('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: number, status: OpsTaskStatus) {
    await operationsModulesRepository.updateTaskStatus(id, status);
    await load();
  }

  return (
    <OperationsPageShell
      title="إدارة المهام"
      subtitle="إنشاء ومتابعة أوامر العمل والمهام التشغيلية"
      icon={ClipboardList}
    >
      <Card className="border-cyan-200/40">
        <CardContent className="p-4">
          <form onSubmit={(e) => void handleCreate(e)} className="grid gap-3 md:grid-cols-4">
            <Input placeholder="عنوان المهمة" value={title} onChange={(e) => setTitle(e.target.value)} className="md:col-span-2" />
            <Input placeholder="المسؤول" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as OpsTaskPriority)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <Button type="submit" disabled={saving} className="font-bold md:col-span-4 md:w-auto">
              <Plus className="h-4 w-4" />
              إضافة مهمة
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">جاري التحميل...</p> : null}
        {!loading && tasks.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">لا توجد مهام بعد — أضف أول مهمة.</CardContent></Card>
        ) : null}
        {tasks.map((task) => (
          <Card key={task.id} className="border-cyan-200/30">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{task.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {PRIORITY_LABELS[task.priority]} · {task.assignee_name ?? 'بدون مسؤول'} · {STATUS_LABELS[task.status]}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {task.status === 'pending' ? (
                  <Button size="sm" variant="outline" onClick={() => void setStatus(task.id, 'in_progress')}>بدء</Button>
                ) : null}
                {task.status === 'in_progress' ? (
                  <Button size="sm" onClick={() => void setStatus(task.id, 'completed')}>إنهاء</Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </OperationsPageShell>
  );
}
