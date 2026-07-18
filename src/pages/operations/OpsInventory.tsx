import { useCallback, useEffect, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import OperationsPageShell from '../../components/operations/OperationsPageShell';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import {
  operationsModulesRepository,
  type OpsEquipment,
} from '../../data/repositories/operationsModulesRepository';

export default function OpsInventory() {
  const [items, setItems] = useState<OpsEquipment[]>([]);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [minStock, setMinStock] = useState('0');
  const [location, setLocation] = useState('');

  const load = useCallback(async () => {
    setItems(await operationsModulesRepository.listEquipment());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await operationsModulesRepository.createEquipment({
      name: name.trim(),
      sku: sku.trim() || null,
      category: category.trim() || null,
      quantity: Number(quantity) || 0,
      min_stock: Number(minStock) || 0,
      location: location.trim() || null,
      notes: null,
    });
    setName('');
    setSku('');
    setCategory('');
    setQuantity('0');
    setMinStock('0');
    setLocation('');
    await load();
  }

  return (
    <OperationsPageShell
      title="مخزون العمليات"
      subtitle="معدات ومواد تشغيل خاصة بقسم العمليات — منفصلة عن مخزون التجهيز والتركيب"
      icon={Package}
    >
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <form onSubmit={(e) => void handleCreate(e)} className="contents">
            <Input placeholder="اسم المادة" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
            <Input placeholder="الفئة" value={category} onChange={(e) => setCategory(e.target.value)} />
            <Input type="number" min={0} placeholder="الكمية" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <Input type="number" min={0} placeholder="حد أدنى" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            <Input placeholder="الموقع" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Button type="submit" className="font-bold md:col-span-3 md:w-auto"><Plus className="h-4 w-4" /> إضافة مادة</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const low = item.quantity <= item.min_stock;
          return (
            <Card key={item.id} className={low ? 'border-amber-400/50' : undefined}>
              <CardContent className="p-4">
                <p className="font-bold">{item.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.category ?? '—'} · {item.location ?? '—'}</p>
                <p className={`mt-2 text-sm font-bold ${low ? 'text-amber-600' : 'text-cyan-700 dark:text-cyan-300'}`}>
                  الكمية: {item.quantity} (حد أدنى {item.min_stock})
                  {low ? ' · نقص' : ''}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </OperationsPageShell>
  );
}
