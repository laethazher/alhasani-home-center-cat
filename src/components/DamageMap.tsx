import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, AlertCircle } from 'lucide-react';

interface DamagePoint {
  id: string;
  x: number;
  y: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export const DamageMap: React.FC<{ 
  points: DamagePoint[];
  onDamageChange: (points: DamagePoint[]) => void;
  cacheBuster?: number;
}> = ({ points, onDamageChange, cacheBuster }) => {
  const [activePoint, setActivePoint] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  const handleImageClick = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newPoint: DamagePoint = {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      description: '',
      severity: 'medium'
    };

    const updated = [...points, newPoint];
    onDamageChange(updated);
    setActivePoint(newPoint.id);
  };

  const removePoint = (id: string) => {
    const updated = points.filter(p => p.id !== id);
    setActivePoint(null);
    onDamageChange(updated);
  };

  const updatePoint = (id: string, updates: Partial<DamagePoint>) => {
    const updated = points.map(p => p.id === id ? { ...p, ...updates } : p);
    onDamageChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          تحديد أماكن الضرر
        </h3>
        <p className="text-sm text-stone-500">انقر على الصورة لتحديد مكان الضرر</p>
      </div>

      <div 
        ref={imgRef}
        className="relative rounded-xl overflow-hidden cursor-crosshair border-2 border-stone-200 shadow-inner group"
        onClick={handleImageClick}
      >
        <img 
          src="/truck-collage.jpg.jpg" 
          alt="Truck Angles" 
          className="w-full h-auto select-none opacity-95"
          crossOrigin="anonymous"
          onError={(e) => {
            // Fallback if the specific URL doesn't work
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=1200';
          }}
        />
        
        {points.map((point) => (
          <motion.div
            key={point.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute z-10"
            style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)' }}
            onClick={(e) => {
              e.stopPropagation();
              setActivePoint(point.id);
            }}
          >
            <div className={`w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-110`} style={{
              backgroundColor: point.severity === 'high' ? '#dc2626' : point.severity === 'medium' ? '#f97316' : '#facc15'
            }}>
              <Plus className="w-4 h-4 text-white" />
            </div>

            {activePoint === point.id && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-8 left-1/2 -translate-x-1/2 w-64 glass p-4 rounded-xl shadow-xl z-20"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-sm">تفاصيل الضرر</span>
                  <button onClick={() => removePoint(point.id)} className="text-stone-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <textarea
                  className="input-field text-sm h-20 mb-3 resize-none"
                  placeholder="وصف الضرر..."
                  value={point.description}
                  onChange={(e) => updatePoint(point.id, { description: e.target.value })}
                />

                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => updatePoint(point.id, { severity: s })}
                      className={`flex-1 text-[10px] py-1 rounded-md border transition-colors ${
                        point.severity === s 
                        ? 'bg-stone-900 text-white border-stone-900' 
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {s === 'high' ? 'كبير' : s === 'medium' ? 'متوسط' : 'بسيط'}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {points.length > 0 && (
          <div className="col-span-full bg-white p-4 rounded-xl border border-stone-200">
            <h4 className="font-bold mb-2 text-sm">قائمة الأضرار المحددة:</h4>
            <div className="space-y-2">
              {points.map((p, idx) => (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm p-3 bg-stone-50 rounded-lg border border-stone-100">
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`w-3 h-3 rounded-full shadow-sm`} style={{
                      backgroundColor: p.severity === 'high' ? '#dc2626' : p.severity === 'medium' ? '#f97316' : '#facc15'
                    }} />
                    <span className="font-mono font-bold text-stone-400">#{idx + 1}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase`} style={{
                      backgroundColor: p.severity === 'high' ? '#fee2e2' : p.severity === 'medium' ? '#ffedd5' : '#fef9c3',
                      color: p.severity === 'high' ? '#b91c1c' : p.severity === 'medium' ? '#c2410c' : '#a16207'
                    }}>
                      {p.severity === 'high' ? 'ضرر كبير' : p.severity === 'medium' ? 'ضرر متوسط' : 'ضرر بسيط'}
                    </span>
                  </div>
                  <span className="flex-1 text-stone-700 font-medium">{p.description || 'لا يوجد وصف مضاف'}</span>
                  <button 
                    onClick={() => removePoint(p.id)} 
                    className="self-end sm:self-auto p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
