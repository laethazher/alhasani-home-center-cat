import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DoorOpen,
  Plus,
  Search,
  Check,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  LogOut as LogOutIcon,
  ChevronDown,
  Bell,
  Volume2,
  Users,
  Loader2,
  Trash2,
  History,
  ArrowRight,
  Calendar,
  AlertTriangle,
  Truck,
  RotateCcw,
  Timer,
  FileText,
  Download,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToCsv } from '../lib/excelExport';
import type {
  UserProfile,
  StaffMember,
  ExitRequest,
  ExitRequestStatus,
  ExitType,
  Vehicle,
} from '../lib/supabaseClient';

/* ── Notification Sound ── */
const playNotificationSound = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* ignore */
  }
};

/* ── Overdue Alert Sound (urgent) ── */
const playOverdueAlertSound = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    // Urgent beep pattern
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.3);
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.45);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    /* ignore */
  }
};

/* ── Overdue Helper ── */
function getOverdueInfo(req: ExitRequest, now: Date): { isOverdue: boolean; delayMinutes: number; delayText: string } | null {
  if (req.exit_type !== 'temporary' || !req.exit_duration_minutes || !req.exited_at || req.status !== 'exited') return null;
  // Check if ALL staff (driver + assistants) have returned
  const returns = req.assistant_returns || {};
  const allAssistantsReturned = req.assistant_ids.length === 0 || req.assistant_ids.every((id) => String(id) in returns);
  const driverReturned = !req.driver_id || (String(req.driver_id) in returns);
  if (allAssistantsReturned && driverReturned) return null;
  const exitedTime = new Date(req.exited_at).getTime();
  const allowedMs = req.exit_duration_minutes * 60 * 1000;
  const deadline = exitedTime + allowedMs;
  const diff = now.getTime() - deadline;
  if (diff <= 0) return { isOverdue: false, delayMinutes: 0, delayText: '' };
  const delayMinutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(delayMinutes / 60);
  const mins = delayMinutes % 60;
  let delayText = '';
  if (hours > 0) delayText = `${hours} ساعة${mins > 0 ? ` و ${mins} دقيقة` : ''}`;
  else if (mins > 0) delayText = `${mins} دقيقة`;
  else delayText = 'أقل من دقيقة';
  return { isOverdue: true, delayMinutes, delayText };
}

/* ── Date Helpers ── */
function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayLabel(dateKey: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateKey + 'T00:00:00');
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'اليوم';
  if (diffDays === 1) return 'أمس';
  if (diffDays === 2) return 'أول أمس';
  return `تاريخ ${target.toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

function groupByDate(items: ExitRequest[]): { dateKey: string; label: string; requests: ExitRequest[] }[] {
  const map = new Map<string, ExitRequest[]>();
  items.forEach((r) => {
    const key = getDateKey(r.created_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, reqs]) => ({ dateKey: key, label: getDayLabel(key), requests: reqs }));
}

/* ── Exit Reasons ── */
const EXIT_REASONS = [
  'توصيل بضاعة',
  'نقل بضاعة',
  'جلب بضاعة',
  'صيانة مركبة',
  'مهمة إدارية',
  'أخرى',
] as const;

/* ── Exit Duration Options (minutes) ── */
const EXIT_DURATION_OPTIONS = [
  { value: 5,   label: '5 دقائق' },
  { value: 10,  label: '10 دقائق' },
  { value: 15,  label: '15 دقيقة' },
  { value: 20,  label: '20 دقيقة' },
  { value: 30,  label: '30 دقيقة' },
  { value: 45,  label: '45 دقيقة' },
  { value: 60,  label: 'ساعة' },
  { value: 90,  label: 'ساعة ونص' },
  { value: 120, label: 'ساعتين' },
  { value: 180, label: '3 ساعات' },
] as const;

/* ── Duration Helper ── */
function formatDuration(from: string, to: string): string {
  const diff = new Date(to).getTime() - new Date(from).getTime();
  if (diff < 0) return '—';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours} ساعة${minutes > 0 ? ` و ${minutes} دقيقة` : ''}`;
  if (minutes > 0) return `${minutes} دقيقة`;
  return 'أقل من دقيقة';
}

/* ── Status Config ── */
const STATUS_CONFIG: Record<ExitRequestStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending:  { label: 'قيد الانتظار', color: 'text-red-600 dark:text-red-400',     bgColor: 'bg-red-100 dark:bg-red-900/30',       icon: Clock },
  approved: { label: 'تمت الموافقة', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',  icon: CheckCircle2 },
  exited:   { label: 'غادر',         color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: DoorOpen },
  rejected: { label: 'مرفوض',        color: 'text-stone-500 dark:text-stone-400',    bgColor: 'bg-stone-100 dark:bg-stone-800/30',    icon: XCircle },
};

/* ── Live Clock ── */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="text-center">
      <div className="text-3xl font-bold tabular-nums text-stone-900 dark:text-white">{timeStr}</div>
      <div className="text-sm text-stone-500 dark:text-stone-400 mt-1">{dateStr}</div>
    </div>
  );
}

