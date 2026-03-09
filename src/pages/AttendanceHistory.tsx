import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import type {
  UserProfile,
  StaffMember,
  AttendanceArchive,
  AttendanceType,
  Vehicle,
} from '../lib/supabaseClient';

const ATTENDANCE_TYPE_LABELS: Record<string, string> = {
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
  full_leave: 'إجازة كاملة',
  time_leave: 'إجازة زمنية',
};

const PAGE_SIZE = 20;

interface Props {
  profile: UserProfile | null;
}

export default function AttendanceHistory({ profile }: Props) {
  const [records, setRecords] = useState<(AttendanceArchive & { staff?: StaffMember; vehicle?: Vehicle })[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchName, setSearchName] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'driver' | 'assistant'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPayload, setEditPayload] = useState<Partial<AttendanceArchive>>({});
  const [saving, setSaving] = useState(false);

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('attendance_archive')
      .select('*', { count: 'exact' })
      .order('attendance_date', { ascending: false })
      .order('id', { ascending: false });

    if (dateFrom) query = query.gte('attendance_date', dateFrom);
    if (dateTo) query = query.lte('attendance_date', dateTo);
    if (filterType !== 'all') query = query.eq('attendance_type', filterType);

    const { data: recData, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const [staffRes, vehRes] = await Promise.all([
      supabase.from('staff_members').select('*'),
      supabase.from('vehicles').select('*'),
    ]);

    if (staffRes.data) setStaff(staffRes.data);
    if (vehRes.data) setVehicles(vehRes.data);
    if (recData) {
      const staffMap = new Map(staffRes.data?.map((s) => [Number(s.id), s]) ?? []);
      const vehMap = new Map((vehRes.data ?? []).map((v) => [v.id, v]));
      setRecords(
        recData.map((r) => ({
          ...r,
          staff: staffMap.get(r.staff_id),
          vehicle: vehMap.get(r.vehicle_id ?? 0),
        }))
      );
    }
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [dateFrom, dateTo, filterType, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const staffMap = useMemo(() => new Map(staff.map((s) => [Number(s.id), s])), [staff]);
  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const filteredRecords = useMemo(() => {
    let list = records;
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      list = list.filter((r) => r.staff?.full_name?.toLowerCase().includes(q));
    }
    if (filterRole !== 'all') {
      list = list.filter((r) => r.staff?.role === filterRole);
    }
    return list;
  }, [records, searchName, filterRole]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  useEffect(() => {
    const d = new Date();
    const toStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fromDate = new Date(d);
    fromDate.setMonth(fromDate.getMonth() - 1);
    const fromStr = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
    if (!dateFrom) setDateFrom(fromStr);
    if (!dateTo) setDateTo(toStr);
  }, []);

  const startEdit = (r: AttendanceArchive & { staff?: StaffMember; vehicle?: Vehicle }) => {
    setEditingId(r.id);
    setEditPayload({
      attendance_type: r.attendance_type,
      check_in_time: r.check_in_time,
      check_out_time: r.check_out_time,
      notes: r.notes,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPayload({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const type = (editPayload.attendance_type ?? 'present') as AttendanceType;
    if (type === 'time_leave' && (!editPayload.check_in_time || !editPayload.check_out_time)) {
      alert('يرجى إدخال وقت البداية والنهاية للإجازة الزمنية');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('attendance_archive')
        .update({
          attendance_type: editPayload.attendance_type,
          check_in_time: editPayload.check_in_time || null,
          check_out_time: editPayload.check_out_time || null,
          notes: editPayload.notes || null,
        })
        .eq('id', editingId);
      if (error) throw error;
      setEditingId(null);
      setEditPayload({});
      await fetchData();
    } catch (e) {
      alert('فشل التعديل: ' + (e instanceof Error ? e.message : 'خطأ'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-stone-500" />
          <h3 className="font-semibold">البحث والفلترة</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-stone-500 mb-1">من تاريخ</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">اسم الموظف</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="بحث..."
                className="w-full pr-10 pl-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">الدور</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as typeof filterRole)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
            >
              <option value="all">الكل</option>
              <option value="driver">سائق</option>
              <option value="assistant">مساعد سائق</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">نوع الحضور</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
            >
              <option value="all">الكل</option>
              {Object.entries(ATTENDANCE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-sm overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-stone-100 dark:bg-stone-700/50">
                    {canEdit && <th className="px-4 py-3 text-right text-sm font-semibold w-20"></th>}
                    <th className="px-4 py-3 text-right text-sm font-semibold">التاريخ</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">الموظف</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">الدور</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">نوع الحضور</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">الوقت</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">المركبة</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r, idx) => {
                    const isEditing = editingId === r.id;
                    const payload = isEditing ? editPayload : r;
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          'border-t border-stone-100 dark:border-stone-700/50',
                          idx % 2 === 0 && 'bg-stone-50/50 dark:bg-stone-800/30',
                          isEditing && 'bg-blue-50/50 dark:bg-blue-900/10'
                        )}
                      >
                        {canEdit && (
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={saveEdit}
                                  disabled={saving}
                                  className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-stone-300 dark:bg-stone-600 hover:bg-stone-400">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEdit(r)}
                                className="p-1.5 rounded-lg bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-2">{new Date(r.attendance_date).toLocaleDateString('ar-IQ')}</td>
                        <td className="px-4 py-2 font-medium">{r.staff?.full_name ?? '—'}</td>
                        <td className="px-4 py-2">{r.staff?.role === 'driver' ? 'سائق' : 'مساعد سائق'}</td>
                        <td className="px-4 py-2">
                          {isEditing ? (
                            <select
                              value={payload.attendance_type ?? 'present'}
                              onChange={(e) => setEditPayload((p) => ({ ...p, attendance_type: e.target.value as AttendanceType }))}
                              className="px-2 py-1 rounded border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
                            >
                              {Object.entries(ATTENDANCE_TYPE_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            ATTENDANCE_TYPE_LABELS[r.attendance_type] ?? r.attendance_type
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {isEditing ? (
                            (payload.attendance_type ?? 'present') === 'time_leave' ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="time"
                                  value={String(payload.check_in_time ?? '').slice(0, 5)}
                                  onChange={(e) => setEditPayload((p) => ({ ...p, check_in_time: e.target.value }))}
                                  className="px-2 py-1 rounded border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm w-24"
                                />
                                <span>→</span>
                                <input
                                  type="time"
                                  value={String(payload.check_out_time ?? '').slice(0, 5)}
                                  onChange={(e) => setEditPayload((p) => ({ ...p, check_out_time: e.target.value }))}
                                  className="px-2 py-1 rounded border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm w-24"
                                />
                              </div>
                            ) : ['present', 'late'].includes(payload.attendance_type ?? '') ? (
                              <input
                                type="time"
                                value={String(payload.check_in_time ?? '').slice(0, 5)}
                                onChange={(e) => setEditPayload((p) => ({ ...p, check_in_time: e.target.value }))}
                                className="px-2 py-1 rounded border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm w-24"
                              />
                            ) : (
                              '—'
                            )
                          ) : r.attendance_type === 'time_leave' && r.check_in_time && r.check_out_time
                            ? `${String(r.check_in_time).slice(0, 5)} → ${String(r.check_out_time).slice(0, 5)}`
                            : r.check_in_time
                              ? String(r.check_in_time).slice(0, 5)
                              : '—'}
                        </td>
                        <td className="px-4 py-2">{r.vehicle?.plate_number ?? '—'}</td>
                        <td className="px-4 py-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={payload.notes ?? ''}
                              onChange={(e) => setEditPayload((p) => ({ ...p, notes: e.target.value }))}
                              className="px-2 py-1 rounded border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm w-full max-w-[150px]"
                            />
                          ) : (
                            <span className="text-stone-600 dark:text-stone-400 max-w-[150px] truncate block">{r.notes || '—'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredRecords.length === 0 && (
              <div className="py-16 text-center text-stone-500 dark:text-stone-400">
                لا توجد سجلات مؤرشفة
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200 dark:border-stone-700">
                <p className="text-sm text-stone-500">
                  صفحة {page + 1} من {totalPages} ({totalCount} سجل)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-lg bg-stone-100 dark:bg-stone-700 disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-2 rounded-lg bg-stone-100 dark:bg-stone-700 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
