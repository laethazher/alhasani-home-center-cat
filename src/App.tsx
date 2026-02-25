/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, 
  ClipboardCheck, 
  Wrench, 
  Send, 
  User, 
  Hash, 
  Calendar,
  CheckCircle,
  Loader2,
  AlertTriangle,
  FileText,
  Download,
  History,
  ArrowRight,
  Printer,
  Package,
  RotateCcw
} from 'lucide-react';
import { DamageMap } from './components/DamageMap';
import { InspectionForm } from './components/InspectionForm';
import { ToolInventory } from './components/ToolInventory';
import { SignaturePad } from './components/SignaturePad';
import { cn } from './lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { WEEKLY_INSPECTION_ITEMS, TOOL_INVENTORY_ITEMS } from './constants';

type Tab = 'damage' | 'inspection' | 'tools' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('damage');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  
  const reportRef = useRef<HTMLDivElement>(null);

  // Form State
  const [driverName, setDriverName] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [damagePoints, setDamagePoints] = useState<any[]>([]);
  const [inspectionValues, setInspectionValues] = useState<Record<number, boolean>>({});
  const [toolValues, setToolValues] = useState<Record<number, number>>({});
  const [toolImages, setToolImages] = useState<Record<number, string[]>>({});
  
  // Signatures
  const [driverSignature, setDriverSignature] = useState('');
  const [equipmentManagerSignature, setEquipmentManagerSignature] = useState('');
  const [logisticsManagerSignature, setLogisticsManagerSignature] = useState('');
  const [warehouseManagerSignature, setWarehouseManagerSignature] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const [cacheBuster] = useState(() => Date.now());

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setSavedReports(data);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    }
  };

  const handleSubmit = async () => {
    console.log("Starting submission...");
    
    if (!driverName || !truckNumber) {
      alert('يرجى إدخال اسم السائق ورقم المركبة');
      return;
    }

    if (!driverSignature) {
      alert('يرجى إضافة توقيع السائق');
      return;
    }

    const payload = {
      driverName,
      truckNumber,
      date,
      damagePoints,
      inspectionValues,
      toolValues,
      toolImages,
      driverSignature,
      equipmentManagerSignature,
      logisticsManagerSignature,
      warehouseManagerSignature
    };

    console.log("Payload size:", JSON.stringify(payload).length);
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      console.log("Submission result:", result);

      if (res.ok && result.success) {
        setSubmitted(true);
        fetchReports();
      } else {
        alert('فشل في حفظ التقرير: ' + (result.error || 'خطأ غير معروف'));
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async () => {
    if (!reportRef.current || !viewingReport) return;
    
    setIsExporting(true);
    try {
      // Scroll to top to ensure full capture
      window.scrollTo(0, 0);
      
      // Ensure images are loaded
      const images = reportRef.current.getElementsByTagName('img');
      const loadPromises = Array.from(images).map(img => {
        const image = img as HTMLImageElement;
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
          image.onload = resolve;
          image.onerror = resolve;
        });
      });
      
      await Promise.all(loadPromises);
      
      // Extra wait for layout stability
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#fafaf9',
        allowTaint: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 800,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('print-section');
          if (el) {
            el.style.width = '800px';
            el.style.padding = '40px';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
      
      // Add subsequent pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`report-${viewingReport.truckNumber}-${viewingReport.date}.pdf`);
    } catch (error) {
      console.error("PDF Export failed:", error);
      alert("فشل في تصدير ملف PDF. يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى.");
    } finally {
      setIsExporting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full glass p-12 rounded-3xl text-center space-y-6"
        >
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold">تم حفظ التقرير بنجاح!</h1>
          <p className="text-stone-500">تم تخزين التقرير في قاعدة بيانات الموقع ويمكنك الرجوع إليه في أي وقت.</p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary w-full"
            >
              تقديم جرد جديد
            </button>
            <button 
              onClick={() => {
                setSubmitted(false);
                setActiveTab('history');
              }}
              className="w-full py-2 text-stone-600 font-bold hover:text-stone-900 transition-colors"
            >
              عرض السجل
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" dir="rtl">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center bg-rose-50 rounded-xl">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-rose-500">
                  <path d="M3 14l9-9 9 9" />
                </svg>
              </div>
              <div className="border-r-2 border-stone-200 pr-4 text-right">
                <h1 className="text-xl font-black tracking-tight text-stone-900 leading-none">الحسني هوم سنتر</h1>
                <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-stone-500 mt-1">ALHASANI HOME CENTER</p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setActiveTab('history')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-stone-100 transition-colors text-stone-600 font-bold text-sm"
          >
            <History className="w-4 h-4" />
            السجل
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {activeTab === 'history' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <History className="w-6 h-6 text-red-700" />
                سجل التقارير المحفوظة
              </h2>
              <div className="flex items-center gap-4">
                <button 
                  onClick={fetchReports}
                  className="p-2 text-stone-400 hover:text-stone-600 transition-colors"
                  title="تحديث السجل"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setActiveTab('damage')}
                  className="flex items-center gap-2 text-stone-500 hover:text-red-700 font-bold"
                >
                  <ArrowRight className="w-4 h-4" />
                  رجوع للنموذج
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedReports.length === 0 ? (
                <div className="col-span-full py-20 text-center text-stone-400">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد تقارير محفوظة حالياً</p>
                </div>
              ) : (
                savedReports.map((report) => (
                  <div 
                    key={report.id}
                    className="glass p-6 rounded-2xl hover:border-red-200 transition-all cursor-pointer group"
                    onClick={() => setViewingReport(report)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{report.driverName}</h3>
                        <p className="text-sm text-stone-500">مركبة رقم: {report.truckNumber}</p>
                      </div>
                      <span className="text-xs font-mono bg-stone-100 px-2 py-1 rounded text-stone-500">
                        {new Date(report.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
                      <div className="flex gap-2">
                        <span className="text-[10px] font-bold px-2 py-1 bg-red-50 text-red-700 rounded-full">
                          {report.damagePoints.length} أضرار
                        </span>
                        <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                          {Object.values(report.inspectionValues).filter(Boolean).length}/17 فحص
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-red-700 transition-colors" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Driver Info */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 flex items-center gap-2">
                  <User className="w-3 h-3" /> اسم السائق
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="أدخل اسمك الكامل"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 flex items-center gap-2">
                  <Hash className="w-3 h-3" /> رقم المركبة
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="مثال: 1234"
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> تاريخ الجرد
                </label>
                <input 
                  type="date" 
                  className="input-field"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </section>

            {/* Tabs Navigation */}
            <div className="flex p-1 bg-stone-200 rounded-2xl">
              {(['damage', 'inspection', 'tools'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                    activeTab === tab 
                      ? "bg-white text-red-700 shadow-sm" 
                      : "text-stone-500 hover:text-stone-700"
                  )}
                >
                  {tab === 'damage' && <AlertTriangle className="w-4 h-4" />}
                  {tab === 'inspection' && <ClipboardCheck className="w-4 h-4" />}
                  {tab === 'tools' && <Wrench className="w-4 h-4" />}
                  {tab === 'damage' ? 'أضرار المركبة' : tab === 'inspection' ? 'الفحص الأسبوعي' : 'جرد العدة'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'damage' && (
                    <div className="space-y-6">
                      <DamageMap 
                        points={damagePoints}
                        onDamageChange={setDamagePoints} 
                        cacheBuster={cacheBuster}
                      />
                    </div>
                  )}
                  
                  {activeTab === 'inspection' && (
                    <div className="space-y-6">
                      <InspectionForm 
                        values={inspectionValues} 
                        onChange={(id, checked) => setInspectionValues(prev => ({ ...prev, [id]: checked }))} 
                      />
                    </div>
                  )}
                  
                  {activeTab === 'tools' && (
                    <div className="space-y-6">
                      <ToolInventory 
                        values={toolValues} 
                        onChange={(id, count) => setToolValues(prev => ({ ...prev, [id]: count }))} 
                        toolImages={toolImages}
                        onImagesChange={(id, images) => setToolImages(prev => ({ ...prev, [id]: images }))}
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Signatures Section */}
            <section className="space-y-6 pt-8 border-t border-stone-200">
              <h3 className="text-xl font-bold">التوقيعات والاعتمادات</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SignaturePad 
                  label="اسم وتوقيع السائق" 
                  onSave={setDriverSignature} 
                />
                <SignaturePad 
                  label="توقيع مسؤول قسم التجهيز" 
                  onSave={setEquipmentManagerSignature} 
                />
                <SignaturePad 
                  label="توقيع مدير قسم اللوجستك" 
                  onSave={setLogisticsManagerSignature} 
                />
                <SignaturePad 
                  label="توقيع مدير المخازن" 
                  onSave={setWarehouseManagerSignature} 
                />
              </div>
            </section>
          </>
        )}
      </main>

      {/* Bottom Action Bar */}
      {activeTab !== 'history' && (
        <div className="fixed bottom-0 left-0 right-0 glass p-4 border-t border-stone-200 z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="text-xs text-stone-500 font-medium">سيتم الحفظ في:</p>
              <p className="text-[10px] font-mono text-stone-400">قاعدة بيانات الموقع المحلية</p>
            </div>

            <div className="flex items-center gap-4 flex-1 sm:flex-none">
              <div className="hidden md:flex items-center gap-4 text-[10px] font-bold text-stone-400 border-r border-stone-200 pr-4">
                <span className={damagePoints.length > 0 ? 'text-red-500' : ''}>
                  {damagePoints.length} أضرار
                </span>
                <span className={Object.keys(inspectionValues).length > 0 ? 'text-green-600' : ''}>
                  {Object.keys(inspectionValues).length} فحص
                </span>
                <span className={Object.keys(toolValues).length > 0 ? 'text-blue-600' : ''}>
                  {Object.keys(toolValues).length} جرد
                </span>
              </div>
              
              <button 
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="btn-primary flex-1 flex items-center justify-center gap-3 min-w-[200px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    حفظ التقرير في الموقع
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal / PDF View */}
      <AnimatePresence>
        {viewingReport && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[rgba(0,0,0,0.6)] backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative"
            >
              <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
                <div className="flex gap-2">
                  <button 
                    onClick={exportPDF}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition-colors disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isExporting ? 'جاري التحميل...' : 'تحميل PDF'}
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl font-bold text-sm hover:bg-stone-200 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة
                  </button>
                </div>
                <button 
                  onClick={() => setViewingReport(null)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>

              <div ref={reportRef} id="print-section" className="p-12 space-y-12 bg-white" dir="rtl">
                {/* PDF Header */}
                <div className="flex justify-between items-start border-b-4 border-rose-400 pb-8" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 flex items-center justify-center bg-rose-50 rounded-2xl">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-rose-500">
                        <path d="M3 14l9-9 9 9" />
                      </svg>
                    </div>
                    <div className="border-r-4 border-stone-200 pr-6">
                      <h1 className="text-4xl font-black text-stone-900 leading-tight">الحسني هوم سنتر</h1>
                      <h2 className="text-2xl font-bold text-stone-800 leading-tight">ALHASANI HOME CENTER</h2>
                    </div>
                  </div>
                  <div className="text-left">
                    <h2 className="text-3xl font-bold text-rose-500">تقرير فحص المركبة</h2>
                    <p className="text-stone-500 font-mono text-lg">#{viewingReport.id.toString().padStart(5, '0')}</p>
                    <div className="mt-6 text-right">
                      <h3 className="text-xl font-black text-stone-900">الحسني هوم سنتر</h3>
                      <p className="text-xs font-bold text-stone-500">ALHASANI HOME CENTER</p>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-3 gap-8 bg-stone-50 p-6 rounded-2xl" style={{ pageBreakInside: 'avoid' }}>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">السائق</span>
                    <p className="font-bold text-lg">{viewingReport.driverName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">رقم المركبة</span>
                    <p className="font-bold text-lg">{viewingReport.truckNumber}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">التاريخ</span>
                    <p className="font-bold text-lg">{viewingReport.date}</p>
                  </div>
                </div>

                {/* Vehicle Damage Map */}
                <div className="space-y-4 pdf-section" style={{ pageBreakBefore: 'always' }}>
                  <h3 className="text-xl font-bold border-r-4 border-rose-400 pr-4">مخطط أضرار المركبة</h3>
                  <div className="relative rounded-2xl overflow-hidden border-2 border-stone-100">
                    <img 
                      src="/truck-collage.jpg?v=1" 
                      alt="Truck Map" 
                      className="w-full h-auto object-cover"
                      crossOrigin="anonymous"
                    />
                    {viewingReport.damagePoints.map((point: any, idx: number) => (
                      <div
                        key={idx}
                        className="absolute w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                        style={{ 
                          left: `${point.x}%`, 
                          top: `${point.y}%`, 
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: point.severity === 'high' ? '#dc2626' : point.severity === 'medium' ? '#f97316' : '#facc15'
                        }}
                      >
                        <span className="text-[10px] font-bold text-white">{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Damage Summary */}
                <div className="space-y-4 pdf-section" style={{ pageBreakBefore: 'always' }}>
                  <h3 className="text-xl font-bold border-r-4 border-red-700 pr-4">أضرار المركبة الموثقة</h3>
                  {viewingReport.damagePoints.length === 0 ? (
                    <p className="text-stone-400 italic">لا توجد أضرار مسجلة</p>
                  ) : (
                    <div className="space-y-4">
                      {viewingReport.damagePoints.map((p: any, idx: number) => (
                        <div key={idx} className="border border-stone-200 rounded-lg overflow-hidden" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                          <div className="flex items-center gap-4 p-3 bg-white border-b border-stone-100">
                            <span className="font-mono font-bold text-stone-300">#{idx + 1}</span>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap ${
                              p.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {p.severity === 'high' ? 'كبير' : 'متوسط'}
                            </span>
                            <p className="flex-1 font-medium">{p.description}</p>
                          </div>
                          
                          {/* Damage Images */}
                          {p.images && p.images.length > 0 && (
                            <div className="p-4 bg-stone-50 border-t border-stone-100">
                              <p className="text-xs font-bold text-stone-600 mb-3">صور الضرر ({p.images.length}):</p>
                              <div className="space-y-3">
                                {p.images.map((image: string, imgIdx: number) => (
                                  <div key={imgIdx} className="bg-white p-3 rounded border border-stone-200" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                    <img 
                                      src={image} 
                                      alt={`صورة الضرر ${imgIdx + 1}`}
                                      className="w-full max-w-2xl mx-auto h-auto object-contain rounded"
                                      style={{ minHeight: '150px', maxHeight: '300px' }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inspection Results */}
                <div className="space-y-4 pdf-section" style={{ pageBreakBefore: 'always' }}>
                  <h3 className="text-xl font-bold border-r-4 border-rose-400 pr-4">نتائج الفحص الأسبوعي</h3>
                  <div className="space-y-2">
                    {WEEKLY_INSPECTION_ITEMS.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border-b border-stone-100 bg-white rounded-lg text-sm" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <div className="flex items-center gap-3">
                          <span className="text-stone-400 font-mono text-xs">{item.id.toString().padStart(2, '0')}</span>
                          <span className="font-medium">{item.label}</span>
                        </div>
                        <span className={`font-bold px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${viewingReport.inspectionValues[item.id] ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {viewingReport.inspectionValues[item.id] ? '✓ سليم' : '✗ غير سليم'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tool Inventory */}
                <div className="space-y-4 pdf-section" style={{ pageBreakBefore: 'always' }}>
                  <h3 className="text-xl font-bold border-r-4 border-rose-400 pr-4">جرد العدة والمواد</h3>
                  <div className="space-y-4">
                    {TOOL_INVENTORY_ITEMS.map((item) => (
                      <div key={item.id} className="border border-stone-200 rounded-lg overflow-hidden" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <div className="flex items-center justify-between p-3 bg-white border-b border-stone-100">
                          <div className="flex items-center gap-3">
                            <Package className="w-4 h-4 text-stone-400" />
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className="text-xs text-stone-400 whitespace-nowrap">المطلوب: {item.quantity}</span>
                            <span className={`font-bold px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                              (viewingReport.toolValues[item.id] || 0) < item.quantity ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                            }`}>
                              المتوفر: {viewingReport.toolValues[item.id] || 0}
                            </span>
                          </div>
                        </div>
                        
                        {/* Tool Images */}
                        {viewingReport.toolImages && viewingReport.toolImages[item.id] && viewingReport.toolImages[item.id].length > 0 && (
                          <div className="p-4 bg-stone-50 border-t border-stone-100">
                            <p className="text-xs font-bold text-stone-600 mb-3">الصور المرتبطة ({viewingReport.toolImages[item.id].length}):</p>
                            <div className="space-y-3">
                              {viewingReport.toolImages[item.id].map((image: string, imgIdx: number) => (
                                <div key={imgIdx} className="bg-white p-3 rounded border border-stone-200" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                  <img 
                                    src={image} 
                                    alt={`${item.name} - الصورة ${imgIdx + 1}`}
                                    className="w-full max-w-2xl mx-auto h-auto object-contain rounded"
                                    style={{ minHeight: '150px', maxHeight: '300px' }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signatures */}
                <div className="flex flex-wrap gap-x-8 gap-y-12 pt-12 border-t border-stone-100 pdf-section" style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid' }}>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <p className="text-sm font-bold text-stone-500">اسم وتوقيع السائق</p>
                    <div className="h-24 border-b border-stone-200 flex items-center justify-center">
                      {viewingReport.driverSignature && <img src={viewingReport.driverSignature} className="max-h-full" />}
                    </div>
                    <p className="text-xs font-bold text-stone-400">{viewingReport.driverName}</p>
                  </div>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <p className="text-sm font-bold text-stone-500">مسؤول قسم التجهيز</p>
                    <div className="h-24 border-b border-stone-200 flex items-center justify-center">
                      {viewingReport.equipmentManagerSignature && <img src={viewingReport.equipmentManagerSignature} className="max-h-full" />}
                    </div>
                  </div>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <p className="text-sm font-bold text-stone-500">مدير قسم اللوجستك</p>
                    <div className="h-24 border-b border-stone-200 flex items-center justify-center">
                      {viewingReport.logisticsManagerSignature && <img src={viewingReport.logisticsManagerSignature} className="max-h-full" />}
                    </div>
                  </div>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <p className="text-sm font-bold text-stone-500">مدير المخازن</p>
                    <div className="h-24 border-b border-stone-200 flex items-center justify-center">
                      {viewingReport.warehouseManagerSignature && <img src={viewingReport.warehouseManagerSignature} className="max-h-full" />}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-12 border-t border-stone-100 flex justify-between items-center text-[10px] text-stone-400 font-bold">
                  <p>تم إنشاء هذا التقرير إلكترونياً عبر نظام الحسني هوم سنتر</p>
                  <p>{new Date(viewingReport.createdAt).toLocaleString('ar-EG')}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
