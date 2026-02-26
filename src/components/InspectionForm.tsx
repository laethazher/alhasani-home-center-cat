import React from 'react';
import { WEEKLY_INSPECTION_ITEMS } from '../constants';
import { CheckCircle2, Circle } from 'lucide-react';

interface InspectionFormProps {
  values: Record<number, boolean>;
  onChange: (id: number, checked: boolean) => void;
}

export const InspectionForm: React.FC<InspectionFormProps> = ({ values, onChange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
      {WEEKLY_INSPECTION_ITEMS.map((item) => (
        <label 
          key={item.id}
          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${
            values[item.id] 
            ? 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/40 dark:border-green-800 dark:text-green-200' 
            : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-300 dark:hover:border-stone-500'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs opacity-50">{item.id.toString().padStart(2, '0')}</span>
            <span className="font-medium">{item.label}</span>
          </div>
          
          <input 
            type="checkbox"
            className="hidden"
            checked={values[item.id] || false}
            onChange={(e) => onChange(item.id, e.target.checked)}
          />
          
          <div className="transition-transform group-active:scale-90">
            {values[item.id] ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <Circle className="w-6 h-6 text-stone-300 dark:text-stone-600" />
            )}
          </div>
        </label>
      ))}
    </div>
  );
};
