'use client';

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw, Key, Image, Check, AlertCircle, Sparkles } from 'lucide-react';

interface ScanItem {
  trackingId: string;
  carrier: string;
  status: 'Imported' | 'Already Exists' | 'Pending Setup';
  time: string;
  type: 'Barcode' | 'QR' | 'Manual';
}

interface QRScannerProps {
  onImportNeeded: (trackingId: string, carrier: string, confidence: number) => void;
  onExistingFound: (parcel: any) => void;
  onClose: () => void;
}

export default function QRScanner({ onImportNeeded, onExistingFound, onClose }: QRScannerProps) {
  const [viewMode, setViewMode] = useState<'menu' | 'camera' | 'manual'>('menu');
  const [scanType, setScanType] = useState<'barcode' | 'qr'>('barcode');
  const [manualInput, setManualInput] = useState('');
  const [scanHistory, setScanHistory] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Camera fields
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const activeStream = useRef<MediaStream | null>(null);

  // Load user scan history from sessionStorage to keep it persistent for the session
  useEffect(() => {
    const saved = sessionStorage.getItem('findme_scans_today');
    if (saved) setScanHistory(JSON.parse(saved));
  }, []);

  const addHistoryItem = (item: ScanItem) => {
    const updated = [item, ...scanHistory].slice(0, 5);
    setScanHistory(updated);
    sessionStorage.setItem('findme_scans_today', JSON.stringify(updated));
  };

  const stopCamera = () => {
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    if (activeStream.current) {
      activeStream.current.getTracks().forEach(track => track.stop());
      activeStream.current = null;
    }
  };

  const startCamera = async (type: 'barcode' | 'qr') => {
    setScanType(type);
    setViewMode('camera');
    setLoading(true);
    setErrorMsg('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      activeStream.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        setLoading(false);
        scanFrame();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to access camera.');
      setLoading(false);
      setViewMode('menu');
    }
  };

  // Rule-based Carrier Detector
  const detectCarrier = (code: string) => {
    const trackingStr = code.trim().toUpperCase();
    
    // ST Courier pattern (11-digit numbers starting with 639)
    if (/^639\d{8}$/.test(trackingStr)) {
      return { carrier: 'ST_COURIER', confidence: 99 };
    }
    
    // DTDC Pattern (starts with D or T followed by 9 digits)
    if (/^[DT]\d{9}$/.test(trackingStr)) {
      return { carrier: 'DTDC', confidence: 95 };
    }

    // Professional Courier Pattern (starts with P followed by 8 digits)
    if (/^P\d{8}$/.test(trackingStr)) {
      return { carrier: 'PROFESSIONAL_COURIER', confidence: 90 };
    }

    // Default Fallback
    return { carrier: 'ST_COURIER', confidence: 60 };
  };

  const processScannedCode = async (code: string, type: 'Barcode' | 'QR' | 'Manual') => {
    stopCamera();
    setViewMode('menu');
    setLoading(true);

    try {
      // 1. Search database to check if parcel exists
      const res = await fetch(`/api/parcels`);
      const result = await res.json();
      const parcels = result.data || [];
      const found = parcels.find((p: any) => p.trackingNumber === code || p.id === code);

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (found) {
        // Handle Already Exists
        addHistoryItem({
          trackingId: code,
          carrier: found.carrier || 'ST_COURIER',
          status: 'Already Exists',
          time: timestamp,
          type,
        });
        onExistingFound(found);
      } else {
        // Handle New Import
        const { carrier, confidence } = detectCarrier(code);
        addHistoryItem({
          trackingId: code,
          carrier,
          status: 'Pending Setup',
          time: timestamp,
          type,
        });
        onImportNeeded(code, carrier, confidence);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to process consignment lookup.');
    } finally {
      setLoading(false);
    }
  };

  const scanFrame = () => {
    if (viewMode !== 'camera' || !videoRef.current || !canvasRef.current) return;

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
        // Successfully read
        processScannedCode(code.data, 'QR');
        return;
      }
    }

    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processScannedCode(manualInput.trim(), 'Manual');
    setManualInput('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col justify-between max-w-md mx-auto relative overflow-hidden shadow-2xl border-x border-slate-200">
      
      {/* Scanner Dashboard view */}
      {viewMode === 'menu' && (
        <div className="flex-1 flex flex-col justify-between p-5 bg-slate-900 text-white">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <span className="font-black text-sm uppercase tracking-wider">Scan Consignment</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold p-3 rounded-xl mt-4">
                {errorMsg}
              </div>
            )}

            {/* Menu options buttons */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                onClick={() => startCamera('barcode')}
                className="bg-slate-800 border border-slate-700 hover:bg-slate-700 p-5 rounded-2xl flex flex-col items-center gap-3 transition-colors duration-150 active:scale-95 transform"
              >
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold">Scan Barcode</span>
              </button>

              <button
                onClick={() => startCamera('qr')}
                className="bg-slate-800 border border-slate-700 hover:bg-slate-700 p-5 rounded-2xl flex flex-col items-center gap-3 transition-colors duration-150 active:scale-95 transform"
              >
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold">Scan QR Code</span>
              </button>
            </div>

            <button
              onClick={() => setViewMode('manual')}
              className="w-full bg-slate-800 border border-slate-700 hover:bg-slate-700 py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold mt-4 transition-colors active:scale-[0.98] transform"
            >
              <Key className="w-4 h-4 text-slate-400" /> Enter Tracking Number
            </button>

            {/* Today's Scans list */}
            <div className="mt-8">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-4">Today's Scans</span>
              
              {scanHistory.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-6 border border-dashed border-slate-800 rounded-2xl">
                  No scanned consignments recorded.
                </p>
              ) : (
                <div className="space-y-3">
                  {scanHistory.map((item, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-800/50 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <div className="font-mono font-bold text-slate-200">{item.trackingId}</div>
                        <div className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-wider">
                          {item.carrier.replace('_', ' ')} • {item.type}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          item.status === 'Imported' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          item.status === 'Already Exists' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {item.status}
                        </span>
                        <div className="text-[9px] text-slate-500 mt-1">{item.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-600 font-bold border-t border-slate-800 pt-4">
            FindMe 2.0 Logistics Engine
          </div>
        </div>
      )}

      {/* Video Viewfinder */}
      {viewMode === 'camera' && (
        <div className="flex-1 flex flex-col justify-between p-5 bg-slate-950 text-white">
          <div className="flex items-center justify-between pb-4">
            <span className="font-bold text-xs uppercase tracking-wider">Align Barcode / QR Code</span>
            <button onClick={() => { stopCamera(); setViewMode('menu'); }} className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl flex items-center justify-center">
            {loading ? (
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            ) : (
              <>
                <video ref={videoRef} className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-10 border-2 border-dashed border-blue-500 rounded-2xl pointer-events-none flex items-center justify-center">
                  <div className="w-full h-0.5 bg-blue-500 animate-bounce"></div>
                </div>
              </>
            )}
          </div>

          <div className="text-center text-[10px] text-slate-500 font-bold leading-relaxed px-8">
            Camera facing mode automatically adjusts. Position the alignment bar over the label.
          </div>
        </div>
      )}

      {/* Manual Input view */}
      {viewMode === 'manual' && (
        <div className="flex-1 flex flex-col justify-between p-5 bg-slate-900 text-white">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="font-bold text-xs uppercase tracking-wider">Manual Tracking Entry</span>
              <button onClick={() => setViewMode('menu')} className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-2">Consignment ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 63934401075"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="w-full bg-slate-800 text-sm px-4 py-3 rounded-xl border border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 font-mono font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 py-3.5 px-4 rounded-xl text-xs font-bold active:scale-[0.98] transform transition-transform"
              >
                Lookup Consignment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
