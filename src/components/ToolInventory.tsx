import React, { useState } from 'react';
import { TOOL_INVENTORY_ITEMS } from '../constants';
import { Package, Minus, Plus } from 'lucide-react';
import { ImageCapture } from './ImageCapture';

interface ToolInventoryProps {
  values: Record<number, number>;
  onChange: (id: number, count: number) => void;
  toolImages?: Record<number, string[]>;
  onImagesChange?: (id: number, images: string[]) => void;
}

export const ToolInventory: React.FC<ToolInventoryProps> = ({ 
  values, 
  onChange,
  toolImages = {},
  onImagesChange = (id: number, images: string[]) => { }
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOL_INVENTORY_ITEMS.map((item) => (
          <div 
            key={item.id}
            className="bg-white dark:bg-stone-800 p-4 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-stone-100 dark:bg-stone-700 rounded-lg">
                  <Package className="w-4 h-4 text-stone-600 dark:text-stone-300" />
                </div>
                <span className="font-bold text-sm leading-tight text-stone-900 dark:text-stone-100">{item.name}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-stone-900 text-white rounded-full">
                المطلوب: {item.quantity}
              </span>
            </div>

            <div className="flex items-center justify-between bg-stone-50 dark:bg-stone-700 p-2 rounded-lg mb-4">
              <button 
                onClick={() => onChange(item.id, Math.max(0, (values[item.id] || 0) - 1))}
                className="p-1 hover:bg-stone-200 dark:hover:bg-stone-600 rounded-md transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              
              <div className="flex flex-col items-center">
                <input 
                  type="number"
                  className="w-16 text-center text-lg font-bold bg-transparent border-b border-stone-200 dark:border-stone-600 focus:border-red-500 focus:outline-none text-stone-900 dark:text-stone-100"
                  value={values[item.id] || 0}
                  onChange={(e) => onChange(item.id, parseInt(e.target.value) || 0)}
                />
                <span className="text-[10px] text-stone-400">المتوفر</span>
              </div>

              <button 
                onClick={() => onChange(item.id, (values[item.id] || 0) + 1)}
                className="p-1 hover:bg-stone-200 rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Image Capture Component */}
            <ImageCapture 
              toolName={item.name}
              images={toolImages[item.id] || []}
              onImageCapture={(image) => {
                const currentImages = toolImages[item.id] || [];
                onImagesChange(item.id, [...currentImages, image]);
              }}
              onRemoveImage={(index) => {
                const currentImages = toolImages[item.id] || [];
                onImagesChange(item.id, currentImages.filter((_, i) => i !== index));
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
