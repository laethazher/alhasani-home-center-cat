import React, { useRef, useState } from 'react';
import { Camera, X, Download, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ImageCaptureProps {
  onImageCapture: (imageData: string) => void;
  images: string[];
  onRemoveImage: (index: number) => void;
  toolName: string;
}

export const ImageCapture: React.FC<ImageCaptureProps> = ({ 
  onImageCapture, 
  images, 
  onRemoveImage,
  toolName 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isOpen, setIsOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string>('');

  const startCamera = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      setError('تعذر الوصول إلى الكاميرا. تأكد من مشاركة الأذونات.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const imageData = canvasRef.current.toDataURL('image/jpeg', 0.8);
        onImageCapture(imageData);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        onImageCapture(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = (imageData: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `${toolName}-photo-${index + 1}.jpg`;
    link.click();
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => {
            if (isOpen) stopCamera();
            setIsOpen(!isOpen);
          }}
          className="w-full py-2 px-3 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4" />
          {isOpen ? 'إغلاق الكاميرا' : 'التقاط صور'}
        </button>

        {/* Camera Interface */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-3 bg-stone-50 p-3 rounded-lg border-2 border-blue-200"
          >
            {error && (
              <div className="text-xs text-red-600 dark:text-red-300 font-bold bg-red-50 dark:bg-red-900 p-2 rounded">
                {error}
              </div>
            )}

            {!isCameraActive ? (
              <div className="flex gap-2">
                <button
                  onClick={startCamera}
                  className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  تشغيل الكاميرا
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm transition-colors"
                >
                  رفع صورة
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg bg-black"
                />
                <div className="flex gap-2">
                  <button
                    onClick={capturePhoto}
                    className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm transition-colors"
                  >
                    التقاط صورة
                  </button>
                  <button
                    onClick={stopCamera}
                    className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-colors"
                  >
                    إيقاف
                  </button>
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        )}

        {/* Image Gallery */}
        {images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 space-y-2"
          >
            <p className="text-xs font-bold text-stone-600">
              {images.length} صورة {images.length === 1 ? 'ملتقطة' : 'ملتقطات'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {images.map((image, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative group rounded-lg overflow-hidden border-2 border-stone-200"
                >
                  <img
                    src={image}
                    alt={`صورة ${index + 1}`}
                    className="w-full h-24 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => downloadImage(image, index)}
                      className="p-1.5 bg-white dark:bg-stone-700 rounded-full hover:bg-stone-100 dark:hover:bg-stone-600"
                      title="تحميل"
                    >
                      <Download className="w-3 h-3 text-green-600" />
                    </button>
                    <button
                      onClick={() => onRemoveImage(index)}
                      className="p-1.5 bg-white dark:bg-stone-700 rounded-full hover:bg-stone-100 dark:hover:bg-stone-600"
                      title="حذف"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </button>
                  </div>
                  <span className="absolute top-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {index + 1}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
};
