import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, Truck, User, Wrench, Camera, Upload, Image as ImageIcon,
  X, CheckCircle2, AlertTriangle, History, FileText, UserCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getDepartmentClient, getDepartmentTables, normalizeDepartmentVehicleRow } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import type {
  MaintenanceRequest, MaintenanceRecord, MaintenanceImage,
  Vehicle, StaffMember, UserProfile,
} from '../lib/supabaseClient';
import type { PageKey } from '../components/Layout';
import FinishMaintenanceForm from '../components/FinishMaintenanceForm';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const IMAGE_TYPES = [
  { key: 'before', label: 'قبل الإصلاح', color: 'text-amber-600' },
  { key: 'during', label: 'أثناء الإصلاح', color: 'text-blue-600' },
  { key: 'after', label: 'بعد الإصلاح', color: 'text-emerald-600' },
  { key: 'invoice', label: 'الفاتورة', color: 'text-purple-600' },
] as const;

interface Props {
  profile: UserProfile | null;
  onNavigate: (page: PageKey) => void;
  department?: DepartmentCode;
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ActiveMaintenance({ profile, onNavigate, department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const maintenanceImagesBucket =
    department === 'installation'
      ? 'installation-maintenance-images'
      : department === 'operations'
        ? 'operations-maintenance-images'
        : 'maintenance-images';
  const isInstallation = department === 'installation';
  const driverLabel = isInstallation ? 'فني' : 'سائق';
  const isAdmin = profile?.role === 'admin';
  const isMaintManager = profile?.role === 'maintenance_manager';
  const canEdit = isAdmin || isMaintManager;
  const canFinish = isAdmin || isMaintManager; // Admin and maintenance_manager can finish
  const [activeRequest, setActiveRequest] = useState<MaintenanceRequest | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [driver, setDriver] = useState<StaffMember | null>(null);
  const [approverName, setApproverName] = useState<string | null>(null);
  const [images, setImages] = useState<MaintenanceImage[]>([]);
  const [pastRecords, setPastRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [showFinish, setShowFinish] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const cameraRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: reqs } = await supabase
      .from(tables.maintenanceRequests)
      .select('*')
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1);

    const req = reqs?.[0] ?? null;
    setActiveRequest(req);
    if (!req) setElapsed(0);

    if (req) {
      const [vRes, dRes, iRes, rRes, appRes] = await Promise.all([
        supabase.from(tables.vehicles).select('*').eq('id', req.vehicle_id).single(),
        req.driver_id
          ? supabase.from(tables.staffMembers).select('*').eq('id', req.driver_id).single()
          : Promise.resolve({ data: null }),
        supabase.from(tables.maintenanceImages).select('*').eq('request_id', req.id).order('created_at'),
        supabase.from(tables.maintenanceRecords).select('*').eq('vehicle_id', req.vehicle_id).order('created_at', { ascending: false }).limit(10),
        req.approved_by
          ? supabase.from('user_profiles').select('full_name').eq('id', req.approved_by).single()
          : Promise.resolve({ data: null }),
      ]);
      if (vRes.data) {
        setVehicle(normalizeDepartmentVehicleRow(vRes.data as Record<string, unknown>));
      }
      if (dRes.data) setDriver(dRes.data);
      if (iRes.data) setImages(iRes.data);
      if (rRes.data) setPastRecords(rRes.data);
      if (appRes.data) setApproverName((appRes.data as { full_name: string }).full_name);
      else setApproverName(null);
    } else {
      setApproverName(null);
    }
    setLoading(false);
  }, [supabase, tables]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: when maintenance is completed elsewhere, refetch immediately
  useEffect(() => {
    if (!activeRequest?.id) return;
    const channel = supabase
      .channel(`maint-req-${activeRequest.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: tables.maintenanceRequests, filter: `id=eq.${activeRequest.id}` },
        () => fetchData(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRequest?.id, fetchData]);

  // Live timer
  useEffect(() => {
    if (!activeRequest?.started_at) return;
    const start = new Date(activeRequest.started_at).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeRequest?.started_at]);

  async function uploadImage(file: File, imageType: string) {
    setUploadError(null);
    setUploadingType(imageType);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `maintenance/${activeRequest!.id}/${imageType}_${Date.now()}.${ext}`;
    const { error: storageErr } = await supabase.storage.from(maintenanceImagesBucket).upload(path, file);
    if (storageErr) {
      setUploadError('فشل رفع الصورة: ' + (storageErr.message || 'خطأ غير معروف'));
      setUploadingType(null);
      return;
    }
    const { data } = supabase.storage.from(maintenanceImagesBucket).getPublicUrl(path);

    const { error: imgErr } = await supabase.from(tables.maintenanceImages).insert({
      request_id: activeRequest!.id,
      image_url: data.publicUrl,
      image_type: imageType,
      uploaded_by: (await supabase.auth.getUser()).data.user?.id,
    });
    if (imgErr) {
      setUploadError('فشل حفظ الصورة في السجل: ' + (imgErr.message || 'خطأ غير معروف'));
      setUploadingType(null);
      return;
    }

    const { data: updatedImages } = await supabase
      .from(tables.maintenanceImages)
      .select('*')
      .eq('request_id', activeRequest!.id)
      .order('created_at');
    if (updatedImages) setImages(updatedImages);
    setUploadingType(null);
  }

  function handleFileChange(files: FileList | null, type: string) {
    if (!files?.[0]) return;
    uploadImage(files[0], type);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeRequest) {
    return (
      <div className="text-center py-20">
        <Wrench className="w-16 h-16 mx-auto mb-4 text-stone-300 dark:text-stone-600" />
        <h2 className="text-xl font-bold text-stone-900 dark:text-white mb-2">لا توجد صيانة نشطة</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-6">لا يوجد طلب صيانة قيد التنفيذ حالياً</p>
        <Button onClick={() => onNavigate('maintenance-requests')} className="font-black">
          عرض طلبات الصيانة
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timer Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 p-6 text-white shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <span className="font-medium">مدة الصيانة</span>
          </div>
          <span className={cn(
            'px-3 py-1 rounded-full text-sm font-medium',
            'bg-white/20 backdrop-blur-sm',
          )}>
            جاري التنفيذ
          </span>
        </div>
        <div className="text-5xl font-mono font-bold text-center tracking-widest mb-2" dir="ltr">
          {formatDuration(elapsed)}
        </div>
        <p className="text-center text-blue-200 text-sm">
          بدأت في {activeRequest.started_at ? new Date(activeRequest.started_at).toLocaleString('ar-IQ') : '—'}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle + Driver Info */}
        <div className="lg:col-span-1 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-5 shadow-sm"
          >
            <h3 className="font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-500" /> معلومات المركبة
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">رقم اللوحة</span>
                <span className="font-medium text-stone-900 dark:text-white">{vehicle?.plate_number}</span>
              </div>
              {vehicle?.model && (
                <div className="flex justify-between">
                  <span className="text-stone-500">الموديل</span>
                  <span className="text-stone-900 dark:text-white">{vehicle.model}</span>
                </div>
              )}
              {vehicle?.year && (
                <div className="flex justify-between">
                  <span className="text-stone-500">السنة</span>
                  <span className="text-stone-900 dark:text-white">{vehicle.year}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-500">العداد</span>
                <span className="text-stone-900 dark:text-white">{vehicle?.odometer_km?.toLocaleString()} كم</span>
              </div>
            </div>
          </motion.div>

          {driver && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-5 shadow-sm"
            >
              <h3 className="font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-500" /> {driverLabel} المسؤول
              </h3>
              <p className="text-sm text-stone-900 dark:text-white font-medium">{driver.full_name}</p>
            </motion.div>
          )}

          {approverName && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.17 }}
              className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-5 shadow-sm"
            >
              <h3 className="font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-500" /> مسؤول الصيانة
              </h3>
              <p className="text-sm text-stone-900 dark:text-white font-medium">{approverName}</p>
            </motion.div>
          )}

          {/* Problem details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-5 shadow-sm"
          >
            <h3 className="font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-500" /> تفاصيل المشكلة
            </h3>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{activeRequest.maintenance_type}</p>
            {activeRequest.description && (
              <p className="text-sm text-stone-600 dark:text-stone-400">{activeRequest.description}</p>
            )}
            {activeRequest.admin_notes && (
              <div className="mt-2 p-2 rounded-lg bg-stone-50 dark:bg-stone-800/50">
                <p className="text-xs text-stone-500 mb-0.5">ملاحظات الأدمن:</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">{activeRequest.admin_notes}</p>
              </div>
            )}
            {activeRequest.images?.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {activeRequest.images.map((img, idx) => (
                  <a key={idx} href={img} target="_blank" rel="noopener noreferrer">
                    <img src={img} className="w-16 h-16 object-cover rounded-lg border hover:opacity-80" />
                  </a>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Photos + History */}
        <div className="lg:col-span-2 space-y-4">
          {/* Photo capture */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-5 shadow-sm"
          >
            <h3 className="font-semibold text-stone-900 dark:text-white mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-500" /> التقاط صور الصيانة
            </h3>
            {uploadError && (
              <div className="mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {uploadError}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {IMAGE_TYPES.map(({ key, label, color }) => {
                const typeImages = images.filter(img => img.image_type === key);
                const isUploading = uploadingType === key;
                return (
                  <div key={key} className="space-y-2">
                    <p className={cn('text-sm font-medium', color)}>{label}</p>
                    <div className="aspect-square rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 flex flex-col items-center justify-center gap-1 relative overflow-hidden">
                      {typeImages.length > 0 ? (
                        <img src={typeImages[typeImages.length - 1].image_url} className="absolute inset-0 w-full h-full object-cover" />
                      ) : isUploading ? (
                        <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <ImageIcon className="w-6 h-6 text-stone-300" />
                          <span className="text-[10px] text-stone-400">لا توجد صورة</span>
                        </>
                      )}
                      {typeImages.length > 1 && (
                        <span className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 rounded-full">
                          {typeImages.length}
                        </span>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => cameraRefs.current[key]?.click()}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                        >
                          <Camera className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => fileRefs.current[key]?.click()}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                        >
                          <Upload className="w-3 h-3" />
                        </button>
                        <input
                          ref={el => { cameraRefs.current[key] = el; }}
                          type="file" accept="image/*" capture="environment" hidden
                          onChange={e => handleFileChange(e.target.files, key)}
                        />
                        <input
                          ref={el => { fileRefs.current[key] = el; }}
                          type="file" accept="image/*" hidden
                          onChange={e => handleFileChange(e.target.files, key)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* All images gallery */}
            {images.length > 0 && (
              <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">جميع الصور ({images.length})</p>
                <div className="flex gap-2 flex-wrap">
                  {images.map(img => (
                    <a key={img.id} href={img.image_url} target="_blank" rel="noopener noreferrer" className="relative group">
                      <img src={img.image_url} className="w-16 h-16 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center py-0.5 rounded-b-lg">
                        {IMAGE_TYPES.find(t => t.key === img.image_type)?.label ?? img.image_type}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Past maintenance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-5 shadow-sm"
          >
            <h3 className="font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-stone-400" /> سجل الصيانات السابقة
            </h3>
            {pastRecords.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">لا توجد صيانات سابقة لهذه المركبة</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pastRecords.map(rec => (
                  <div key={rec.id} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-stone-900 dark:text-white">{rec.maintenance_type}</span>
                      <span className="text-[11px] text-stone-400">{new Date(rec.created_at).toLocaleDateString('ar-IQ')}</span>
                    </div>
                    {rec.work_done && <p className="text-xs text-stone-500">{rec.work_done}</p>}
                    <div className="flex gap-3 mt-1 text-[11px] text-stone-400">
                      {rec.technician_name && <span>الفني: {rec.technician_name}</span>}
                      {rec.cost > 0 && <span>التكلفة: {Number(rec.cost).toLocaleString()} د.ع</span>}
                      {rec.duration_minutes && <span>المدة: {rec.duration_minutes} دقيقة</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Finish button - Admin & Maintenance Manager */}
          {canFinish && (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setShowFinish(true)}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-lg shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-3"
            >
              <CheckCircle2 className="w-6 h-6" />
              إنهاء الصيانة
            </motion.button>
          )}
        </div>
      </div>

      {/* Finish Maintenance Form */}
      <FinishMaintenanceForm
        request={activeRequest}
        open={showFinish}
        onClose={() => setShowFinish(false)}
        onDone={() => {
          setShowFinish(false);
          fetchData();
        }}
        department={department}
      />
    </div>
  );
}
