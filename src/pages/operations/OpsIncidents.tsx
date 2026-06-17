import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import OperationsPageShell from '../../components/operations/OperationsPageShell';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import {
  operationsModulesRepository,
  type OpsIncident,
  type OpsIncidentSeverity,
  type OpsIncidentStatus,
} from '../../data/repositories/operationsModulesRepository';

const SEVERITY_LABELS: Record<OpsIncidentSeverity, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالي',
  critical: 'حرج',
};

const STATUS_LABELS: Record<OpsIncidentStatus, string> = {
  open: 'مفتوح',
  investigating: 'قيد التحقيق',
  resolved: 'محلول',
  closed: 'مغلق',
};

export default function OpsIncidents() {
  const [incidents, setIncidents] = useState<OpsIncident[]>([]);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [severity, setSeverity] = useState<OpsIncidentSeverity>('medium');

  const load = useCallback(async () => {
    setIncidents(await operationsModulesRepository.listIncidents());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await operationsModulesRepository.createIncident({
      title: title.trim(),
      description: null,
      severity,
      location: location.trim() || null,
      reported_by: reportedBy.trim() || null,
    });
    setTitle('');
    setLocation('');
    setReportedBy('');
    await load();
  }

  async function advanceStatus(id: number, current: OpsIncidentStatus) {
    const flow: OpsIncidentStatus[] = ['open', 'investigating', 'resolved', 'closed'];
    const next = flow[Math.min(flow.indexOf(current) + 1, flow.length - 1)];
    await operationsModulesRepository.updateIncidentStatus(id, next);
    await load();
  }

  return (
    <OperationsPageShell
      title="البلاغات والطوارئ"
      subtitle="تسجيل ومتابعة الحوادث والبلاغات التشغيلية"
      icon={AlertTriangle}
    >
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2">
          <form onSubmit={(e) => void handleCreate(e)} className="contents">
            <Input placeholder="عنوان البلاغ" value={title} onChange={(e) => setTitle(e.target.value)} className="md:col-span-2" />
            <Input placeholder="الموقع" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Input placeholder="المُبلّغ" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} />
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as OpsIncidentSeverity)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            >
              {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <Button type="submit" className="font-bold md:col-span-2 md:w-auto"><Plus className="h-4 w-4" /> تسجيل بلاغ</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {incidents.map((inc) => (
          <Card key={inc.id} className={inc.severity === 'critical' ? 'border-red-400/50' : undefined}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold">{inc.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {SEVERITY_LABELS[inc.severity]} · {STATUS_LABELS[inc.status]} · {inc.location ?? '—'}
                </p>
              </div>
              {inc.status !== 'closed' ? (
                <Button size="sm" variant="outline" onClick={() => void advanceStatus(inc.id, inc.status)}>
                  تقدم الحالة
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </OperationsPageShell>
  );
}
