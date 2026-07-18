import { useCallback, useEffect, useState } from 'react';
import { Plug, Plus } from 'lucide-react';
import OperationsPageShell from '../../components/operations/OperationsPageShell';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import {
  operationsModulesRepository,
  type OpsIntegration,
  type OpsIntegrationStatus,
} from '../../data/repositories/operationsModulesRepository';

const STATUS_LABELS: Record<OpsIntegrationStatus, string> = {
  inactive: 'غير نشط',
  active: 'نشط',
  error: 'خطأ',
};

export default function OpsIntegrations() {
  const [items, setItems] = useState<OpsIntegration[]>([]);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');

  const load = useCallback(async () => {
    setItems(await operationsModulesRepository.listIntegrations());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !provider.trim()) return;
    await operationsModulesRepository.createIntegration({
      name: name.trim(),
      provider: provider.trim(),
      status: 'inactive',
    });
    setName('');
    setProvider('');
    await load();
  }

  async function toggleActive(item: OpsIntegration) {
    const next: OpsIntegrationStatus = item.status === 'active' ? 'inactive' : 'active';
    await operationsModulesRepository.updateIntegrationStatus(item.id, next);
    await load();
  }

  return (
    <OperationsPageShell
      title="التكامل"
      subtitle="ربط قسم العمليات مع أنظمة وخدمات خارجية"
      icon={Plug}
    >
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <form onSubmit={(e) => void handleCreate(e)} className="contents">
            <Input placeholder="اسم التكامل" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="المزود / النظام" value={provider} onChange={(e) => setProvider(e.target.value)} />
            <Button type="submit" className="font-bold"><Plus className="h-4 w-4" /> إضافة</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold">{item.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.provider} · {STATUS_LABELS[item.status]}
                  {item.last_sync_at ? ` · آخر مزامنة ${new Date(item.last_sync_at).toLocaleString('ar-IQ')}` : ''}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void toggleActive(item)}>
                {item.status === 'active' ? 'إيقاف' : 'تفعيل'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </OperationsPageShell>
  );
}
