'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, FileText, CheckCircle, AlertTriangle, Play, RefreshCw, HelpCircle } from 'lucide-react';
import { getCsrfToken } from '@/lib/utils'; // wait, is getCsrfToken in utils? Yes, let's verify if not we can write a simple one.

interface RawCSVRow {
  'Parcel ID'?: string;
  'COD Amount'?: string;
  'Origin Branch'?: string;
  'Destination Branch'?: string;
  'Seller Username'?: string;
  [key: string]: any;
}

export default function BulkCSVImport() {
  const router = useRouter();
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'validated' | 'success'>('upload');
  const [validationReport, setValidationReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    try {
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length < 2) {
        setErrorMsg('CSV must contain a header row and at least one data row.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const parsedRows = lines.slice(1).map((line) => {
        const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const rowObj: Record<string, string> = {};
        headers.forEach((header, idx) => {
          rowObj[header] = values[idx] || '';
        });
        return rowObj;
      });

      // Map file headers to model properties
      const mapped = parsedRows.map(row => ({
        id: row['Parcel ID'] || row['id'] || '',
        codAmount: Number(row['COD Amount'] || row['codAmount'] || 0),
        originLocationName: row['Origin Branch'] || row['originLocationName'] || '',
        destinationLocationName: row['Destination Branch'] || row['destinationLocationName'] || '',
        sellerUsername: row['Seller Username'] || row['sellerUsername'] || '',
      }));

      setRows(mapped);
      setStep('preview');
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Failed to parse CSV file: ' + e.message);
    }
  };

  const runValidation = async () => {
    setLoading(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('csrf_token='))?.split('=')[1] || '';
      const res = await fetch('/api/parcels/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({ action: 'validate', data: rows }),
      });
      const result = await res.json();
      if (result.success) {
        setValidationReport(result.data);
        setStep('validated');
      } else {
        setErrorMsg(result.error?.message || 'Validation failed.');
      }
    } catch (e: any) {
      setErrorMsg('Network error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    setLoading(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('csrf_token='))?.split('=')[1] || '';
      const res = await fetch('/api/parcels/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({ action: 'import', data: rows }),
      });
      const result = await res.json();
      if (result.success) {
        setValidationReport(result.data);
        setStep('success');
      } else {
        setErrorMsg(result.error?.message || 'Import execution failed.');
      }
    } catch (e: any) {
      setErrorMsg('Network error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl border-x border-slate-200">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between shrink-0 h-14">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-[15px] text-slate-900 tracking-tight">Bulk Upload CSV</h1>
        <div className="w-7"></div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-5 space-y-4">
        
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl p-4 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center border-dashed border-slate-300 py-10 relative">
              <Upload className="w-10 h-10 text-blue-500 mb-3" />
              <p className="text-xs font-bold text-slate-700">Drag your CSV file here</p>
              <p className="text-[10px] text-slate-400 mt-1">Accepts only standard .csv format</p>
              
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>

            {/* CSV Format Helper */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 text-xs text-blue-700 space-y-2">
              <div className="flex items-center gap-2 font-bold text-blue-800">
                <HelpCircle className="w-4 h-4" /> Required Columns
              </div>
              <p className="text-[11px] leading-relaxed">Your CSV file header row must exactly match these columns:</p>
              <code className="block bg-white p-2 rounded-lg font-mono text-[10px] border border-blue-100">
                Parcel ID, COD Amount, Origin Branch, Destination Branch, Seller Username
              </code>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{fileName}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{rows.length} rows parsed</div>
                </div>
              </div>
            </div>

            <button
              onClick={runValidation}
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Validate CSV Data
            </button>
          </div>
        )}

        {/* Step 3: Validated Dry Run Results */}
        {step === 'validated' && validationReport && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">Dry-Run Validation Report</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-center">
                  <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">Valid Rows</span>
                  <span className="text-lg font-black text-emerald-700">{validationReport.imported}</span>
                </div>
                <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 text-center">
                  <span className="text-[9px] font-extrabold text-rose-600 uppercase tracking-wider block">Skipped Rows</span>
                  <span className="text-lg font-black text-rose-700">{validationReport.skipped}</span>
                </div>
              </div>

              {/* Errors logs list */}
              {validationReport.errors.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Skipped Reasons</span>
                  {validationReport.errors.map((err: any, idx: number) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex gap-2 text-[10px] items-start">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700">Row {err.row}:</span> {err.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 border border-slate-200 bg-white text-slate-700 py-3.5 rounded-xl font-bold text-xs"
              >
                Re-upload
              </button>
              <button
                onClick={runImport}
                disabled={loading || validationReport.imported === 0}
                className="flex-1 bg-emerald-600 text-white font-bold py-3.5 rounded-xl text-xs hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm Import'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Import Complete Success Screen */}
        {step === 'success' && validationReport && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center py-10 space-y-4">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Import Execution Complete</h2>
            <p className="text-xs text-slate-500 leading-relaxed px-4">
              Successfully wrote **{validationReport.imported}** new parcels into the ledger. **{validationReport.skipped}** rows were filtered out during validation.
            </p>

            <button
              onClick={() => router.push('/')}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-xs shadow-md shadow-blue-500/10 active:scale-95 transition-transform"
            >
              Go to Shipments
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
