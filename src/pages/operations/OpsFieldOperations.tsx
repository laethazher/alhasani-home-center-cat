import { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import OperationsPageShell from '../../components/operations/OperationsPageShell';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import {
  operationsModulesRepository,
  type OpsFieldTeam,
  type OpsFieldTeamStatus,
} from '../../data/repositories/operationsModulesRepository';

const STATUS_LABELS: Record<OpsFieldTeamStatus, string> = {
  idle: 'في القاعدة',
  deployed: 'ميداني',
  returning: 'عودة',
  offline: 'غير متصل',
};

const STATUS_CYCLE: OpsFieldTeamStatus[] = ['idle', 'deployed', 'returning', 'offline'];

export default function OpsFieldOperations() {
  const [teams, setTeams] = useState<OpsFieldTeam[]>([]);
  const [name, setName] = useState('');
  const [leader, setLeader] = useState('');
  const [location, setLocation] = useState('');

  const load = useCallback(async () => {
    setTeams(await operationsModulesRepository.listFieldTeams());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await operationsModulesRepository.createFieldTeam({
      name: name.trim(),
      leader_name: leader.trim() || null,
      location: location.trim() || null,
      status: 'idle',
      notes: null,
    });
    setName('');
    setLeader('');
    setLocation('');
    await load();
  }

  async function cycleStatus(team: OpsFieldTeam) {
    const idx = STATUS_CYCLE.indexOf(team.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    await operationsModulesRepository.updateFieldTeamStatus(team.id, next);
    await load();
  }

  return (
    <OperationsPageShell
      title="العمليات الميدانية"
      subtitle="إدارة الفرق الميدانية والمواقع والحالة التشغيلية"
      icon={MapPin}
    >
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <form onSubmit={(e) => void handleCreate(e)} className="contents">
            <Input placeholder="اسم الفريق" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="قائد الفريق" value={leader} onChange={(e) => setLeader(e.target.value)} />
            <Input placeholder="الموقع" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Button type="submit" className="font-bold"><Plus className="h-4 w-4" /> إضافة فريق</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardContent className="space-y-2 p-4">
              <p className="font-bold">{team.name}</p>
              <p className="text-sm text-muted-foreground">{team.leader_name ?? '—'} · {team.location ?? 'بدون موقع'}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                  {STATUS_LABELS[team.status]}
                </span>
                <Button size="sm" variant="outline" onClick={() => void cycleStatus(team)}>تغيير الحالة</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </OperationsPageShell>
  );
}
