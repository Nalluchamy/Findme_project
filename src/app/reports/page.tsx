'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Printer, Calendar, RefreshCw } from 'lucide-react';

interface ReportData {
  date: string;
  totalCollected: number;
  totalSettled: number;
  totalPending: number;
  discrepanciesCount: number;
  discrepanciesList: {
    parcelId: string;
    expected: number;
    confirmed: number;
    note: string;
  }[];
  agents: { name: string; amount: number; count: number }[];
  branches: { name: string; amount: number; count: number }[];
}

export default function DailyCashClosingReport() {
  const [dateInput, setDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/daily?date=${dateInput}`);
      const data = await res.json();
      if (!data.error) setReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateInput]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 print:p-0 print:bg-white flex flex-col items-center">
      
      {/* Control panel (hidden on print) */}
      <div className="w-full max-w-2xl bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col gap-4 print:hidden">
        <div className="flex items-center justify-between">
          <button onClick={() => window.close()} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <span className="font-bold text-slate-800 text-sm">Daily Closing Report</span>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Select Report Date</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full bg-slate-100 text-sm pl-10 pr-4 py-3 rounded-xl border border-transparent focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-semibold text-slate-800"
              />
            </div>
          </div>
          <button onClick={() => window.print()} className="bg-blue-600 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/10 shrink-0">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-slate-400 text-sm font-medium">Generating financial closing report...</p>
        </div>
      ) : report ? (
        /* Printable Report Layout */
        <div className="bg-white border border-slate-200 shadow-lg text-slate-900 select-none print:border-0 print:shadow-none w-[21cm] p-12 min-h-[29.7cm] flex flex-col justify-between">
          
          {/* Header */}
          <div>
            <div className="border-b-2 border-slate-950 pb-4 flex items-start justify-between">
              <div>
                <h1 className="font-black text-2xl tracking-tight text-slate-950 uppercase">COURIER CONNECT</h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">DAILY CASH CLOSING SUMMARY</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 inline-block">
                  Date: {new Date(report.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Financial Overview Tiles */}
            <div className="grid grid-cols-3 gap-4 py-6 border-b border-slate-200">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Total COD Collected</span>
                <span className="text-xl font-extrabold text-slate-950">₹{report.totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Total Payouts Settled</span>
                <span className="text-xl font-extrabold text-emerald-600">₹{report.totalSettled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Active Vault Balance</span>
                <span className="text-xl font-extrabold text-blue-600">₹{report.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Content Lists */}
            <div className="grid grid-cols-2 gap-8 py-6">
              
              {/* Agent Breakdown */}
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">Delivery Agent Cash</h3>
                {report.agents.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No collections registered today.</p>
                ) : (
                  <div className="space-y-2">
                    {report.agents.map((agent, i) => (
                      <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-50">
                        <span className="text-slate-600 font-medium">{agent.name} <span className="text-[10px] text-slate-400">({agent.count} collections)</span></span>
                        <span className="font-bold text-slate-900">₹{agent.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Branch Summary */}
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">Branch Vault Status</h3>
                {report.branches.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No branch transactions registered today.</p>
                ) : (
                  <div className="space-y-2">
                    {report.branches.map((branch, i) => (
                      <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-50">
                        <span className="text-slate-600 font-medium">{branch.name}</span>
                        <span className="font-bold text-slate-900">₹{branch.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Discrepancy Audits */}
            <div className="py-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">Flagged Discrepancies ({report.discrepanciesCount})</h3>
              {report.discrepanciesList.length === 0 ? (
                <p className="text-xs text-emerald-600 font-medium">✓ No discrepancies or accounting variances flagged today.</p>
              ) : (
                <div className="border border-rose-100 rounded-xl overflow-hidden divide-y divide-rose-50">
                  {report.discrepanciesList.map((disc, i) => (
                    <div key={i} className="p-3 bg-rose-50/50 flex justify-between items-start text-xs">
                      <div>
                        <span className="font-mono font-bold text-rose-600">{disc.parcelId}</span>
                        <p className="text-[10px] text-rose-500 mt-1 italic">{disc.note}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-500 text-[10px]">Expected: ₹{disc.expected}</div>
                        <div className="font-bold text-rose-600 mt-0.5">Confirmed: ₹{disc.confirmed}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Signature Panel */}
          <div className="pt-20">
            <div className="grid grid-cols-2 gap-16 text-center text-xs font-bold text-slate-600">
              <div>
                <div className="border-t border-slate-400 pt-2 w-48 mx-auto"></div>
                <p className="uppercase tracking-wider">Cashier / Staff Signature</p>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-2 w-48 mx-auto"></div>
                <p className="uppercase tracking-wider">Finance Manager Signature</p>
              </div>
            </div>
            <div className="text-center text-[10px] text-slate-400 mt-8 border-t border-slate-100 pt-4 flex justify-between">
              <span>FindMe Reconciliation Audit Document</span>
              <span>Generated on {new Date().toLocaleString('en-IN')}</span>
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
}
