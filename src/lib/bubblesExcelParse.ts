import * as XLSX from 'xlsx';
import type { BubblesRecordStatus } from './supabaseClient';

export interface BubblesInsertRow {
  driver_name: string;
  customer_name: string;
  product_type: string | null;
  quantity: number;
  invoice_number: string | null;
  location: string | null;
  cbm: number | null;
  status: BubblesRecordStatus;
}

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function matchHeader(headers: string[], ...candidates: string[]): string | undefined {
  for (const h of headers) {
    const n = norm(h);
    if (!n) continue;
    for (const c of candidates) {
      const cn = norm(c);
      if (n === cn || n.includes(cn) || cn.includes(n)) return h;
    }
  }
  return undefined;
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
}

function optNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return String(v ?? '').trim();
}

/**
 * يقرأ أول ورقة في الملف ويُرجع صفوف جاهزة للإدراج (بدون id / timestamps).
 */
export function parseBubblesExcelBuffer(buf: ArrayBuffer): {
  rows: BubblesInsertRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: ['الملف لا يحتوي على أي ورقة.'] };
  }
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (json.length === 0) {
    return { rows: [], errors: ['الورقة فارغة.'] };
  }

  const headerKeys = Object.keys(json[0]);
  const kDriver = matchHeader(headerKeys, 'driver', 'سائق', 'السائق');
  const kProduct = matchHeader(
    headerKeys,
    'الحالة',
    'product_type',
    'product type',
    'producttype',
    'type'
  );
  const kQty = matchHeader(headerKeys, 'تم الانتهاء', 'quantity', 'qty', 'الكمية', 'completed');
  const kCustomer = matchHeader(headerKeys, 'contact', 'customer', 'العميل', 'زبون');
  const kState = matchHeader(headerKeys, 'state', 'location', 'الموقع', 'المحافظة');
  const kCbm = matchHeader(headerKeys, 'logistics cbm', 'logisticscbm', 'cbm', 'الحجم');
  const kInvoice = matchHeader(
    headerKeys,
    'source document',
    'sourcedocument',
    'invoice',
    'فاتورة',
    'document'
  );

  if (!kDriver) {
    errors.push('لم يُعثر على عمود السائق (Driver).');
    return { rows: [], errors };
  }

  const rows: BubblesInsertRow[] = [];
  for (const row of json) {
    const driver_name = str(row[kDriver]);
    if (!driver_name) continue;

    rows.push({
      driver_name,
      customer_name: kCustomer ? str(row[kCustomer]) : '',
      product_type: kProduct ? str(row[kProduct]) || null : null,
      quantity: kQty ? num(row[kQty]) : 0,
      invoice_number: kInvoice ? str(row[kInvoice]) || null : null,
      location: kState ? str(row[kState]) || null : null,
      cbm: kCbm ? optNum(row[kCbm]) : null,
      status: 'pending',
    });
  }

  if (rows.length === 0) {
    errors.push('لا توجد صفوف صالحة (تأكد من عمود Driver).');
  }

  return { rows, errors };
}
