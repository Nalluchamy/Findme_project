'use client';

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw } from 'lucide-react';

interface QRScannerProps {
  onScan: (parcelId: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const animationFrameId = useRef<number | null>(null);
  const activeStream = useRef<MediaStream | null>(null);

  const stopScanner = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    if (activeStream.current) {
      activeStream.current.getTracks().forEach(track => track.stop());
    }
  };

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        activeStream.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
          videoRef.current.play();
          setLoading(false);
          scanFrame();
        }
      } catch (err: any) {
        console.error(err);
        setError('Camera permission denied or not available.');
        setLoading(false);
      }
    }

    startCamera();

    return () => {
      stopScanner();
    };
  }, []);

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        // Parse deep link or raw parcel code
        let parsedId = code.data;
        if (code.data.includes('?scan=')) {
          const urlParams = new URLSearchParams(code.data.split('?')[1]);
          parsedId = urlParams.get('scan') || code.data;
        }

        stopScanner();
        onScan(parsedId);
        return;
      }
    }

    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-6">
      
      {/* Top Close Bar */}
      <div className="flex items-center justify-between text-white">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Camera className="w-4 h-4 text-blue-500 animate-pulse" /> Live QR Scanner
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Video Viewfinder */}
      <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs">Initializing camera feed...</span>
          </div>
        )}
        
        {error ? (
          <p className="text-rose-500 text-xs font-bold px-6 text-center">{error}</p>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Viewfinder Target Reticle Overlay */}
            <div className="absolute inset-10 border-2 border-dashed border-blue-500 rounded-2xl pointer-events-none flex items-center justify-center">
              <div className="w-full h-0.5 bg-blue-500 animate-bounce"></div>
            </div>
          </>
        )}
      </div>

      {/* Helper Footer */}
      <div className="text-center text-slate-400 text-xs px-8 pb-4">
        Position the QR code inside the center frame to scan instantly.
      </div>
    </div>
  );
}
