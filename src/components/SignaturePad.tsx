import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  onSave: (signature: string) => void;
  defaultValue?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ label, onSave, defaultValue }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
    onSave('');
  };

  const save = () => {
    if (sigCanvas.current) {
      if (sigCanvas.current.isEmpty()) {
        onSave('');
      } else {
        const source = sigCanvas.current.getCanvas();
        const out = document.createElement('canvas');
        const maxWidth = 900;
        const ratio = Math.min(maxWidth / source.width, 1);
        out.width = Math.max(1, Math.round(source.width * ratio));
        out.height = Math.max(1, Math.round(source.height * ratio));
        const ctx = out.getContext('2d');
        if (!ctx) {
          onSave(source.toDataURL('image/jpeg', 0.7));
          return;
        }
        // White background to preserve signature visibility when converting from transparent PNG.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(source, 0, 0, out.width, out.height);
        onSave(out.toDataURL('image/jpeg', 0.65));
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-bold text-stone-600 dark:text-stone-300">{label}</label>
        <button 
          onClick={clear}
          className="text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1"
          title="مسح التوقيع"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
      <div className="border-2 border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 overflow-hidden h-40 relative">
        {defaultValue ? (
          <img src={defaultValue} alt="Signature" className="w-full h-full object-contain p-2" />
        ) : (
          <SignatureCanvas
            ref={sigCanvas}
            penColor="black"
            canvasProps={{
              className: "signature-canvas w-full h-full cursor-crosshair",
            }}
            onEnd={save}
          />
        )}
      </div>
    </div>
  );
};