/* ── Status Badge ── */
function StatusBadge({ status }: { status: ExitRequestStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold', cfg.bgColor, cfg.color)}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

/* ── Searchable Multi-Select Dropdown ── */
interface MultiSelectProps {
  label: string;
  items: StaffMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabledInfo?: Map<string, string>;
  violationCounts?: Map<string, number>;
}

function MultiSelect({ label, items, selectedIds, onChange, placeholder = 'اختر...', disabledInfo, violationCounts }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = items.filter((m) => m.full_name.includes(search));
  const selectedNames = items.filter((m) => selectedIds.includes(m.id)).map((m) => m.full_name);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm text-right',
          'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800',
          'hover:border-blue-400 dark:hover:border-blue-500 transition-colors',
          open && 'ring-2 ring-blue-500/30 border-blue-500'
        )}
      >
        <span className={cn('truncate', selectedIds.length === 0 && 'text-stone-400')}>
          {selectedIds.length > 0 ? `${selectedNames.slice(0, 2).join(' ، ')}${selectedIds.length > 2 ? ` +${selectedIds.length - 2}` : ''}` : placeholder}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-stone-400 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute z-50 mt-1 w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl max-h-60 overflow-hidden"
          >
            <div className="p-2 border-b border-stone-100 dark:border-stone-700">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-700/50">
                <Search className="w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400 text-stone-900 dark:text-white"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-44 p-1">
              {filtered.length === 0 ? (
                <div className="text-center text-sm text-stone-400 py-4">لا توجد نتائج</div>
              ) : (
                filtered.map((m) => {
                  const selected = selectedIds.includes(m.id);
                  const mIdStr = String(m.id);
                  const disabledMsg = disabledInfo?.get(mIdStr);
                  const isDisabled = !!disabledMsg;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        onChange(selected ? selectedIds.filter((id) => id !== m.id) : [...selectedIds, m.id]);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-right transition-colors',
                        isDisabled
                          ? 'opacity-60 cursor-not-allowed bg-stone-50 dark:bg-stone-800/30'
                          : selected
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'hover:bg-stone-50 dark:hover:bg-stone-700/50 text-stone-700 dark:text-stone-300'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        isDisabled ? 'bg-stone-300 dark:bg-stone-600 border-stone-300 dark:border-stone-600'
                        : selected ? 'bg-blue-600 border-blue-600' : 'border-stone-300 dark:border-stone-600'
                      )}>
                        {isDisabled && <X className="w-3 h-3 text-white" />}
                        {!isDisabled && selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(isDisabled && 'line-through text-stone-400 dark:text-stone-500')}>{m.full_name}</span>
                          {!isDisabled && violationCounts?.has(mIdStr) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {violationCounts.get(mIdStr)} مخالفة
                            </span>
                          )}
                        </div>
                        {isDisabled && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span>{disabledMsg}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Single Select Dropdown ── */
interface SingleSelectProps {
  label: string;
  items: StaffMember[];
  selectedId: string;
  onChange: (id: string, name: string) => void;
  placeholder?: string;
  disabledInfo?: Map<string, string>;
  violationCounts?: Map<string, number>;
}

function SingleSelect({ label, items, selectedId, onChange, placeholder = 'اختر...', disabledInfo, violationCounts }: SingleSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = items.filter((m) => m.full_name.includes(search));
  const selectedName = items.find((m) => String(m.id) === String(selectedId))?.full_name || '';

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm text-right',
          'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800',
          'hover:border-blue-400 dark:hover:border-blue-500 transition-colors',
          open && 'ring-2 ring-blue-500/30 border-blue-500'
        )}
      >
        <span className={cn('truncate', !selectedId && 'text-stone-400')}>{selectedName || placeholder}</span>
        <ChevronDown className={cn('w-4 h-4 text-stone-400 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute z-50 mt-1 w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl max-h-60 overflow-hidden"
          >
            <div className="p-2 border-b border-stone-100 dark:border-stone-700">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-700/50">
                <Search className="w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400 text-stone-900 dark:text-white"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-44 p-1">
              {/* Clear selection option */}
              {selectedId && (
                <button
                  type="button"
                  onClick={() => { onChange('', ''); setOpen(false); setSearch(''); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-right transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 mb-1 border-b border-stone-100 dark:border-stone-700"
                >
                  <X className="w-4 h-4" />
                  إزالة الاختيار
                </button>
              )}
              {filtered.length === 0 ? (
                <div className="text-center text-sm text-stone-400 py-4">لا توجد نتائج</div>
              ) : (
                filtered.map((m) => {
                  const mIdStr = String(m.id);
                  const disabledMsg = disabledInfo?.get(mIdStr);
                  const isDisabled = !!disabledMsg;
                  const isSelected = mIdStr === String(selectedId);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        onChange(m.id, m.full_name);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-right transition-colors',
                        isDisabled
                          ? 'opacity-60 cursor-not-allowed bg-stone-50 dark:bg-stone-800/30'
                          : isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'hover:bg-stone-50 dark:hover:bg-stone-700/50 text-stone-700 dark:text-stone-300'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(isDisabled && 'line-through text-stone-400 dark:text-stone-500')}>{m.full_name}</span>
                          {!isDisabled && violationCounts?.has(mIdStr) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {violationCounts.get(mIdStr)} مخالفة
                            </span>
                          )}
                        </div>
                        {isDisabled && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span>{disabledMsg}</span>
                          </div>
                        )}
                      </div>
                      {isSelected && !isDisabled && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════
   ██  MAIN COMPONENT
   ════════════════════════════════════════════ */

interface StaffExitProps {
  profile: UserProfile;
  userId: string;
}

export default function StaffExit({ profile, userId }: StaffExitProps) {
  const role = profile.role;
  const isAdmin = role === 'admin';
  const isGateGuard = role === 'gate_guard';

  /* ── State ── */
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [drivers, setDrivers] = useState<StaffMember[]>([]);
  const [assistants, setAssistants] = useState<StaffMember[]>([]);
  const driverMap = useMemo(() => new Map(drivers.map((d) => [String(d.id), d.full_name])), [drivers]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExitRequestStatus | 'all'>('all');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  /* Create form */
  const [showForm, setShowForm] = useState(false);
  const [formDriverId, setFormDriverId] = useState('');
  const [formDriverName, setFormDriverName] = useState('');
  const [formAssistantIds, setFormAssistantIds] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formExitReason, setFormExitReason] = useState('');
  const [formCustomReason, setFormCustomReason] = useState('');
  const [formVehicleId, setFormVehicleId] = useState<string>('');
  const [formVehiclePlate, setFormVehiclePlate] = useState('');
  const [formExitType, setFormExitType] = useState<ExitType>('permanent');
  const [formDurationMinutes, setFormDurationMinutes] = useState<number>(30);
  const [submitting, setSubmitting] = useState(false);

  /* Archive view */
  const [showArchive, setShowArchive] = useState(false);

  /* Remaining staff dropdowns */
  const [showRemainingDrivers, setShowRemainingDrivers] = useState(false);
  const [showRemainingAssistants, setShowRemainingAssistants] = useState(false);

  /* Gate guard notification */
  const prevApprovedCount = useRef(0);
  const [flashNotification, setFlashNotification] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  /* ── Live "now" ticker for overdue tracking ── */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000); // update every 10s
    return () => clearInterval(id);
  }, []);

  /* ── Overdue alert notification ── */
  const prevOverdueIdsRef = useRef<Set<string>>(new Set());
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    const currentOverdue = new Set<string>();
    for (const req of requests) {
      const info = getOverdueInfo(req, now);
      if (info?.isOverdue) currentOverdue.add(req.id);
    }
    // On initial mount, just record current overdue without playing sound
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevOverdueIdsRef.current = currentOverdue;
      return;
    }
    // Check for newly overdue
    for (const id of currentOverdue) {
      if (!prevOverdueIdsRef.current.has(id)) {
        if (soundEnabled) playOverdueAlertSound();
        break; // one alert per cycle
      }
    }
    prevOverdueIdsRef.current = currentOverdue;
  }, [requests, now, soundEnabled]);

  /* ── Fetch data ── */
  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('exit_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      // Check for new approved requests (gate guard notification)
      if (isGateGuard) {
        const approvedCount = data.filter((r: ExitRequest) => r.status === 'approved').length;
        if (approvedCount > prevApprovedCount.current && prevApprovedCount.current > 0) {
          setFlashNotification(true);
          if (soundEnabled) playNotificationSound();
          setTimeout(() => setFlashNotification(false), 3000);
        }
        prevApprovedCount.current = approvedCount;
      }
      setRequests(data);
    }
  }, [isGateGuard, soundEnabled]);

  const fetchStaff = useCallback(async () => {
    const { data } = await supabase
      .from('staff_members')
      .select('*')
      .eq('is_active', true)
      .order('full_name');
    if (data) {
      setDrivers(data.filter((m: StaffMember) => m.role === 'driver'));
      setAssistants(data.filter((m: StaffMember) => m.role === 'assistant'));
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .order('plate_number');
    if (data) setVehicles(data);
  }, []);

  useEffect(() => {
    Promise.all([fetchRequests(), fetchStaff(), fetchVehicles()]).finally(() => setLoadingData(false));
  }, [fetchRequests, fetchStaff, fetchVehicles]);

  /* Real-time subscription */
  useEffect(() => {
    const channel = supabase
      .channel('exit_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exit_requests' }, () => {
        fetchRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        // تحديث البيانات عند تغيير السائق في صفحة المركبات
        fetchVehicles();
        fetchStaff();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_members' }, () => {
        // تحديث قائمة السائقين عند أي تغيير (حذف/إضافة/تعديل)
        // تحديث المركبات أيضاً لأن التغييرات في السائقين قد تؤثر على تعيينات المركبات (مثل عمليات الدمج/الحذف)
        fetchStaff();
        fetchVehicles();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRequests, fetchVehicles, fetchStaff]);

  /* Auto-refresh for gate guard every 10s */
  useEffect(() => {
    if (!isGateGuard) return;
    const id = setInterval(fetchRequests, 10000);
    return () => clearInterval(id);
  }, [isGateGuard, fetchRequests]);

  /* ── Actions ── */
  const handleCreate = async () => {
    if (!formDriverId && formAssistantIds.length === 0) return;
    setSubmitting(true);
    const assistantNames = assistants
      .filter((a) => formAssistantIds.includes(a.id))
      .map((a) => a.full_name);

    const finalReason = formExitReason === 'أخرى' ? formCustomReason : formExitReason;

    const { data: insertedRequest, error } = await supabase.from('exit_requests').insert({
      driver_id: formDriverId || null,
      driver_name: formDriverName || '',
      assistant_ids: formAssistantIds,
      assistant_names: assistantNames,
      notes: formNotes || null,
      exit_reason: finalReason || null,
      exit_type: formExitType,
      exit_duration_minutes: formExitType === 'temporary' ? formDurationMinutes : null,
      vehicle_id: formVehicleId ? Number(formVehicleId) : null,
      vehicle_plate: formVehiclePlate || null,
      created_by: userId,
      status: 'pending',
    }).select().single();

    if (!error && insertedRequest && formVehicleId) {
      // إضافة event لإخراج المركبة في سجل المركبة
      const vehicleId = Number(formVehicleId);
      // التأكد من وجود اسم السائق - استخدام formDriverName أولاً، ثم البحث في drivers، وإلا استخدام 'غير معروف'
      // التحقق من أن formDriverName ليس undefined أو null
      let driverInfo: string = (formDriverName && typeof formDriverName === 'string' && formDriverName.trim()) ? formDriverName.trim() : '';
      if (!driverInfo && formDriverId) {
        const foundDriver = drivers.find(d => String(d.id) === String(formDriverId));
        driverInfo = (foundDriver?.full_name && typeof foundDriver.full_name === 'string') ? foundDriver.full_name : 'غير معروف';
      }
      // التأكد النهائي - إذا كان driverInfo لا يزال فارغاً أو undefined، استخدم 'غير معروف'
      if (!driverInfo || typeof driverInfo !== 'string' || driverInfo.trim() === '') {
        driverInfo = 'غير معروف';
      }
      const assistantInfo = assistantNames.length > 0 ? ` مع ${assistantNames.join('، ')}` : '';
      const exitTypeText = formExitType === 'temporary' ? `مؤقت (${formDurationMinutes} دقيقة)` : 'دائم';
      const reasonText = finalReason ? ` - ${finalReason}` : '';
      const finalDescription = `إخراج المركبة: السائق ${driverInfo}${assistantInfo} - ${exitTypeText}${reasonText}`;
      
      const { error: eventError } = await supabase.from('vehicle_events').insert({
        vehicle_id: vehicleId,
        event_type: 'vehicle_exit',
        description: finalDescription,
        old_value: null,
        new_value: `${driverInfo}${assistantInfo}`,
      });
      if (eventError) {
        console.error('فشل تسجيل حدث إخراج المركبة:', eventError.message);
      }
    }

    if (!error) {
      setShowForm(false);
      setFormDriverId('');
      setFormDriverName('');
      setFormAssistantIds([]);
      setFormNotes('');
      setFormExitReason('');
      setFormCustomReason('');
      setFormVehicleId('');
      setFormVehiclePlate('');
      setFormExitType('permanent');
      setFormDurationMinutes(30);
      await fetchRequests();
    }
    setSubmitting(false);
  };

  const handleApprove = async (id: string) => {
    await supabase
      .from('exit_requests')
      .update({ status: 'approved', approved_by: userId, approved_at: new Date().toISOString() })
      .eq('id', id);
    await fetchRequests();
  };

  const handleReject = async (id: string) => {
    await supabase
      .from('exit_requests')
      .update({ status: 'rejected', approved_by: userId, approved_at: new Date().toISOString() })
      .eq('id', id);
    await fetchRequests();
  };

  const handleConfirmExit = async (id: string) => {
    await supabase
      .from('exit_requests')
      .update({ status: 'exited', gate_guard_id: userId, exited_at: new Date().toISOString() })
      .eq('id', id);
    await fetchRequests();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('exit_requests').delete().eq('id', id);
    await fetchRequests();
  };

  const handleConfirmReturn = async (requestId: string, staffId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;
    const currentReturns = request.assistant_returns || {};
    const updatedReturns = { ...currentReturns, [String(staffId)]: new Date().toISOString() };
    await supabase
      .from('exit_requests')
      .update({ assistant_returns: updatedReturns })
      .eq('id', requestId);
    await fetchRequests();
  };

  /* ── Export Functions ── */
  const getExportData = (reqs: ExitRequest[]) => reqs.map((r) => ({
    'الحالة': STATUS_CONFIG[r.status].label,
    'نوع الخروج': r.exit_type === 'temporary' ? `مؤقت (${r.exit_duration_minutes || ''} دقيقة)` : 'دائم',
    'السائق': driverMap.get(String(r.driver_id)) || r.driver_name || '—',
    'المساعدين': r.assistant_names.join(' ، ') || 'لا يوجد',
    'سبب الخروج': r.exit_reason || '—',
    'المركبة': r.vehicle_plate || '—',
    'ملاحظات': r.notes || '—',
    'تاريخ الإنشاء': new Date(r.created_at).toLocaleString('ar-IQ'),
    'تاريخ المغادرة': r.exited_at ? new Date(r.exited_at).toLocaleString('ar-IQ') : '—',
  }));

  const exportExcel = (reqs: ExitRequest[], filename: string) => {
    const data = getExportData(reqs);
    const headers = Object.keys(data[0] || {});
    const rows = data.map((row) => headers.map((h) => row[h as keyof typeof row]));
    exportToCsv([headers, ...rows], `${filename}.csv`);
  };

  const exportPDF = async (reqs: ExitRequest[], filename: string) => {
    const headers = ['الحالة', 'السائق', 'المساعدين', 'سبب الخروج', 'المركبة', 'تاريخ الإنشاء', 'تاريخ المغادرة'];
    let html = `<h1 style="text-align:center;font-size:20px;margin-bottom:16px">إخراجات الكادر</h1>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:#10b981;color:#fff">
          ${headers.map((h) => `<th style="padding:6px 8px;text-align:right">${h}</th>`).join('')}
        </tr></thead><tbody>`;
    for (let i = 0; i < reqs.length; i++) {
      const r = reqs[i];
      const bg = i % 2 === 0 ? 'background:#f8fafc' : '';
      html += `<tr style="${bg}">
        <td style="padding:6px 8px;border:1px solid #ddd">${STATUS_CONFIG[r.status].label}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${driverMap.get(String(r.driver_id)) || r.driver_name || '—'}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${r.assistant_names.join(' ، ') || 'لا يوجد'}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${r.exit_reason || '—'}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${r.vehicle_plate || '—'}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${new Date(r.created_at).toLocaleString('ar-IQ')}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${r.exited_at ? new Date(r.exited_at).toLocaleString('ar-IQ') : '—'}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    try {
      await exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `${filename}.pdf`);
    } catch (e) {
      console.error(e);
      alert('فشل تصدير PDF: ' + (e instanceof Error ? e.message : 'خطأ غير معروف'));
    }
  };

  /* ── Split today vs archive ── */
  const todayKey = getTodayKey();
  const todayRequests = requests.filter((r) => getDateKey(r.created_at) === todayKey);

  /* ── Compute used staff for today (exclude rejected) ── */
  const usedStaffInfo = useMemo(() => {
    const map = new Map<string, string>();
    const activeToday = todayRequests.filter((r) => r.status !== 'rejected');
    for (const req of activeToday) {
      const d = new Date(req.created_at);
      const time = d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      const date = d.toLocaleDateString('ar-IQ');
      // Mark driver as used (if present) – String() ensures consistent key type
      if (req.driver_id && !map.has(String(req.driver_id))) {
        map.set(String(req.driver_id), `خرج بتاريخ ${date} الساعة ${time}`);
      }
      // Mark each assistant as used
      for (let i = 0; i < req.assistant_ids.length; i++) {
        const aId = String(req.assistant_ids[i]);
        if (!map.has(aId)) {
          const curDriver = driverMap.get(String(req.driver_id)) || req.driver_name || '';
          const withDriver = curDriver ? ` مع السائق ${curDriver}` : '';
          map.set(aId, `خرج${withDriver} بتاريخ ${date} الساعة ${time}`);
        }
      }
    }
    return map;
  }, [todayRequests]);
  /* ── Compute violation counts per staff ── */
  const violationCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const req of requests) {
      if (req.exit_type !== 'temporary' || !req.exited_at || !req.exit_duration_minutes || req.status !== 'exited') continue;
      const exitedTime = new Date(req.exited_at).getTime();
      const deadline = exitedTime + req.exit_duration_minutes * 60 * 1000;
      const now = Date.now();
      // Check assistants
      for (const aId of req.assistant_ids) {
        const returns = req.assistant_returns || {};
        const returnedAt = returns[String(aId)];
        if (returnedAt) {
          if (new Date(returnedAt).getTime() > deadline) map.set(String(aId), (map.get(String(aId)) || 0) + 1);
        } else {
          if (now > deadline) map.set(String(aId), (map.get(String(aId)) || 0) + 1);
        }
      }
      // Check driver
      if (req.driver_id) {
        const dId = String(req.driver_id);
        const returns = req.assistant_returns || {};
        const driverReturnedAt = returns[dId];
        if (driverReturnedAt) {
          if (new Date(driverReturnedAt).getTime() > deadline) map.set(dId, (map.get(dId) || 0) + 1);
        } else {
          if (now > deadline) map.set(dId, (map.get(dId) || 0) + 1);
        }
      }
    }
    return map;
  }, [requests]);

  const archiveRequests = requests.filter((r) => getDateKey(r.created_at) !== todayKey);
  const archiveGroups = groupByDate(archiveRequests);

  /* ── Filtered requests (today only) ── */
  const filtered = todayRequests.filter((r) => {
    // Gate guard sees approved + exited (with unconfirmed returns)
    if (isGateGuard) {
      if (r.status === 'approved') { /* show */ }
      else if (r.status === 'exited') {
        if (r.exit_type !== 'temporary') return false;
        const returns = r.assistant_returns || {};
        const allAssistantsReturned = r.assistant_ids.length === 0 || r.assistant_ids.every((id) => String(id) in returns);
        const driverReturned = !r.driver_id || (String(r.driver_id) in returns);
        if (allAssistantsReturned && driverReturned) return false;
      } else {
        return false;
      }
    }
    // Status filter
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (driverMap.get(String(r.driver_id)) || r.driver_name || '').toLowerCase().includes(term) ||
        r.assistant_names.some((n) => n.toLowerCase().includes(term)) ||
        (r.notes?.toLowerCase().includes(term) ?? false)
      );
    }
    return true;
  });

  /* ── Filter archive by search ── */
  const filteredArchiveGroups = archiveGroups.map((g) => ({
    ...g,
    requests: g.requests.filter((r) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          (driverMap.get(String(r.driver_id)) || r.driver_name || '').toLowerCase().includes(term) ||
          r.assistant_names.some((n) => n.toLowerCase().includes(term)) ||
          (r.notes?.toLowerCase().includes(term) ?? false)
        );
      }
      return true;
    }),
  })).filter((g) => g.requests.length > 0);

  /* ── Stats (today only) ── */
  const stats = {
    pending: todayRequests.filter((r) => r.status === 'pending').length,
    approved: todayRequests.filter((r) => r.status === 'approved').length,
    exited: todayRequests.filter((r) => r.status === 'exited').length,
    rejected: todayRequests.filter((r) => r.status === 'rejected').length,
  };

  /* ── Remaining staff (not exited today) ── */
  const remainingDrivers = useMemo(() => {
    return drivers.filter((d) => !usedStaffInfo.has(String(d.id)));
  }, [drivers, usedStaffInfo]);

  const remainingAssistants = useMemo(() => {
    return assistants.filter((a) => !usedStaffInfo.has(String(a.id)));
  }, [assistants, usedStaffInfo]);

  const selectedDriverDisplayName = useMemo(() => {
    if (typeof formDriverName === 'string' && formDriverName.trim()) {
      return formDriverName.trim();
    }
    if (!formDriverId) return '';
    return drivers.find((d) => String(d.id) === String(formDriverId))?.full_name || '';
  }, [formDriverId, formDriverName, drivers]);

  const linkedVehicle = useMemo(() => {
    if (formVehicleId) {
      return vehicles.find((v) => String(v.id) === String(formVehicleId)) || null;
    }
    if (!formDriverId) return null;
    return vehicles.find((v) => String(v.assigned_driver_id) === String(formDriverId)) || null;
  }, [formDriverId, formVehicleId, vehicles]);

  const linkedVehicleLabel = linkedVehicle
    ? `${linkedVehicle.plate_number}${linkedVehicle.vehicle_type ? ` - ${linkedVehicle.vehicle_type}` : ''}`
    : formVehiclePlate;

  /* ── Loading ── */
  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <DoorOpen className="w-5 h-5 text-white" />
            </div>
            {isGateGuard ? 'بوابة الخروج' : 'إخراج الكادر'}
          </h2>
          <p className="text-stone-500 dark:text-stone-400 mt-1">
            {isGateGuard ? 'تأكيد مغادرة الكوادر المعتمدة' : 'إنشاء وإدارة طلبات خروج الكوادر'}
          </p>
        </div>

        <LiveClock />
      </div>

      {/* ── Archive Toggle & Export Buttons ── */}
      {!isGateGuard && (
        <div className="flex flex-wrap gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowArchive(!showArchive)}
          className={cn(
            'w-full sm:w-auto flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all',
            showArchive
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
              : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
          )}
        >
          {showArchive ? (
            <><ArrowRight className="w-5 h-5" /> العودة لإخراجات اليوم</>
          ) : (
            <><History className="w-5 h-5" /> سجل إخراجات الكادر {archiveRequests.length > 0 && <span className="bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 px-2 py-0.5 rounded-full text-xs">{archiveRequests.length}</span>}</>
          )}
        </motion.button>

        {/* Export Buttons */}
        {isAdmin && (
          <>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const data = showArchive ? archiveRequests : todayRequests;
                const name = showArchive ? 'سجل_الإخراجات' : `إخراجات_اليوم_${todayKey}`;
                exportExcel(data, name);
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all"
            >
              <Download className="w-4 h-4" />
              تصدير Excel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const data = showArchive ? archiveRequests : todayRequests;
                const name = showArchive ? 'سجل_الإخراجات' : `إخراجات_اليوم_${todayKey}`;
                exportPDF(data, name);
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 font-medium text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
            >
              <Download className="w-4 h-4" />
              تصدير PDF
            </motion.button>
          </>
        )}
        </div>
      )}

      {/* ── Gate Guard Notification Flash ── */}
      <AnimatePresence>
        {flashNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white p-4 rounded-2xl shadow-lg flex items-center gap-3"
          >
            <Bell className="w-6 h-6 animate-bounce" />
            <span className="font-bold text-lg">طلب خروج جديد يحتاج تأكيدك!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats Cards ── */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'قيد الانتظار', value: stats.pending,  color: 'from-red-500 to-rose-600' },
            { label: 'تمت الموافقة', value: stats.approved, color: 'from-yellow-500 to-amber-600' },
            { label: 'غادر',         value: stats.exited,   color: 'from-emerald-500 to-teal-600' },
            { label: 'مرفوض',        value: stats.rejected, color: 'from-stone-400 to-stone-500' },
          ].map((s) => (
            <motion.div
              key={s.label}
              whileHover={{ y: -2 }}
              className="bg-white dark:bg-stone-900 rounded-2xl p-4 shadow-sm border border-stone-200 dark:border-stone-800"
            >
              <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3', s.color)}>
                <span className="text-lg font-bold text-white">{s.value}</span>
              </div>
              <p className="text-sm font-medium text-stone-600 dark:text-stone-400">{s.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Remaining Staff Cards ── */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-3">
          {/* Remaining Assistants */}
          <div className="relative">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setShowRemainingAssistants(!showRemainingAssistants); setShowRemainingDrivers(false); }}
              className={cn(
                'w-full flex items-center justify-between p-3 rounded-xl border transition-all',
                showRemainingAssistants
                  ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 shadow-md'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:shadow-sm'
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-stone-500 dark:text-stone-400">متبقي المساعدين</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{remainingAssistants.length}<span className="text-xs font-normal text-stone-400">/{assistants.length}</span></p>
                </div>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-stone-400 transition-transform', showRemainingAssistants && 'rotate-180')} />
            </motion.button>

            <AnimatePresence>
              {showRemainingAssistants && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="absolute z-30 left-0 right-0 mt-2 bg-white dark:bg-stone-900 rounded-xl border border-purple-200 dark:border-purple-800 shadow-xl overflow-hidden"
                >
                  <div className="p-2 border-b border-stone-100 dark:border-stone-800">
                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 text-center">المساعدين المتواجدين ({remainingAssistants.length})</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {remainingAssistants.length === 0 ? (
                      <p className="text-xs text-stone-400 text-center py-4">جميع المساعدين غادروا</p>
                    ) : (
                      remainingAssistants.map((a, i) => (
                        <div key={a.id} className={cn(
                          'flex items-center gap-2 px-3 py-2 text-xs',
                          i % 2 === 0 ? 'bg-stone-50/50 dark:bg-stone-800/30' : ''
                        )}>
                          <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-[10px] font-bold text-purple-600 dark:text-purple-400">{i + 1}</div>
                          <span className="text-stone-700 dark:text-stone-300">{a.full_name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Remaining Drivers */}
          <div className="relative">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setShowRemainingDrivers(!showRemainingDrivers); setShowRemainingAssistants(false); }}
              className={cn(
                'w-full flex items-center justify-between p-3 rounded-xl border transition-all',
                showRemainingDrivers
                  ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700 shadow-md'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:shadow-sm'
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-stone-500 dark:text-stone-400">متبقي السائقين</p>
                  <p className="text-lg font-bold text-sky-600 dark:text-sky-400">{remainingDrivers.length}<span className="text-xs font-normal text-stone-400">/{drivers.length}</span></p>
                </div>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-stone-400 transition-transform', showRemainingDrivers && 'rotate-180')} />
            </motion.button>

            <AnimatePresence>
              {showRemainingDrivers && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="absolute z-30 left-0 right-0 mt-2 bg-white dark:bg-stone-900 rounded-xl border border-sky-200 dark:border-sky-800 shadow-xl overflow-hidden"
                >
                  <div className="p-2 border-b border-stone-100 dark:border-stone-800">
                    <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 text-center">السائقين المتواجدين ({remainingDrivers.length})</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {remainingDrivers.length === 0 ? (
                      <p className="text-xs text-stone-400 text-center py-4">جميع السائقين غادروا</p>
                    ) : (
                      remainingDrivers.map((d, i) => (
                        <div key={d.id} className={cn(
                          'flex items-center gap-2 px-3 py-2 text-xs',
                          i % 2 === 0 ? 'bg-stone-50/50 dark:bg-stone-800/30' : ''
                        )}>
                          <div className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center text-[10px] font-bold text-sky-600 dark:text-sky-400">{i + 1}</div>
                          <span className="text-stone-700 dark:text-stone-300">{d.full_name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Search & Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم أو الملاحظات..."
            className="w-full pr-10 pl-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all text-stone-900 dark:text-white placeholder:text-stone-400"
          />
        </div>

        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'approved', 'exited', 'rejected'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                  statusFilter === s
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700'
                )}
              >
                {s === 'all' ? 'الكل' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        )}

        {isGateGuard && (
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
              soundEnabled
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
            )}
          >
            <Volume2 className="w-4 h-4" />
            {soundEnabled ? 'الصوت مفعل' : 'الصوت مغلق'}
          </button>
        )}
      </div>

      {/* ── Create New Request (Admin) ── */}
      {isAdmin && (
        <div>
          {!showForm ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowForm(true)}
              className="w-full sm:w-auto flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all"
            >
              <Plus className="w-5 h-5" />
              إنشاء طلب خروج جديد
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-stone-900 rounded-2xl p-6 shadow-lg border border-stone-200 dark:border-stone-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-500" />
                  طلب خروج جديد
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>

              {/* ── Exit Type Toggle ── */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">نوع الخروج</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormExitType('permanent')}
                    className={cn(
                      'flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 text-sm font-bold transition-all',
                      formExitType === 'permanent'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-md shadow-blue-600/10'
                        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                    )}
                  >
                    <DoorOpen className="w-5 h-5" />
                    خروج دائم
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormExitType('temporary')}
                    className={cn(
                      'flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 text-sm font-bold transition-all',
                      formExitType === 'temporary'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 shadow-md shadow-amber-500/10'
                        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                    )}
                  >
                    <Timer className="w-5 h-5" />
                    خروج مؤقت
                  </button>
                </div>

                {/* Duration Selector (only for temporary) */}
                <AnimatePresence>
                  {formExitType === 'temporary' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">
                          <Clock className="w-3.5 h-3.5 inline ml-1" />
                          مدة الخروج
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {EXIT_DURATION_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setFormDurationMinutes(opt.value)}
                              className={cn(
                                'px-3 py-2 rounded-lg text-xs font-semibold transition-all',
                                formDurationMinutes === opt.value
                                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <SingleSelect
                  label="السائق (اختياري)"
                  items={drivers}
                  selectedId={formDriverId}
                  onChange={(id, name) => {
                      const idStr = String(id || '');
                      setFormDriverId(idStr);
                      setFormDriverName(name);
                      // ربط المركبة تلقائياً من جدول vehicles (نفس المصدر: تغيير السائق من صفحة المركبات ينعكس هنا)
                      if (idStr) {
                        const v = vehicles.find((vv) => {
                          if (vv.assigned_driver_id == null) return false;
                          return String(vv.assigned_driver_id) === idStr || vv.assigned_driver_id === Number(idStr);
                        });
                        if (v) {
                          setFormVehicleId(String(v.id));
                          setFormVehiclePlate(`${v.plate_number}${v.vehicle_type ? ' - ' + v.vehicle_type : ''}`);
                        } else {
                          setFormVehicleId('');
                          setFormVehiclePlate('');
                        }
                      } else {
                        setFormVehicleId('');
                        setFormVehiclePlate('');
                      }
                  }}
                  placeholder="اختر السائق أو اتركه فارغاً..."
                  disabledInfo={usedStaffInfo}
                  violationCounts={violationCounts}
                />
                <MultiSelect
                  label="المساعدين"
                  items={assistants}
                  selectedIds={formAssistantIds}
                  onChange={setFormAssistantIds}
                  placeholder="اختر المساعدين..."
                  disabledInfo={usedStaffInfo}
                  violationCounts={violationCounts}
                />
              </div>

              {(selectedDriverDisplayName || linkedVehicleLabel) && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-900/20 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                      <Users className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">السائق المختار</p>
                      <p className="truncate text-sm font-bold text-stone-900 dark:text-white">
                        {selectedDriverDisplayName || 'لم يتم اختيار سائق'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-900/20 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
                      <Truck className="w-5 h-5 text-blue-700 dark:text-blue-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">رقم المركبة المرتبط</p>
                      <p className="truncate text-sm font-bold text-stone-900 dark:text-white">
                        {linkedVehicleLabel || 'لا توجد مركبة مرتبطة بهذا السائق'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Exit Reason & Vehicle */}
              <div className="grid md:grid-cols-2 gap-6 mt-4">
                {/* Exit Reason */}
                <div>
                  <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    <FileText className="w-4 h-4 inline ml-1" />
                    سبب الخروج
                  </label>
                  <select
                    value={formExitReason}
                    onChange={(e) => setFormExitReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-stone-900 dark:text-white"
                  >
                    <option value="">اختر السبب...</option>
                    {EXIT_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {formExitReason === 'أخرى' && (
                    <input
                      type="text"
                      value={formCustomReason}
                      onChange={(e) => setFormCustomReason(e.target.value)}
                      placeholder="اكتب السبب..."
                      className="w-full mt-2 px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-stone-900 dark:text-white placeholder:text-stone-400"
                    />
                  )}
                </div>

                {/* Vehicle Selector */}
                <div>
                  <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    <Truck className="w-4 h-4 inline ml-1" />
                    المركبة
                  </label>
                  <select
                    value={formVehicleId}
                    onChange={(e) => {
                      const vId = e.target.value;
                      setFormVehicleId(vId);
                      const v = vehicles.find((v) => String(v.id) === vId);
                      setFormVehiclePlate(v ? `${v.plate_number}${v.vehicle_type ? ' - ' + v.vehicle_type : ''}` : '');
                      // ربط السائق تلقائياً من vehicles.assigned_driver_id (متزامن مع صفحة المركبات)
                      if (v && v.assigned_driver_id) {
                        setFormDriverId(String(v.assigned_driver_id));
                        const driver = drivers.find((d) => String(d.id) === String(v.assigned_driver_id));
                        setFormDriverName(driver ? driver.full_name : '');
                      } else {
                        setFormDriverId('');
                        setFormDriverName('');
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-stone-900 dark:text-white"
                  >
                    <option value="">اختر المركبة...</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={String(v.id)}>
                        {(() => {
                          const parts = v.plate_number.trim().split(' ');
                          return (
                            <>
                              <span style={{fontWeight:'bold'}}>{parts[0]}</span>
                              <span style={{color:'#2563eb',fontWeight:'bold',margin:'0 4px'}}>{parts[1]}</span>
                              <span style={{color:'#9333ea',fontWeight:'bold'}}>{parts[2]}</span>
                              {v.vehicle_type ? ` - ${v.vehicle_type}` : ''}
                            </>
                          );
                        })()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">ملاحظات (اختياري)</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none text-stone-900 dark:text-white placeholder:text-stone-400"
                  placeholder="أي ملاحظات إضافية..."
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  إلغاء
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreate}
                  disabled={!formDriverId && formAssistantIds.length === 0 || submitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  إنشاء الطلب
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ── ARCHIVE VIEW ── */}
      {showArchive && !isGateGuard && (
        <div className="space-y-6">
          {filteredArchiveGroups.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-stone-100 dark:bg-stone-800/50 flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-stone-400" />
              </div>
              <p className="text-stone-500 dark:text-stone-400 font-medium">لا توجد سجلات سابقة</p>
            </div>
          ) : (
            filteredArchiveGroups.map((group) => (
              <div key={group.dateKey} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white">{group.label}</h3>
                  <span className="bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 px-2.5 py-0.5 rounded-full text-xs font-medium">{group.requests.length} طلب</span>
                </div>
                {group.requests.map((req, index) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      'bg-white dark:bg-stone-900 rounded-2xl p-5 shadow-sm border transition-all',
                      req.status === 'pending' && 'border-red-200 dark:border-red-900/50',
                      req.status === 'approved' && 'border-yellow-200 dark:border-yellow-900/50',
                      req.status === 'exited' && 'border-emerald-200 dark:border-emerald-900/50',
                      req.status === 'rejected' && 'border-stone-200 dark:border-stone-800',
                    )}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <StatusBadge status={req.status} />
                          {req.exit_type === 'temporary' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                              <Timer className="w-3 h-3" />
                              مؤقت {req.exit_duration_minutes ? `(${req.exit_duration_minutes} دقيقة)` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                              <DoorOpen className="w-3 h-3" />
                              دائم
                            </span>
                          )}
                          <span className="text-xs text-stone-400">
                            {new Date(req.created_at).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {(driverMap.get(String(req.driver_id)) || req.driver_name) && (
                          <div>
                            <span className="text-xs text-stone-500 dark:text-stone-400">السائق</span>
                            <p className="font-semibold text-stone-900 dark:text-white">{driverMap.get(String(req.driver_id)) || req.driver_name}</p>
                          </div>
                          )}
                          <div>
                            <span className="text-xs text-stone-500 dark:text-stone-400">المساعدين ({req.assistant_names.length})</span>
                            <p className="text-sm text-stone-700 dark:text-stone-300">{req.assistant_names.length > 0 ? req.assistant_names.join(' ، ') : 'لا يوجد'}</p>
                          </div>
                        </div>
                        {(req.exit_reason || req.vehicle_plate) && (
                          <div className="flex flex-wrap gap-2">
                            {req.exit_reason && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                                <FileText className="w-3 h-3" />
                                {req.exit_reason}
                              </span>
                            )}
                            {req.vehicle_plate && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                                <Truck className="w-3 h-3" />
                                {req.vehicle_plate}
                              </span>
                            )}
                          </div>
                        )}
                        {req.notes && (
                          <div className="text-sm text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 px-3 py-2 rounded-lg">
                            <span className="text-xs font-medium text-stone-400">ملاحظات:</span> {req.notes}
                          </div>
                        )}
                        {req.exited_at && (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            غادر بتاريخ: {new Date(req.exited_at).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        )}
                        {/* Archive: show return summary — temporary only */}
                        {req.status === 'exited' && req.exit_type === 'temporary' && req.assistant_returns && Object.keys(req.assistant_returns).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {/* Driver return badge */}
                            {req.driver_id && (() => {
                              const returnedAt = (req.assistant_returns || {})[String(req.driver_id)];
                              return (
                                <span className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                                  returnedAt
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                                )}>
                                  {returnedAt ? <CheckCircle2 className="w-3 h-3" /> : <Timer className="w-3 h-3" />}
                                  {driverMap.get(String(req.driver_id)) || req.driver_name} (سائق)
                                  {returnedAt && req.exited_at && ` (${formatDuration(req.exited_at, returnedAt)})`}
                                </span>
                              );
                            })()}
                            {/* Assistant return badges */}
                            {req.assistant_ids.map((aId, i) => {
                              const aName = req.assistant_names[i] || 'مساعد';
                              const returnedAt = (req.assistant_returns || {})[String(aId)];
                              return (
                                <span key={aId} className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                                  returnedAt
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                                )}>
                                  {returnedAt ? <CheckCircle2 className="w-3 h-3" /> : <Timer className="w-3 h-3" />}
                                  {aName}
                                  {returnedAt && req.exited_at && ` (${formatDuration(req.exited_at, returnedAt)})`}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDelete(req.id)}
                          className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TODAY Requests List ── */}
      {!showArchive && (
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 dark:bg-stone-800/50 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-stone-400" />
            </div>
            <p className="text-stone-500 dark:text-stone-400 font-medium">
              {isGateGuard ? 'لا توجد طلبات خروج معتمدة حالياً' : 'لا توجد طلبات خروج لليوم'}
            </p>
          </div>
        ) : (
          filtered.map((req, index) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'bg-white dark:bg-stone-900 rounded-2xl p-5 shadow-sm border transition-all',
                req.status === 'pending' && 'border-red-200 dark:border-red-900/50',
                req.status === 'approved' && 'border-yellow-200 dark:border-yellow-900/50',
                req.status === 'exited' && !getOverdueInfo(req, now)?.isOverdue && 'border-emerald-200 dark:border-emerald-900/50',
                req.status === 'rejected' && 'border-stone-200 dark:border-stone-800',
                isGateGuard && req.status === 'approved' && 'ring-2 ring-yellow-400/50 dark:ring-yellow-500/30',
                getOverdueInfo(req, now)?.isOverdue && 'border-red-400 dark:border-red-700 ring-2 ring-red-300/50 dark:ring-red-800/50 bg-red-50/30 dark:bg-red-950/20',
              )}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                {/* Info */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={req.status} />
                    {req.exit_type === 'temporary' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        <Timer className="w-3 h-3" />
                        مؤقت {req.exit_duration_minutes ? `(${req.exit_duration_minutes} دقيقة)` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        <DoorOpen className="w-3 h-3" />
                        دائم
                      </span>
                    )}
                    <span className="text-xs text-stone-400">
                      {new Date(req.created_at).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>

                  {/* ── Overdue Alert Banner ── */}
                  {(() => {
                    const overdueInfo = getOverdueInfo(req, now);
                    if (!overdueInfo?.isOverdue) return null;
                    return (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800"
                      >
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/40 flex-shrink-0">
                          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-red-700 dark:text-red-300">تجاوز وقت الخروج المحدد!</p>
                          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                            مدة التأخير: <span className="font-bold">{overdueInfo.delayText}</span>
                          </p>
                        </div>
                      </motion.div>
                    );
                  })()}

                  <div className="grid sm:grid-cols-2 gap-3">
                    {(driverMap.get(String(req.driver_id)) || req.driver_name) && (
                    <div>
                      <span className="text-xs text-stone-500 dark:text-stone-400">السائق</span>
                      <p className="font-semibold text-stone-900 dark:text-white">{driverMap.get(String(req.driver_id)) || req.driver_name}</p>
                    </div>
                    )}
                    <div>
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        المساعدين ({req.assistant_names.length})
                      </span>
                      <p className="text-sm text-stone-700 dark:text-stone-300">
                        {req.assistant_names.length > 0 ? req.assistant_names.join(' ، ') : 'لا يوجد'}
                      </p>
                    </div>
                  </div>

                  {/* Exit Reason & Vehicle */}
                  {(req.exit_reason || req.vehicle_plate) && (
                    <div className="flex flex-wrap gap-3">
                      {req.exit_reason && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                          <FileText className="w-3 h-3" />
                          {req.exit_reason}
                        </span>
                      )}
                      {req.vehicle_plate && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                          <Truck className="w-3 h-3" />
                          {req.vehicle_plate}
                        </span>
                      )}
                    </div>
                  )}

                  {req.notes && (
                    <div className="text-sm text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 px-3 py-2 rounded-lg">
                      <span className="text-xs font-medium text-stone-400">ملاحظات:</span> {req.notes}
                    </div>
                  )}

                  {req.exited_at && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      غادر بتاريخ: {new Date(req.exited_at).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  )}

                  {/* ── Assistant Return Confirmation (Gate Guard + Admin view) — temporary only ── */}
                  {req.status === 'exited' && req.exit_type === 'temporary' && (req.driver_id || req.assistant_ids.length > 0) && (
                    <div className={cn(
                      'mt-3 p-3 rounded-xl border',
                      getOverdueInfo(req, now)?.isOverdue
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                        : 'bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700'
                    )}>
                      <p className={cn(
                        'text-xs font-semibold mb-2 flex items-center gap-1.5',
                        getOverdueInfo(req, now)?.isOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-stone-600 dark:text-stone-400'
                      )}>
                        <RotateCcw className="w-3.5 h-3.5" />
                        تأكيد العودة
                      </p>
                      <div className="space-y-2">
                        {/* Driver return confirmation */}
                        {req.driver_id && (() => {
                          const returns = req.assistant_returns || {};
                          const returnedAt = returns[String(req.driver_id)];
                          const hasReturned = !!returnedAt;
                          const overdueNow = !hasReturned ? getOverdueInfo(req, now) : null;
                          const isDriverOverdue = overdueNow?.isOverdue;
                          return (
                            <div className={cn(
                              'flex items-center justify-between gap-3 px-3 py-2 rounded-lg',
                              hasReturned
                                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                : isDriverOverdue
                                  ? 'bg-red-50 dark:bg-red-900/20'
                                  : 'bg-amber-50 dark:bg-amber-900/20'
                            )}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {hasReturned ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                ) : isDriverOverdue ? (
                                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 animate-pulse" />
                                ) : (
                                  <Timer className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 animate-pulse" />
                                )}
                                <span className={cn(
                                  'text-sm font-medium truncate',
                                  hasReturned ? 'text-emerald-800 dark:text-emerald-300'
                                    : isDriverOverdue ? 'text-red-800 dark:text-red-300'
                                    : 'text-amber-800 dark:text-amber-300'
                                )}>
                                  {req.driver_name} <span className="text-xs opacity-70">(سائق)</span>
                                </span>
                                {hasReturned && req.exited_at && (
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                    ({formatDuration(req.exited_at, returnedAt)})
                                  </span>
                                )}
                                {!hasReturned && req.exited_at && (
                                  <span className={cn(
                                    'text-xs flex-shrink-0',
                                    isDriverOverdue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-amber-600 dark:text-amber-400'
                                  )}>
                                    {isDriverOverdue
                                      ? `متأخر — ${overdueNow.delayText}`
                                      : `مازال خارج — ${formatDuration(req.exited_at, now.toISOString())}`
                                    }
                                  </span>
                                )}
                              </div>
                              {!hasReturned && isGateGuard && (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleConfirmReturn(req.id, req.driver_id!)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-sm flex-shrink-0"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  تأكيد العودة
                                </motion.button>
                              )}
                            </div>
                          );
                        })()}
                        {/* Assistant return confirmations */}
                        {req.assistant_ids.map((aId, i) => {
                          const aName = req.assistant_names[i] || 'مساعد';
                          const returns = req.assistant_returns || {};
                          const returnedAt = returns[String(aId)];
                          const hasReturned = !!returnedAt;
                          const overdueNow = !hasReturned ? getOverdueInfo(req, now) : null;
                          const isAssistantOverdue = overdueNow?.isOverdue;

                          return (
                            <div key={aId} className={cn(
                              'flex items-center justify-between gap-3 px-3 py-2 rounded-lg',
                              hasReturned
                                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                : isAssistantOverdue
                                  ? 'bg-red-50 dark:bg-red-900/20'
                                  : 'bg-amber-50 dark:bg-amber-900/20'
                            )}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {hasReturned ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                ) : isAssistantOverdue ? (
                                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 animate-pulse" />
                                ) : (
                                  <Timer className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 animate-pulse" />
                                )}
                                <span className={cn(
                                  'text-sm font-medium truncate',
                                  hasReturned ? 'text-emerald-800 dark:text-emerald-300'
                                    : isAssistantOverdue ? 'text-red-800 dark:text-red-300'
                                    : 'text-amber-800 dark:text-amber-300'
                                )}>
                                  {aName}
                                </span>
                                {hasReturned && req.exited_at && (
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                    ({formatDuration(req.exited_at, returnedAt)})
                                  </span>
                                )}
                                {!hasReturned && req.exited_at && (
                                  <span className={cn(
                                    'text-xs flex-shrink-0',
                                    isAssistantOverdue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-amber-600 dark:text-amber-400'
                                  )}>
                                    {isAssistantOverdue
                                      ? `متأخر — ${overdueNow.delayText}` 
                                      : `مازال خارج — ${formatDuration(req.exited_at, now.toISOString())}`
                                    }
                                  </span>
                                )}
                              </div>
                              {!hasReturned && isGateGuard && (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleConfirmReturn(req.id, String(aId))}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-sm flex-shrink-0"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  تأكيد العودة
                                </motion.button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Admin: Approve/Reject pending */}
                  {isAdmin && req.status === 'pending' && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleApprove(req.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium shadow-md"
                      >
                        <Check className="w-4 h-4" />
                        موافقة
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleReject(req.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-sm font-medium hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        رفض
                      </motion.button>
                    </>
                  )}

                  {/* Gate Guard: Confirm Exit */}
                  {isGateGuard && req.status === 'approved' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleConfirmExit(req.id)}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold shadow-lg shadow-blue-600/30 text-base"
                    >
                      <LogOutIcon className="w-5 h-5" />
                      تأكيد المغادرة
                    </motion.button>
                  )}

                  {/* Admin: Delete any request */}
                  {isAdmin && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDelete(req.id)}
                      className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
      )}
    </div>
  );
}
