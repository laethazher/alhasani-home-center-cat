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
  RotateCcw,
  Moon,
  Sun
} from 'lucide-react';
import { DamageMap } from './components/DamageMap';
import { InspectionForm } from './components/InspectionForm';
import { ToolInventory } from './components/ToolInventory';
import { SignaturePad } from './components/SignaturePad';
import { cn } from './lib/utils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { WEEKLY_INSPECTION_ITEMS, TOOL_INVENTORY_ITEMS } from './constants';

type Tab = 'damage' | 'inspection' | 'tools' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('damage');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem('darkMode') === 'true';
    } catch {
      return false;
    }
  });
  
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

  useEffect(() => {
    updateDarkMode(isDarkMode);
  }, [isDarkMode]);

  const updateDarkMode = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('darkMode', isDark.toString());
    } catch {
      // Ignore storage errors (e.g. private mode restrictions)
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

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
      // Scroll the modal container to top to ensure full capture
      const modalContainer = reportRef.current.closest('.overflow-y-auto');
      if (modalContainer) modalContainer.scrollTop = 0;
      window.scrollTo(0, 0);
      
      // Wait for any pending image loads
      const allImages = reportRef.current.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
      await Promise.all(
        Array.from(allImages).map((img: HTMLImageElement) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>(resolve => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
        )
      );
      
      // Small pause for layout stability
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // ===== CRITICAL: Sanitize oklch() from ALL stylesheets in the LIVE document =====
      // html2canvas reads CSS from the live DOM before onclone runs.
      // We must replace oklch/oklab/color-mix in CSS text BEFORE calling html2canvas.
      const originalStyles: { el: HTMLStyleElement; text: string }[] = [];
      document.querySelectorAll('style').forEach((styleEl) => {
        if (styleEl.textContent && /oklch|oklab|color-mix/i.test(styleEl.textContent)) {
          originalStyles.push({ el: styleEl as HTMLStyleElement, text: styleEl.textContent });
          styleEl.textContent = styleEl.textContent
            .replace(/oklch\([^)]*\)/gi, 'rgb(128, 128, 128)')
            .replace(/oklab\([^)]*\)/gi, 'rgb(128, 128, 128)')
            .replace(/color-mix\([^)]*\)/gi, 'rgb(128, 128, 128)');
        }
      });
      
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: reportRef.current.scrollWidth,
        width: reportRef.current.scrollWidth,
        height: reportRef.current.scrollHeight,
        onclone: (clonedDoc: Document) => {
          // Force light mode on cloned document FIRST (before capturing computed styles)
          clonedDoc.documentElement.classList.remove('dark');
          
          const win = clonedDoc.defaultView;
          if (!win) return;
          
          const printSection = clonedDoc.getElementById('print-section');
          
          // STEP 1: Capture all computed styles while stylesheets still exist
          // Browser resolves oklch() → rgb() in getComputedStyle automatically
          const styleCache = new Map<HTMLElement, Record<string, string>>();
          const allEls = clonedDoc.querySelectorAll('*');
          allEls.forEach((el: Element) => {
            const htmlEl = el as HTMLElement;
            const computed = win.getComputedStyle(htmlEl);
            styleCache.set(htmlEl, {
              backgroundColor: computed.backgroundColor,
              color: computed.color,
              borderTopColor: computed.borderTopColor,
              borderBottomColor: computed.borderBottomColor,
              borderLeftColor: computed.borderLeftColor,
              borderRightColor: computed.borderRightColor,
              display: computed.display,
              flexDirection: computed.flexDirection,
              justifyContent: computed.justifyContent,
              alignItems: computed.alignItems,
              flexWrap: computed.flexWrap,
              textAlign: computed.textAlign,
              fontWeight: computed.fontWeight,
              fontSize: computed.fontSize,
              lineHeight: computed.lineHeight,
              padding: computed.padding,
              margin: computed.margin,
              borderRadius: computed.borderRadius,
              borderWidth: computed.borderWidth,
              borderStyle: computed.borderStyle,
              gap: computed.gap,
              fontFamily: computed.fontFamily,
              position: computed.position,
              overflow: computed.overflow,
              flex: computed.flex,
              flexGrow: computed.flexGrow,
              flexShrink: computed.flexShrink,
              flexBasis: computed.flexBasis,
              gridTemplateColumns: computed.gridTemplateColumns,
              gridColumn: computed.gridColumn,
              columnGap: computed.columnGap,
              rowGap: computed.rowGap,
              whiteSpace: computed.whiteSpace,
              textDecoration: computed.textDecoration,
              letterSpacing: computed.letterSpacing,
              boxSizing: computed.boxSizing,
            });
          });
          
          // STEP 2: Remove all stylesheets to prevent html2canvas from parsing oklch
          const styleSheets = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styleSheets.forEach((sheet) => sheet.remove());
          
          // STEP 3: Apply cached computed styles as inline styles (all in RGB now)
          styleCache.forEach((styles, htmlEl) => {
            Object.entries(styles).forEach(([prop, val]) => {
              if (val) {
                (htmlEl.style as any)[prop] = val;
              }
            });
          });
          
          // STEP 4: Force light mode colors on print section
          if (printSection) {
            printSection.style.width = reportRef.current!.scrollWidth + 'px';
            printSection.style.padding = '50px';
            printSection.style.margin = '0';
            printSection.style.display = 'block';
            printSection.style.backgroundColor = '#ffffff';
            printSection.style.color = '#1c1917';
            printSection.style.position = 'relative';
            printSection.style.overflow = 'visible';
            printSection.style.fontFamily = '"Inter", "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif';
            printSection.style.direction = 'rtl';
            
            const pEls = printSection.querySelectorAll('*');
            pEls.forEach((el: Element) => {
              const htmlEl = el as HTMLElement;
              const bg = htmlEl.style.backgroundColor;
              
              // Dark backgrounds → white
              if (
                bg === 'rgb(3, 7, 18)' ||
                bg === 'rgb(12, 10, 9)' ||
                bg === 'rgb(28, 25, 23)' ||
                bg === 'rgb(41, 37, 36)' ||
                bg === 'rgb(68, 64, 60)' ||
                bg === 'rgb(15, 14, 13)' ||
                bg.startsWith('rgba(3, 7, 18') ||
                bg.startsWith('rgba(12, 10, 9') ||
                bg.startsWith('rgba(28, 25, 23') ||
                bg.startsWith('rgba(15, 14, 13')
              ) {
                htmlEl.style.backgroundColor = '#ffffff';
              }
              
              // Light/muted backgrounds to light mode equivalents
              if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
                htmlEl.style.backgroundColor = 'transparent';
              }
              
              // Light text → dark text (dark mode text colors)
              const color = htmlEl.style.color;
              if (
                color === 'rgb(231, 229, 228)' ||
                color === 'rgb(214, 211, 209)' ||
                color === 'rgb(168, 162, 158)' ||
                color === 'rgb(120, 113, 108)' ||
                color === 'rgb(245, 245, 244)' ||
                color === 'rgb(250, 250, 249)'
              ) {
                htmlEl.style.color = '#1c1917';
              }
            });
          }
          
          // STEP 5: Ensure images render correctly
          const imgs = clonedDoc.querySelectorAll('img');
          imgs.forEach((img: HTMLImageElement) => {
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';
          });
        }
      });
      } finally {
        // ===== RESTORE original stylesheets so the live page isn't affected =====
        originalStyles.forEach(({ el, text }) => {
          el.textContent = text;
        });
      }

      // Generate PDF from canvas using page slicing
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const margin = 5;
      const usableWidth = pdfWidth - margin * 2;
      const usableHeight = pdfHeight - margin * 2;
      const pxPerMm = canvas.width / usableWidth;
      const pageHeightPx = Math.floor(usableHeight * pxPerMm);

      let yOffset = 0;
      let pageIndex = 0;

      while (yOffset < canvas.height) {
        const sliceH = Math.min(pageHeightPx, canvas.height - yOffset);

        // Create a temporary canvas for this page slice
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = canvas.width;
        tmpCanvas.height = sliceH;
        const tmpCtx = tmpCanvas.getContext('2d');
        if (!tmpCtx) throw new Error('Canvas context unavailable');

        tmpCtx.fillStyle = '#ffffff';
        tmpCtx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
        tmpCtx.drawImage(canvas, 0, yOffset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

        const imgData = tmpCanvas.toDataURL('image/jpeg', 0.92);
        const sliceHeightMm = sliceH / pxPerMm;

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, margin, usableWidth, sliceHeightMm);

        yOffset += sliceH;
        pageIndex++;
      }

      // Safe filename
      const truck = String(viewingReport.truckNumber || 'truck').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '-');
      const dt = String(viewingReport.date || new Date().toISOString().slice(0, 10));
      pdf.save(`report-${truck}-${dt}.pdf`);

    } catch (error: any) {
      console.error('PDF Export failed:', error?.message || error);
      alert('فشل في تصدير ملف PDF: ' + (error?.message || 'خطأ غير معروف'));
    } finally {
      setIsExporting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white dark:bg-stone-950" style={{ backgroundColor: isDarkMode ? '#030712' : '#ffffff' }}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full glass p-12 rounded-3xl text-center space-y-6"
        >
          <div className="w-20 h-20 bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">تم حفظ التقرير بنجاح!</h1>
          <p className="text-stone-500 dark:text-stone-400">تم تخزين التقرير في قاعدة بيانات الموقع ويمكنك الرجوع إليه في أي وقت.</p>
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
              className="w-full py-2 text-stone-600 dark:text-stone-300 font-bold hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            >
              عرض السجل
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors" dir="rtl" style={{ backgroundColor: isDarkMode ? '#030712' : '#ffffff' }}>
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4 dark:glass-dark" style={{ backgroundColor: isDarkMode ? 'rgba(3, 7, 18, 0.85)' : 'rgba(255, 255, 255, 0.85)' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center bg-rose-50 dark:bg-rose-950 rounded-xl">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-rose-500 dark:text-rose-400">
                  <path d="M3 14l9-9 9 9" />
                </svg>
              </div>
              <div className="border-r-2 border-stone-200 dark:border-stone-700 pr-4 text-right">
                <h1 style={{ color: isDarkMode ? '#e7e5e4' : '#1c1917' }} className="text-xl font-black tracking-tight text-stone-900 dark:text-stone-100 leading-none">الحسني هوم سنتر</h1>
                <p style={{ color: isDarkMode ? '#a8a29e' : '#78716c' }} className="text-[9px] uppercase tracking-[0.15em] font-bold text-stone-500 dark:text-stone-400 mt-1">ALHASANI HOME CENTER</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleDarkMode}
              className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-600 dark:text-stone-300"
              title={isDarkMode ? 'وضع النهار' : 'الوضع الليلي'}
            >
              <motion.div
                initial={false}
                animate={{ rotate: isDarkMode ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {isDarkMode ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </motion.div>
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-600 dark:text-stone-300 font-bold text-sm"
            >
              <History className="w-4 h-4" />
              السجل
            </button>
          </div>
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
                  className="p-2 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-400 transition-colors"
                  title="تحديث السجل"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setActiveTab('damage')}
                  className="flex items-center gap-2 text-stone-500 dark:text-stone-400 hover:text-red-700 dark:hover:text-red-400 font-bold"
                >
                  <ArrowRight className="w-4 h-4" />
                  رجوع للنموذج
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedReports.length === 0 ? (
                <div className="col-span-full py-20 text-center text-stone-400 dark:text-stone-500">
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
                        <p className="text-sm text-stone-500 dark:text-stone-400">مركبة رقم: {report.truckNumber}</p>
                      </div>
                      <span className="text-xs font-mono bg-stone-100 dark:bg-stone-700 px-2 py-1 rounded text-stone-500 dark:text-stone-300">
                        {new Date(report.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100 dark:border-stone-700">
                      <div className="flex gap-2">
                        <span className="text-[10px] font-bold px-2 py-1 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-full">
                          {report.damagePoints.length} أضرار
                        </span>
                        <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full">
                          {Object.values(report.inspectionValues).filter(Boolean).length}/17 فحص
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors" />
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
                <label className="text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center gap-2">
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
                <label className="text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center gap-2">
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
                <label className="text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center gap-2">
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
            <div className="flex p-1 bg-stone-200 dark:bg-stone-800 rounded-2xl">
              {(['damage', 'inspection', 'tools'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                    activeTab === tab 
                      ? "bg-white dark:bg-stone-700 text-red-700 dark:text-red-400 shadow-sm" 
                      : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
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
        <div className="fixed bottom-0 left-0 right-0 glass dark:glass p-4 border-t border-stone-200 dark:border-stone-700 z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">سيتم الحفظ في:</p>
              <p className="text-[10px] font-mono text-stone-400 dark:text-stone-500">قاعدة بيانات الموقع المحلية</p>
            </div>

            <div className="flex items-center gap-4 flex-1 sm:flex-none">
              <div className="hidden md:flex items-center gap-4 text-[10px] font-bold text-stone-400 dark:text-stone-500 border-r border-stone-200 dark:border-stone-700 pr-4">
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
              className="bg-white dark:bg-stone-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative"
            >
              <div className="sticky top-0 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 p-4 flex justify-between items-center z-10">
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
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-bold text-sm hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة
                  </button>
                </div>
                <button 
                  onClick={() => setViewingReport(null)}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>

              <div ref={reportRef} id="print-section" className="p-12 space-y-12 bg-white dark:bg-stone-900" dir="rtl">
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
                    <p className="text-stone-400 dark:text-stone-500 italic">لا توجد أضرار مسجلة</p>
                  ) : (
                    <div className="space-y-4">
                      {viewingReport.damagePoints.map((p: any, idx: number) => (
                        <div key={idx} className="border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                          <div className="flex items-center gap-4 p-3 bg-white dark:bg-stone-800 border-b border-stone-100 dark:border-stone-700">
                            <span className="font-mono font-bold text-stone-300 dark:text-stone-500">#{idx + 1}</span>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap ${
                              p.severity === 'high' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200' : 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200'
                            }`}>
                              {p.severity === 'high' ? 'كبير' : 'متوسط'}
                            </span>
                            <p className="flex-1 font-medium">{p.description}</p>
                          </div>
                          
                          {/* Damage Images */}
                          {p.images && p.images.length > 0 && (
                            <div className="p-4 bg-stone-50 dark:bg-stone-700 border-t border-stone-100 dark:border-stone-700">
                              <p className="text-xs font-bold text-stone-600 dark:text-stone-300 mb-4">صور الضرر ({p.images.length}):</p>
                              <div className="space-y-4">
                                {p.images.map((image: string, imgIdx: number) => (
                                  <div key={imgIdx} className="bg-white dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700" style={{ breakInside: 'avoid', pageBreakInside: 'avoid', display: 'flex', flexDirection: 'column', width: '100%', height: 'auto' }}>
                                    <img 
                                      src={image} 
                                      alt={`صورة الضرر ${imgIdx + 1}`}
                                      style={{ width: '100%', height: 'auto', display: 'block', minHeight: '350px', maxHeight: '600px', objectFit: 'contain', backgroundColor: '#ffffff' }}
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
                      <div key={item.id} className="flex items-center justify-between p-3 border-b border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg text-sm" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <div className="flex items-center gap-3">
                          <span className="text-stone-400 dark:text-stone-500 font-mono text-xs">{item.id.toString().padStart(2, '0')}</span>
                          <span className="font-medium">{item.label}</span>
                        </div>
                        <span className={`font-bold px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${viewingReport.inspectionValues[item.id] ? 'bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-200' : 'bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200'}`}>
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
                        <div className="flex items-center justify-between p-3 bg-white dark:bg-stone-800 border-b border-stone-100 dark:border-stone-700">
                          <div className="flex items-center gap-3">
                            <Package className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className="text-xs text-stone-400 dark:text-stone-500 whitespace-nowrap">المطلوب: {item.quantity}</span>
                            <span className={`font-bold px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                              (viewingReport.toolValues[item.id] || 0) < item.quantity ? 'bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200' : 'bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-200'
                            }`}>
                              المتوفر: {viewingReport.toolValues[item.id] || 0}
                            </span>
                          </div>
                        </div>
                        
                        {/* Tool Images */}
                        {viewingReport.toolImages && viewingReport.toolImages[item.id] && viewingReport.toolImages[item.id].length > 0 && (
                          <div className="p-4 bg-stone-50 dark:bg-stone-700 border-t border-stone-100 dark:border-stone-700">
                            <p className="text-xs font-bold text-stone-600 dark:text-stone-300 mb-4">الصور المرتبطة ({viewingReport.toolImages[item.id].length}):</p>
                            <div className="space-y-4">
                              {viewingReport.toolImages[item.id].map((image: string, imgIdx: number) => (
                                <div key={imgIdx} className="bg-white dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700" style={{ breakInside: 'avoid', pageBreakInside: 'avoid', display: 'flex', flexDirection: 'column', width: '100%', height: 'auto' }}>
                                  <img 
                                    src={image} 
                                    alt={`${item.name} - الصورة ${imgIdx + 1}`}
                                    style={{ width: '100%', height: 'auto', display: 'block', minHeight: '350px', maxHeight: '600px', objectFit: 'contain', backgroundColor: '#ffffff' }}
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
                <div className="flex flex-wrap gap-x-8 gap-y-12 pt-12 border-t border-stone-100 dark:border-stone-700 pdf-section" style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid' }}>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <p className="text-sm font-bold text-stone-500 dark:text-stone-400">اسم وتوقيع السائق</p>
                    <div className="h-24 border-b border-stone-200 dark:border-stone-700 flex items-center justify-center bg-white dark:bg-stone-800">
                      {viewingReport.driverSignature && <img src={viewingReport.driverSignature} className="max-h-full" />}
                    </div>
                    <p className="text-xs font-bold text-stone-400 dark:text-stone-500">{viewingReport.driverName}</p>
                  </div>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <p className="text-sm font-bold text-stone-500 dark:text-stone-400">مسؤول قسم التجهيز</p>
                    <div className="h-24 border-b border-stone-200 dark:border-stone-700 flex items-center justify-center bg-white dark:bg-stone-800">
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
