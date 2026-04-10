import type { BubblesRecord } from './supabaseClient';

/** يزيل لاحقة عرض مثل (1.0h) من اسم السائق للتجميع والمطابقة مع الكادر */
const DRIVER_HOURS_SUFFIX_RE = /\s*\([\d.,]+\s*h\)\s*$/i;

export function normalizeBubblesDriverLabel(name: string): string {
  return String(name ?? '')
    .trim()
    .replace(DRIVER_HOURS_SUFFIX_RE, '')
    .trim() || '—';
}

export interface BubblesCustomerGroup {
  customer_name: string;
  items: BubblesRecord[];
}

export interface BubblesDriverGroup {
  driver_name: string;
  customers: BubblesCustomerGroup[];
}

/** تجميع: سائق → عميل → سجلات */
export function groupByDriverThenCustomer(records: BubblesRecord[]): BubblesDriverGroup[] {
  const byDriver = new Map<string, Map<string, BubblesRecord[]>>();

  for (const r of records) {
    const d = normalizeBubblesDriverLabel(r.driver_name);
    const c = (r.customer_name || '').trim() || '—';
    if (!byDriver.has(d)) byDriver.set(d, new Map());
    const cm = byDriver.get(d)!;
    if (!cm.has(c)) cm.set(c, []);
    cm.get(c)!.push(r);
  }

  const drivers: BubblesDriverGroup[] = [];
  for (const [driver_name, custMap] of byDriver) {
    const customers: BubblesCustomerGroup[] = [];
    for (const [customer_name, items] of custMap) {
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      customers.push({ customer_name, items });
    }
    customers.sort((a, b) => a.customer_name.localeCompare(b.customer_name, 'ar'));
    drivers.push({ driver_name, customers });
  }
  drivers.sort((a, b) => a.driver_name.localeCompare(b.driver_name, 'ar'));
  return drivers;
}
