'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';

interface ParcelDetail {
  id: string;
  carrier: string;
  seller: { name: string };
  codAmount: number;
  originLocation: { name: string };
  destinationLocation: { name: string };
  createdAt: string;
}

export default function ParcelLabelPrint() {
  const params = useParams();
  const id = params.id as string;
  const [parcel, setParcel] = useState<ParcelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [labelSize, setLabelSize] = useState<'A4' | 'thermal'>('thermal');

  useEffect(() => {
    async function fetchParcel() {
      try {
        const res = await fetch(`/api/parcels`);
        const data = await res.json();
        const found = data.data?.find((p: any) => p.id === id);
        if (found) {
          setParcel({
            id: found.id,
            carrier: found.carrier || 'ST_COURIER',
            seller: found.seller || { name: 'ElectroWorld Seller' },
            codAmount: Number(found.codAmount),
            originLocation: found.originLocation,
            destinationLocation: found.destinationLocation,
            createdAt: found.createdAt,
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchParcel();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!parcel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <p className="text-slate-500 font-medium">Parcel not found.</p>
      </div>
    );
  }

  const scanUrl = `${window.location.origin}/?scan=${parcel.id}`;
  const qrCodeSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(scanUrl)}`;
  const barcodeSrc = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(parcel.id)}&scale=3&rotate=N&includetext`;

  return (
    <div className="min-h-screen bg-slate-100 p-4 print:p-0 print:bg-white flex flex-col items-center">
      {/* Control panel (hidden on print) */}
      <div className="w-full max-w-md bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col gap-3 print:hidden">
        <div className="flex items-center justify-between">
          <button onClick={() => window.close()} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /> Close
          </button>
          <span className="font-bold text-slate-800 text-sm">Print Options</span>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setLabelSize('thermal')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${labelSize === 'thermal' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            4" x 6" Thermal Label
          </button>
          <button
            onClick={() => setLabelSize('A4')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${labelSize === 'A4' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            Standard A4 Sheet
          </button>
        </div>

        <button onClick={() => window.print()} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md shadow-blue-500/10">
          <Printer className="w-4 h-4" /> Print Label
        </button>
      </div>

      {/* Printable Label Layout */}
      <div className={`bg-white border border-slate-300 shadow-lg text-slate-900 select-none print:border-0 print:shadow-none flex flex-col
        ${labelSize === 'thermal' ? 'w-[4in] h-[6in] p-4 text-[12px]' : 'w-[21cm] h-[29.7cm] p-16 text-sm'}
      `}>
        {/* Company Header */}
        <div className="border-b-2 border-slate-950 pb-2 flex items-center justify-between">
          <div>
            <h1 className="font-extrabold text-[15px] tracking-tight text-blue-700 uppercase">
              {parcel.carrier.replace('_', ' ')}
            </h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">FindMe Logistics Partner</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 border border-slate-950 rounded uppercase">COD SHIPMENT</span>
        </div>

        {/* Sender / Receiver Info */}
        <div className="grid grid-cols-2 gap-4 border-b-2 border-slate-950 py-3">
          <div>
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">From (Seller)</span>
            <div className="font-bold text-slate-900 leading-tight">{parcel.seller.name}</div>
            <div className="text-[10px] text-slate-600 mt-1">{parcel.originLocation.name}</div>
          </div>
          <div>
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">To (Destination)</span>
            <div className="font-bold text-slate-900 leading-tight">{parcel.destinationLocation.name}</div>
            <div className="text-[10px] text-slate-600 mt-1">Tamil Nadu Office</div>
          </div>
        </div>

        {/* COD Amount Banner */}
        <div className="border-b-2 border-slate-950 py-3 text-center bg-slate-50">
          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Collect Cash on Delivery</span>
          <span className="text-2xl font-black text-slate-950">₹{parcel.codAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Codes & Routing Section */}
        <div className="flex-1 flex flex-col justify-around py-4">
          {/* Code128 Barcode */}
          <div className="flex flex-col items-center justify-center">
            <img src={barcodeSrc} alt={parcel.id} className="h-16 object-contain" />
          </div>

          {/* QR Code + Mini Info */}
          <div className="flex items-center gap-4 justify-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
            <img src={qrCodeSrc} alt="Scan QR" className="w-20 h-20 shrink-0 object-contain bg-white p-1 border border-slate-200 rounded-lg" />
            <div className="text-left">
              <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Mobile Tracking</div>
              <p className="text-[9px] text-slate-500 mt-1 leading-tight">Scan this QR code with any mobile camera to instantly access full tracking timeline and ledger confirmations.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-300 pt-2 flex justify-between text-[9px] font-bold text-slate-400">
          <span>Date: {new Date(parcel.createdAt).toLocaleDateString('en-IN')}</span>
          <span>FindMe Pilot Version</span>
        </div>
      </div>
    </div>
  );
}
