'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRScanner from '@/components/QRScanner';
import {
  User, Shield, Truck, Building, Layers, Search, DollarSign,
  MapPin, LogOut, Package, RefreshCw, Menu, Home, Wallet,
  ChevronRight, ArrowLeft, MoreVertical, CreditCard, ChevronDown, CheckCircle, Target, ArrowRight, Clock, X, Settings, HelpCircle,
  AlertTriangle, Activity, TrendingUp, Users, BarChart3, Zap, Printer, Upload, Camera
} from 'lucide-react';

function getCsrfToken() {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(row => row.startsWith('csrf_token='))?.split('=')[1] || '';
}

interface Location {
  id: string;
  name: string;
  type: 'BRANCH' | 'HUB';
}

interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: string;
  locationId: string | null;
}

interface LedgerEvent {
  id: string;
  parcelId: string;
  eventType: string;
  fromPartyId?: string | null;
  fromParty?: UserProfile | null;
  toPartyId?: string | null;
  toParty?: UserProfile | null;
  expectedAmount: number;
  confirmedAmount: number | null;
  confirmedByFrom: boolean;
  confirmedByTo: boolean;
  photoUrl?: string | null;
  gpsCoords?: string | null;
  timestamp: string;
  discrepancyNote?: string | null;
}

interface Parcel {
  id: string;
  sellerId: string;
  codAmount: number;
  originLocationId: string;
  originLocation: Location;
  destinationLocationId: string;
  destinationLocation: Location;
  currentState: string;
  createdAt: string;
  ledgerEvents: LedgerEvent[];
}

interface AdminStats {
  totalParcels: number;
  todayParcels: number;
  pendingAmount: number;
  discrepancies: number;
  settledTodayAmount: number;
  activeAgents: number;
  statusBreakdown: { currentState: string; _count: { currentState: number } }[];
  recentEvents: any[];
}

export default function FindMeApp() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [metadata, setMetadata] = useState<{ locations: Location[]; users: UserProfile[] }>({
    locations: [], users: []
  });
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'parcels' | 'settlements' | 'profile' | 'admin' | 'discrepancies' | 'scan'>('parcels');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Forms
  const [actionAmount, setActionAmount] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [actionTargetUser, setActionTargetUser] = useState('');
  const [discrepancyResolveNote, setDiscrepancyResolveNote] = useState('');
  const [discrepancyResolveAmount, setDiscrepancyResolveAmount] = useState('');

  // Scanning flow states
  const [scanImportInfo, setScanImportInfo] = useState<{ id: string; carrier: string; confidence: number } | null>(null);
  const [duplicateFoundInfo, setDuplicateFoundInfo] = useState<any | null>(null);
  const [importStep, setImportStep] = useState<'idle' | 'saving' | 'ledger' | 'done'>('idle');
  const [importFields, setImportFields] = useState({
    sellerId: '',
    codAmount: '',
    originId: '',
    destId: '',
    photoUrl: '',
  });

  const [resolvingParcelId, setResolvingParcelId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    // Unregister any old service workers immediately to prevent stale caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
    fetchSession();
  }, []);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        loadData();
        if (user.role === 'ADMIN') loadAdminStats();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [user, searchQuery]);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        
        // Scopes role defaults
        if (data.user.role === 'ADMIN') {
          setActiveTab('admin');
        } else if (data.user.role === 'BRANCH_STAFF') {
          setActiveTab('scan');
        } else if (data.user.role === 'FINANCE_OFFICER') {
          setActiveTab('settlements');
        } else {
          setActiveTab('parcels');
        }

        const urlParams = new URLSearchParams(window.location.search);
        const scanId = urlParams.get('scan');
        if (scanId) {
          setSelectedParcelId(scanId);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(''); setIsAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      const data = await res.json();
      if (res.ok && data.user) setUser(data.user);
      else setAuthError(data.error || 'Login failed');
    } catch (err) {
      setAuthError('Connection error.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleQuickLogin = async (username: string) => {
    setAuthError(''); setIsAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ username, password: 'password123' }),
      });
      const data = await res.json();
      if (res.ok && data.user) setUser(data.user);
      else setAuthError(data.error);
    } catch (err) {
      setAuthError('Connection error.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/me', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() } });
      setUser(null); setParcels([]); setSelectedParcelId(null); setActiveTab('parcels'); setAdminStats(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanImportInfo) return;
    
    setImportStep('saving');
    try {
      const res = await fetch('/api/parcels/import-consignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken(),
        },
        body: JSON.stringify({
          trackingNumber: scanImportInfo.id,
          carrier: scanImportInfo.carrier,
          sellerId: importFields.sellerId,
          codAmount: parseFloat(importFields.codAmount),
          originLocationId: importFields.originId,
          destinationLocationId: importFields.destId,
          photoUrl: importFields.photoUrl || undefined,
        }),
      });

      setImportStep('ledger');
      const data = await res.json();
      
      if (res.ok && data.success) {
        setImportStep('done');
        setTimeout(() => {
          setScanImportInfo(null);
          setImportStep('idle');
          setImportFields({ sellerId: '', codAmount: '', originId: '', destId: '', photoUrl: '' });
          loadData();
        }, 1200);
      } else {
        alert(data.error?.message || 'Failed to import consignment.');
        setImportStep('idle');
      }
    } catch (err: any) {
      alert('Network error: ' + err.message);
      setImportStep('idle');
    }
  };

  const loadAdminStats = async () => {
    setIsAdminLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (!data.error) setAdminStats(data);
    } catch (e) { console.error(e); }
    finally { setIsAdminLoading(false); }
  };

  const handleDiscrepancyResolve = async (parcelId: string, targetState: string) => {
    if (!discrepancyResolveNote.trim()) { alert('Please add a resolution note.'); return; }
    const amount = parseFloat(discrepancyResolveAmount);
    if (isNaN(amount) || amount <= 0) { alert('Please enter a valid resolved amount.'); return; }
    try {
      const res = await fetch('/api/discrepancies/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ parcelId, targetState, resolvedAmount: amount, note: discrepancyResolveNote }),
      });
      if (res.ok) {
        alert('Discrepancy resolved!');
        setResolvingParcelId(null); setDiscrepancyResolveNote(''); setDiscrepancyResolveAmount('');
        loadData();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to resolve');
      }
    } catch (e) { alert('Error'); }
  };

  const loadData = async () => {
    setIsDataLoading(true);
    try {
      const resParcels = await fetch(`/api/parcels?page=1&pageSize=50&search=${encodeURIComponent(searchQuery)}`);
      const dataParcels = await resParcels.json();
      if (dataParcels.data) setParcels(dataParcels.data);

      const resMeta = await fetch('/api/metadata');
      const dataMeta = await resMeta.json();
      if (dataMeta.locations) setMetadata(dataMeta);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDataLoading(false);
    }
  };

  // Actions
  const handleCollect = async (id: string, amount: number) => {
    try {
      const res = await fetch(`/api/parcels/${id}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ amount }),
      });
      if (res.ok) { alert('Collected!'); loadData(); setSelectedParcelId(null); }
      else alert((await res.json()).error);
    } catch (e) { alert('Error'); }
  };

  const handleHandoverInitiate = async (id: string, eventType: string, amount: number, toPartyId: string) => {
    try {
      const res = await fetch(`/api/parcels/${id}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ eventType, expectedAmount: amount, toPartyId }),
      });
      if (res.ok) { alert('Handover initiated!'); loadData(); setSelectedParcelId(null); }
      else alert((await res.json()).error);
    } catch (e) { alert('Error'); }
  };

  const handleHandoverConfirm = async (id: string, amount: number) => {
    try {
      const res = await fetch(`/api/parcels/${id}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (res.ok) { alert(data.flagged ? 'Discrepancy Flagged!' : 'Confirmed!'); loadData(); setSelectedParcelId(null); }
      else alert(data.error);
    } catch (e) { alert('Error'); }
  };

  const handlePayout = async (id: string) => {
    try {
      const res = await fetch(`/api/parcels/${id}/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ referenceId: `TXN-${Math.floor(Math.random()*10000)}` }),
      });
      if (res.ok) { alert('Payout processed!'); loadData(); setSelectedParcelId(null); }
      else alert((await res.json()).error);
    } catch (e) { alert('Error'); }
  };

  // UI Helpers
  const getBadgeStyle = (state: string) => {
    switch (state) {
      case 'CREATED': return 'text-slate-600 bg-slate-100 border border-slate-200';
      case 'COD_COLLECTED': return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
      case 'HANDOVER_TO_DEST_HUB': return 'text-blue-700 bg-blue-50 border border-blue-200';
      case 'HANDOVER_TO_ORIGIN_HUB': return 'text-indigo-700 bg-indigo-50 border border-indigo-200';
      case 'HANDOVER_TO_ORIGIN_BRANCH': return 'text-violet-700 bg-violet-50 border border-violet-200';
      case 'SETTLED_TO_SELLER': return 'text-green-700 bg-green-50 border border-green-200';
      case 'DISCREPANCY_FLAGGED': return 'text-red-700 bg-red-50 border border-red-200';
      default: return 'text-slate-600 bg-slate-100 border border-slate-200';
    }
  };
  
  const getFriendlyState = (state: string) => {
    switch (state) {
      case 'CREATED': return 'PENDING COLLECTION';
      case 'COD_COLLECTED': return 'COLLECTED';
      case 'HANDOVER_TO_DEST_HUB': return 'DEST HUB';
      case 'HANDOVER_TO_ORIGIN_HUB': return 'IN TRANSIT';
      case 'HANDOVER_TO_ORIGIN_BRANCH': return 'ORIGIN BRANCH';
      case 'SETTLED_TO_SELLER': return 'COMPLETED';
      case 'DISCREPANCY_FLAGGED': return 'DISCREPANCY';
      default: return state;
    }
  };

  const selectedParcel = parcels.find(p => p.id === selectedParcelId);

  // Show neutral loading screen until client mounts (prevents hydration mismatch)
  if (!mounted || isAuthLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-[var(--color-primary)] text-white p-4 rounded-2xl shadow-xl shadow-blue-500/20">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Courier Connect</h1>
          <div className="flex gap-1 mt-2">
            <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce" style={{animationDelay:'0ms'}}></div>
            <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce" style={{animationDelay:'150ms'}}></div>
            <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce" style={{animationDelay:'300ms'}}></div>
          </div>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-center items-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-[var(--color-primary)] text-white p-3.5 rounded-2xl shadow-xl shadow-blue-500/20 mb-4">
              <Package className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Courier Connect</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Sign in to manage settlements</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Username</label>
              <input
                type="text"
                placeholder="Enter your username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-4 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-4 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
              />
            </div>
            {authError && <p className="text-sm text-red-500 font-semibold px-1">{authError}</p>}
            
            <button
              type="submit"
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/25 transition-transform active:scale-95 mt-2"
            >
              Sign In
            </button>
          </form>

          <div className="mt-12">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-3 bg-white text-slate-400 font-medium text-xs uppercase tracking-widest">Demo Accounts</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              {[
                { id: 'agent', label: 'Delivery Agent', icon: Truck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                { id: 'branch_mum', label: 'Branch Staff', icon: Building, color: 'text-blue-500', bg: 'bg-blue-50' },
                { id: 'finance', label: 'Finance', icon: Wallet, color: 'text-amber-500', bg: 'bg-amber-50' },
                { id: 'seller', label: 'Seller', icon: User, color: 'text-purple-500', bg: 'bg-purple-50' },
              ].map(demo => (
                <button
                  key={demo.id}
                  onClick={() => handleQuickLogin(demo.id)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 shadow-sm transition-colors text-left"
                >
                  <div className={`p-2 rounded-lg ${demo.bg}`}><demo.icon className={`w-4 h-4 ${demo.color}`} /></div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">{demo.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN APP DASHBOARD
  return (
    <div className="h-screen bg-[var(--background)] text-slate-900 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl border-x border-slate-200">
      
      {/* Header App Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between z-20 shrink-0 relative h-14">
        {!isSearchOpen ? (
          <>
            <button onClick={() => setIsMenuOpen(true)} className="text-slate-500 hover:text-[var(--color-primary)] p-1.5 -ml-1.5 rounded-full transition-colors active:bg-slate-100">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-[15px] text-slate-900 tracking-tight absolute left-1/2 -translate-x-1/2">Courier Connect</h1>
            <div className="flex items-center gap-1 -mr-1.5">
              <button onClick={() => setIsScannerOpen(true)} className="text-slate-500 hover:text-[var(--color-primary)] p-1.5 rounded-full transition-colors active:bg-slate-100" title="Scan QR Code">
                <Camera className="w-5 h-5" />
              </button>
              <button onClick={() => setIsSearchOpen(true)} className="text-slate-500 hover:text-[var(--color-primary)] p-1.5 rounded-full transition-colors active:bg-slate-100">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center w-full animate-in slide-in-from-right-4 duration-200">
            <Search className="w-4 h-4 text-slate-400 absolute left-6" />
            <input 
              type="text" 
              autoFocus
              placeholder="Search by ID or destination..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 text-sm pl-10 pr-10 py-2 rounded-full outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            />
            <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="absolute right-6 text-slate-400 hover:text-rose-500 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Side Menu Drawer Overlay */}
      {isMenuOpen && (
        <div className="absolute inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsMenuOpen(false)}></div>
          <div className="w-3/4 max-w-[280px] bg-white h-full relative z-10 animate-in slide-in-from-left duration-300 shadow-2xl flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 text-[var(--color-primary)] rounded-full flex items-center justify-center font-bold text-xl shadow-sm">
                {user?.name.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-slate-900">{user?.name}</div>
                <div className="text-[10px] font-semibold text-[var(--color-primary)] uppercase tracking-wider">{user?.role.replace('_', ' ')}</div>
              </div>
            </div>
            
            <div className="p-4 space-y-1 overflow-y-auto flex-1">
              <button onClick={() => setIsMenuOpen(false)} className="w-full flex items-center gap-3 p-3 text-slate-700 hover:bg-slate-50 hover:text-[var(--color-primary)] rounded-xl text-sm font-semibold transition-colors text-left">
                <Package className="w-4 h-4" /> Shipments
              </button>
              <button onClick={() => { setIsMenuOpen(false); setActiveTab('settlements'); }} className="w-full flex items-center gap-3 p-3 text-slate-700 hover:bg-slate-50 hover:text-[var(--color-primary)] rounded-xl text-sm font-semibold transition-colors text-left">
                <Wallet className="w-4 h-4" /> Finance
              </button>
              {(user?.role === 'FINANCE_OFFICER' || user?.role === 'ADMIN') && (
                <button onClick={() => { setIsMenuOpen(false); window.open('/reports', '_blank'); }} className="w-full flex items-center gap-3 p-3 text-slate-700 hover:bg-slate-50 hover:text-[var(--color-primary)] rounded-xl text-sm font-semibold transition-colors text-left">
                  <BarChart3 className="w-4 h-4" /> Daily Closing Report
                </button>
              )}
              <button disabled className="w-full flex items-center gap-3 p-3 text-slate-400 opacity-60 rounded-xl text-sm font-semibold text-left">
                <Clock className="w-4 h-4" /> Pending Tasks
              </button>
              
              <div className="h-px w-full bg-slate-100 my-4"></div>
              
              <button disabled className="w-full flex items-center gap-3 p-3 text-slate-400 opacity-60 rounded-xl text-sm font-semibold text-left">
                <Settings className="w-4 h-4" /> Settings
              </button>
              <button disabled className="w-full flex items-center gap-3 p-3 text-slate-400 opacity-60 rounded-xl text-sm font-semibold text-left">
                <HelpCircle className="w-4 h-4" /> Help Center
              </button>
            </div>

            <div className="p-4 border-t border-slate-100">
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-bold py-3 px-4 rounded-xl transition-colors text-sm">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto pb-24 relative">
        
        {/* SCAN TAB — Consignment Scanner Dashboard */}
        {activeTab === 'scan' && (
          <div className="absolute inset-0 bg-slate-900 z-40">
            <QRScanner
              onImportNeeded={(id, carrier, confidence) => {
                setScanImportInfo({ id, carrier, confidence });
                setImportFields({
                  sellerId: metadata.users.find(u => u.role === 'SELLER')?.id || '',
                  codAmount: '1500',
                  originId: metadata.locations.find(l => l.type === 'BRANCH')?.id || '',
                  destId: metadata.locations.find(l => l.type === 'BRANCH')?.id || '',
                  photoUrl: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=500',
                });
              }}
              onExistingFound={(parcel) => {
                setDuplicateFoundInfo(parcel);
              }}
              onClose={() => setActiveTab('parcels')}
            />
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 border-4 border-blue-100">
                <User className="w-10 h-10 text-[var(--color-primary)]" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">{user?.name}</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">{user?.role.replace('_', ' ')}</p>
              <div className="mt-4 px-4 py-1.5 bg-slate-100 rounded-full text-xs font-mono font-semibold text-slate-600">
                ID: {user?.id.split('-')[0]}
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 bg-white border border-rose-200 text-rose-600 font-bold py-3.5 px-4 rounded-xl hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}

        {/* PARCELS TAB — Active parcel list */}
        {activeTab === 'parcels' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[13px] font-bold text-slate-800">Active Parcels</h3>
              <div className="flex items-center gap-2">
                {(user?.role === 'BRANCH_STAFF' || user?.role === 'ADMIN') && (
                  <button onClick={() => setActiveTab('scan')} className="text-blue-600 hover:text-blue-800 text-[10px] font-bold flex items-center gap-1 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1 active:scale-95 transition-all shadow-sm">
                    <Camera className="w-3 h-3" /> + Scan Consignment
                  </button>
                )}
                {!isDataLoading && (
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full">{parcels.length} Items</span>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {isDataLoading ? (
                <div className="divide-y divide-slate-100">
                  {[1, 2, 3].map((skeleton) => (
                    <div key={skeleton} className="p-4 flex items-center justify-between animate-pulse">
                      <div>
                        <div className="h-4 w-20 bg-slate-200 rounded mb-2"></div>
                        <div className="h-3 w-32 bg-slate-100 rounded"></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="h-2 w-16 bg-slate-100 rounded mb-1.5 ml-auto"></div>
                          <div className="h-4 w-12 bg-slate-200 rounded ml-auto"></div>
                        </div>
                        <div className="h-5 w-16 bg-slate-100 rounded"></div>
                        <div className="w-4 h-4 bg-slate-100 rounded-full"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : parcels.length === 0 ? (
                <div className="p-10 text-center">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-medium">No parcels found.</p>
                </div>
              ) : (
                parcels.map((parcel, idx) => (
                  <div
                    key={parcel.id}
                    onClick={() => setSelectedParcelId(parcel.id)}
                    className={`p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${idx !== parcels.length - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-900">{parcel.id}</div>
                      <div className="text-[10px] text-slate-500 mt-1 font-medium truncate max-w-[140px]">{parcel.destinationLocation?.name ?? '—'}</div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">COD Amount</div>
                        <div className="font-bold text-sm text-[var(--color-primary)]">₹{Number(parcel.codAmount).toFixed(2)}</div>
                      </div>
                      <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${getBadgeStyle(parcel.currentState)}`}>
                        {getFriendlyState(parcel.currentState)}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                ))
              )}
              <div className="bg-slate-900 text-white p-2.5 flex items-center justify-center gap-2 text-[10px] font-medium tracking-wide">
                <RefreshCw className="w-3 h-3 text-emerald-400" /> ALL SHIPMENTS SYNCED, 2M AGO
              </div>
            </div>
          </div>
        )}

        {/* SETTLEMENTS TAB — Financial summary + completed history */}
        {activeTab === 'settlements' && (
          <div className="p-5 space-y-4">
            <h3 className="text-[13px] font-bold text-slate-800 px-1">Settlements</h3>

            {/* Summary Cards */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Pending Settlement</h4>
                <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ₹{parcels.filter(p => p.currentState === 'HANDOVER_TO_ORIGIN_BRANCH').reduce((acc, p) => acc + Number(p.codAmount), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-[var(--color-primary)] font-medium mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Ready for payout
              </div>

              <div className="h-px w-full bg-slate-100 my-4"></div>

              <div className="flex justify-between items-center mb-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Settled</h4>
                <CreditCard className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-xl font-bold text-slate-900 tracking-tight">
                ₹{parcels.filter(p => p.currentState === 'SETTLED_TO_SELLER').reduce((acc, p) => acc + Number(p.codAmount), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Successfully transferred
              </div>
            </div>

            {/* Settlement History */}
            <div>
              <div className="flex items-center justify-between px-1 mb-3">
                <h4 className="text-[13px] font-bold text-slate-800">Payment History</h4>
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full">
                  {parcels.filter(p => p.currentState === 'SETTLED_TO_SELLER').length} Records
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {parcels.filter(p => p.currentState === 'SETTLED_TO_SELLER').length === 0 ? (
                  <div className="p-10 text-center">
                    <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm font-medium">No completed settlements yet.</p>
                  </div>
                ) : (
                  parcels.filter(p => p.currentState === 'SETTLED_TO_SELLER').map((parcel, idx, arr) => (
                    <div key={parcel.id} className={`p-4 flex items-center justify-between ${idx !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <div className="font-mono text-xs font-bold text-slate-900">{parcel.id}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{new Date(parcel.createdAt).toLocaleDateString('en-IN')}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm text-emerald-600">₹{Number(parcel.codAmount).toFixed(2)}</div>
                        <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Settled</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* DISCREPANCIES TAB — Finance/Admin only */}
        {activeTab === 'discrepancies' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[13px] font-bold text-slate-800">Discrepancies</h3>
              <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                {parcels.filter(p => p.currentState === 'DISCREPANCY_FLAGGED').length} Flagged
              </span>
            </div>

            {parcels.filter(p => p.currentState === 'DISCREPANCY_FLAGGED').length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
                <CheckCircle className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">No discrepancies found.</p>
                <p className="text-slate-300 text-xs mt-1">All transactions are clean.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {parcels.filter(p => p.currentState === 'DISCREPANCY_FLAGGED').map(parcel => {
                  const discrepancyEvent = parcel.ledgerEvents.find(e => e.eventType === 'DISCREPANCY_FLAGGED');
                  const isResolving = resolvingParcelId === parcel.id;
                  return (
                    <div key={parcel.id} className="bg-white border border-rose-200 rounded-2xl overflow-hidden shadow-sm">
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <AlertTriangle className="w-4 h-4 text-rose-500" />
                              <span className="font-mono text-sm font-bold text-slate-900">{parcel.id}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">{parcel.destinationLocation?.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-rose-600">₹{Number(parcel.codAmount).toFixed(2)}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5">COD Amount</div>
                          </div>
                        </div>

                        {discrepancyEvent && (
                          <div className="mt-3 p-3 bg-rose-50 rounded-xl border border-rose-100">
                            <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">Mismatch Details</div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Expected</span>
                              <span className="font-bold text-slate-700">₹{Number(discrepancyEvent.expectedAmount).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                              <span className="text-slate-500">Confirmed</span>
                              <span className="font-bold text-rose-600">₹{Number(discrepancyEvent.confirmedAmount ?? 0).toFixed(2)}</span>
                            </div>
                            {discrepancyEvent.discrepancyNote && (
                              <div className="text-[10px] text-rose-600 mt-2 italic">{discrepancyEvent.discrepancyNote}</div>
                            )}
                          </div>
                        )}

                        {isResolving ? (
                          <div className="mt-3 space-y-2">
                            <input
                              type="number"
                              placeholder="Resolved amount (₹)"
                              value={discrepancyResolveAmount}
                              onChange={e => setDiscrepancyResolveAmount(e.target.value)}
                              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                            <textarea
                              placeholder="Resolution note (required)..."
                              value={discrepancyResolveNote}
                              onChange={e => setDiscrepancyResolveNote(e.target.value)}
                              rows={2}
                              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDiscrepancyResolve(parcel.id, 'HANDOVER_TO_ORIGIN_BRANCH')}
                                className="flex-1 bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform"
                              >✓ Approve &amp; Settle</button>
                              <button
                                onClick={() => { setResolvingParcelId(null); setDiscrepancyResolveNote(''); setDiscrepancyResolveAmount(''); }}
                                className="flex-1 bg-slate-100 text-slate-600 text-xs font-bold py-2.5 rounded-xl"
                              >Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => { setResolvingParcelId(parcel.id); setDiscrepancyResolveAmount(Number(parcel.codAmount).toFixed(2)); }}
                              className="flex-1 bg-[var(--color-primary)] text-white text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform"
                            >Resolve Discrepancy</button>
                            <button
                              onClick={() => setSelectedParcelId(parcel.id)}
                              className="px-4 bg-slate-100 text-slate-600 text-xs font-bold py-2.5 rounded-xl"
                            >Details</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ADMIN DASHBOARD TAB */}
        {activeTab === 'admin' && (
          <div className="p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Admin Dashboard</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">System-wide overview</p>
              </div>
              <button onClick={loadAdminStats} className="p-2 text-slate-400 hover:text-[var(--color-primary)] bg-slate-50 rounded-xl border border-slate-200 transition-colors">
                <RefreshCw className={`w-4 h-4 ${isAdminLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isAdminLoading || !adminStats ? (
              <div className="grid grid-cols-2 gap-3">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 animate-pulse">
                    <div className="h-3 w-16 bg-slate-200 rounded mb-3"></div>
                    <div className="h-7 w-20 bg-slate-100 rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* KPI Cards Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Total Parcels</span>
                      <Package className="w-4 h-4 text-blue-300" />
                    </div>
                    <div className="text-3xl font-extrabold">{adminStats.totalParcels}</div>
                    <div className="text-[10px] text-blue-300 mt-1">+{adminStats.todayParcels} today</div>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">Settled Today</span>
                      <TrendingUp className="w-4 h-4 text-emerald-200" />
                    </div>
                    <div className="text-xl font-extrabold">₹{adminStats.settledTodayAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    <div className="text-[10px] text-emerald-200 mt-1">Paid to sellers</div>
                  </div>

                  <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Pending</span>
                      <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-xl font-extrabold text-slate-900">₹{adminStats.pendingAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    <div className="text-[10px] text-amber-600 mt-1">Awaiting payout</div>
                  </div>

                  <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Discrepancies</span>
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="text-3xl font-extrabold text-rose-600">{adminStats.discrepancies}</div>
                    <div className="text-[10px] text-rose-400 mt-1">Needs resolution</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Agents</span>
                      <Users className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900">{adminStats.activeAgents}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Delivery agents</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Today</span>
                      <Zap className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900">{adminStats.todayParcels}</div>
                    <div className="text-[10px] text-slate-400 mt-1">New parcels</div>
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
                    <h4 className="text-[12px] font-bold text-slate-800">Status Breakdown</h4>
                  </div>
                  <div className="space-y-2.5">
                    {adminStats.statusBreakdown.map(item => {
                      const total = adminStats.totalParcels || 1;
                      const pct = Math.round((item._count.currentState / total) * 100);
                      const colors: Record<string, string> = {
                        CREATED: 'bg-slate-400',
                        COD_COLLECTED: 'bg-emerald-500',
                        HANDOVER_TO_DEST_HUB: 'bg-blue-500',
                        HANDOVER_TO_ORIGIN_HUB: 'bg-indigo-500',
                        HANDOVER_TO_ORIGIN_BRANCH: 'bg-violet-500',
                        SETTLED_TO_SELLER: 'bg-green-500',
                        DISCREPANCY_FLAGGED: 'bg-rose-500',
                      };
                      const labels: Record<string, string> = {
                        CREATED: 'Pending', COD_COLLECTED: 'Collected',
                        HANDOVER_TO_DEST_HUB: 'Dest Hub', HANDOVER_TO_ORIGIN_HUB: 'In Transit',
                        HANDOVER_TO_ORIGIN_BRANCH: 'At Branch', SETTLED_TO_SELLER: 'Completed',
                        DISCREPANCY_FLAGGED: 'Discrepancy'
                      };
                      return (
                        <div key={item.currentState}>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="font-semibold text-slate-600">{labels[item.currentState] || item.currentState}</span>
                            <span className="font-bold text-slate-700">{item._count.currentState} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${colors[item.currentState] || 'bg-slate-400'} transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[var(--color-primary)]" />
                    <h4 className="text-[12px] font-bold text-slate-800">Recent Activity</h4>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {adminStats.recentEvents.slice(0, 6).map(event => {
                      const typeColors: Record<string, string> = {
                        COD_COLLECTED: 'text-emerald-600 bg-emerald-50',
                        SETTLED_TO_SELLER: 'text-green-600 bg-green-50',
                        DISCREPANCY_FLAGGED: 'text-rose-600 bg-rose-50',
                        HANDOVER_TO_ORIGIN_BRANCH: 'text-violet-600 bg-violet-50',
                        HANDOVER_TO_ORIGIN_HUB: 'text-indigo-600 bg-indigo-50',
                        HANDOVER_TO_DEST_HUB: 'text-blue-600 bg-blue-50',
                      };
                      const typeLabels: Record<string, string> = {
                        COD_COLLECTED: 'Cash Collected', SETTLED_TO_SELLER: 'Settled',
                        DISCREPANCY_FLAGGED: 'Discrepancy!', HANDOVER_TO_ORIGIN_BRANCH: 'At Branch',
                        HANDOVER_TO_ORIGIN_HUB: 'In Transit', HANDOVER_TO_DEST_HUB: 'At Dest Hub'
                      };
                      return (
                        <div key={event.id} className="px-4 py-3 flex items-center gap-3">
                          <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${typeColors[event.eventType] || 'text-slate-500 bg-slate-100'}`}>
                            {typeLabels[event.eventType] || event.eventType}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs text-slate-700 font-semibold truncate">{event.parcel?.id}</div>
                            <div className="text-[10px] text-slate-400">{event.fromParty?.name || 'System'}</div>
                          </div>
                          <div className="text-[10px] text-slate-400 shrink-0">
                            {new Date(event.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full bg-white border-t border-slate-200 flex justify-around items-center pb-safe pt-2 z-30">
        <button 
          onClick={() => setActiveTab('parcels')}
          className={`flex flex-col items-center p-2 min-w-[56px] transition-colors ${activeTab === 'parcels' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Package className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-semibold">Parcels</span>
        </button>
        {(user?.role === 'BRANCH_STAFF' || user?.role === 'ADMIN') && (
          <button 
            onClick={() => setActiveTab('scan')}
            className={`flex flex-col items-center p-2 min-w-[56px] transition-colors ${activeTab === 'scan' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Camera className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-semibold">Scan</span>
          </button>
        )}
        <button 
          onClick={() => setActiveTab('settlements')}
          className={`flex flex-col items-center p-2 min-w-[56px] transition-colors ${activeTab === 'settlements' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Wallet className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-semibold">Finance</span>
        </button>
        {(user?.role === 'FINANCE_OFFICER' || user?.role === 'ADMIN') && (
          <button 
            onClick={() => setActiveTab('discrepancies')}
            className={`flex flex-col items-center p-2 min-w-[56px] transition-colors relative ${activeTab === 'discrepancies' ? 'text-rose-500' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <AlertTriangle className="w-5 h-5 mb-1" />
            {parcels.filter(p => p.currentState === 'DISCREPANCY_FLAGGED').length > 0 && (
              <span className="absolute top-1 right-2 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {parcels.filter(p => p.currentState === 'DISCREPANCY_FLAGGED').length}
              </span>
            )}
            <span className="text-[10px] font-semibold">Issues</span>
          </button>
        )}
        {user?.role === 'ADMIN' && (
          <button 
            onClick={() => { setActiveTab('admin'); loadAdminStats(); }}
            className={`flex flex-col items-center p-2 min-w-[56px] transition-colors ${activeTab === 'admin' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <BarChart3 className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-semibold">Admin</span>
          </button>
        )}
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center p-2 min-w-[56px] transition-colors ${activeTab === 'profile' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <User className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-semibold">Profile</span>
        </button>
      </nav>

      {/* PARCEL DETAILS SLIDE-OVER */}
      <div className={`absolute inset-0 bg-[var(--background)] z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${selectedParcel ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedParcel && (
          <>
            <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
              <button onClick={() => setSelectedParcelId(null)} className="text-slate-500 hover:text-slate-800 p-1"><ArrowLeft className="w-5 h-5" /></button>
              <h1 className="font-bold text-[15px] text-slate-900 tracking-tight">Parcel Details</h1>
              <button onClick={() => window.open(`/label/${selectedParcel.id}`, '_blank')} className="text-blue-600 hover:text-blue-800 p-1.5 rounded-xl flex items-center gap-1 text-xs font-bold border border-blue-100 bg-blue-50 px-3 py-1 shadow-sm active:scale-95 transition-transform">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </header>

            <main className="flex-1 overflow-y-auto p-5 pb-24 space-y-4">
              {/* Header Info */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Parcel ID</div>
                  <div className="text-xl font-bold font-mono text-slate-900">{selectedParcel.id}</div>
                </div>
                <div className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getBadgeStyle(selectedParcel.currentState)}`}>
                  {getFriendlyState(selectedParcel.currentState)}
                </div>
              </div>

              {/* Map Placeholder */}
              <div className="w-full h-36 bg-slate-200 rounded-2xl border border-slate-300 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                <MapPin className="w-8 h-8 text-[var(--color-primary)] mb-2 relative z-10" />
                <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-700 shadow-sm relative z-10">
                  Current Location: {selectedParcel.originLocation.name}
                </div>
              </div>

              {/* Delivery Route Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Delivery Route</h3>
                
                <div className="flex gap-4 relative">
                  <div className="flex flex-col items-center mt-1">
                    <div className="w-3 h-3 rounded-full border-2 border-slate-300 bg-white z-10"></div>
                    <div className="w-px h-10 bg-slate-200 my-1"></div>
                    <div className="w-3 h-3 rounded-full bg-[var(--color-primary)] shadow-[0_0_0_3px_rgba(10,75,251,0.2)] z-10"></div>
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sender</div>
                      <div className="text-[13px] font-bold text-slate-900">{selectedParcel.originLocation.name}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recipient</div>
                      <div className="text-[13px] font-bold text-slate-900">{selectedParcel.destinationLocation.name}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Specifications Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Specifications</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-medium">Declared Value (COD)</span>
                    <span className="text-sm font-bold text-slate-900">₹{Number(selectedParcel.codAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-medium">Creation Date</span>
                    <span className="text-sm font-bold text-slate-900">{new Date(selectedParcel.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Parcel Timeline */}
              {selectedParcel.ledgerEvents.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Shipment Timeline</h3>
                  <div className="relative">
                    {[...selectedParcel.ledgerEvents].reverse().map((event, idx, arr) => {
                      const isLast = idx === arr.length - 1;
                      const eventLabels: Record<string, string> = {
                        COD_COLLECTED: 'Cash Collected by Agent',
                        HANDOVER_TO_DEST_HUB: 'Received at Destination Hub',
                        HANDOVER_TO_ORIGIN_HUB: 'In Transit to Origin Hub',
                        HANDOVER_TO_ORIGIN_BRANCH: 'Received at Origin Branch',
                        SETTLED_TO_SELLER: 'Settled to Seller',
                        DISCREPANCY_FLAGGED: 'Discrepancy Flagged',
                      };
                      const isDiscrepancy = event.eventType === 'DISCREPANCY_FLAGGED';
                      return (
                        <div key={event.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full shrink-0 mt-0.5 z-10 ${isDiscrepancy ? 'bg-rose-500 ring-2 ring-rose-200' : isLast ? 'bg-[var(--color-primary)] ring-2 ring-blue-200' : 'bg-emerald-500'}`}></div>
                            {!isLast && <div className="w-px flex-1 bg-slate-100 my-1 min-h-[24px]"></div>}
                          </div>
                          <div className="pb-4 flex-1">
                            <div className={`text-[12px] font-bold ${isDiscrepancy ? 'text-rose-600' : 'text-slate-900'}`}>{eventLabels[event.eventType] || event.eventType}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{new Date(event.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                            {event.fromParty && <div className="text-[10px] text-slate-500 mt-0.5">By: {event.fromParty.name}</div>}
                            {event.confirmedAmount !== null && event.confirmedAmount !== event.expectedAmount && (
                              <div className="text-[10px] text-rose-500 mt-0.5">⚠ Expected ₹{Number(event.expectedAmount).toFixed(2)}, Got ₹{Number(event.confirmedAmount).toFixed(2)}</div>
                            )}
                            {isDiscrepancy && event.discrepancyNote && (
                              <div className="text-[10px] text-rose-500 mt-1 italic">{event.discrepancyNote}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </main>

            {/* Action Bar (Fixed at bottom of slide-over) */}
            <div className="absolute bottom-0 w-full bg-white border-t border-slate-200 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
              {user?.role === 'DELIVERY_AGENT' && selectedParcel.currentState === 'CREATED' && (
                <button onClick={() => handleCollect(selectedParcel.id, Number(selectedParcel.codAmount))} className="w-full bg-[var(--color-primary)] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2">
                  <DollarSign className="w-4 h-4" /> Collect ₹{Number(selectedParcel.codAmount)}
                </button>
              )}
              
              {user?.role === 'BRANCH_STAFF' && selectedParcel.currentState === 'COD_COLLECTED' && (
                <button onClick={() => handleHandoverConfirm(selectedParcel.id, Number(selectedParcel.codAmount))} className="w-full bg-[var(--color-primary)] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Accept Handover
                </button>
              )}

              {user?.role === 'FINANCE_OFFICER' && selectedParcel.currentState === 'HANDOVER_TO_ORIGIN_BRANCH' && (
                <button onClick={() => handlePayout(selectedParcel.id)} className="w-full bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2">
                  <CreditCard className="w-4 h-4" /> Issue Payout
                </button>
              )}

              {/* Disabled generic button for other states to match UI screenshot */}
              {((user?.role === 'DELIVERY_AGENT' && selectedParcel.currentState !== 'CREATED') ||
                (user?.role === 'SELLER')) && (
                <button disabled className="w-full bg-slate-100 text-slate-400 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 border border-slate-200">
                  No Actions Available
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {/* CREATE CONSIGNMENT IMPORT WIZARD */}
      {scanImportInfo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">New Consignment Scanned</span>
                <h3 className="font-mono font-bold text-slate-900 text-sm">{scanImportInfo.id}</h3>
              </div>
              <button onClick={() => setScanImportInfo(null)} className="p-1.5 rounded-full bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Carrier rule info panel */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 flex justify-between items-center text-xs">
              <div>
                <span className="text-[9px] font-extrabold text-blue-500 uppercase tracking-widest block">Detected Carrier</span>
                <span className="font-bold text-blue-900">{scanImportInfo.carrier.replace('_', ' ')}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-extrabold text-blue-500 uppercase tracking-widest block">Confidence</span>
                <span className="font-bold text-emerald-600 font-mono text-[11px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{scanImportInfo.confidence}%</span>
              </div>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-3.5">
              <div>
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Select Seller</label>
                <select
                  required
                  value={importFields.sellerId}
                  onChange={e => setImportFields({ ...importFields, sellerId: e.target.value })}
                  className="w-full bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                >
                  {metadata.users.filter(u => u.role === 'SELLER').map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">COD Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 1500"
                  value={importFields.codAmount}
                  onChange={e => setImportFields({ ...importFields, codAmount: e.target.value })}
                  className="w-full bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Origin</label>
                  <select
                    value={importFields.originId}
                    onChange={e => setImportFields({ ...importFields, originId: e.target.value })}
                    className="w-full bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {metadata.locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name.split(' ')[0]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Destination</label>
                  <select
                    value={importFields.destId}
                    onChange={e => setImportFields({ ...importFields, destId: e.target.value })}
                    className="w-full bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {metadata.locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name.split(' ')[0]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Receipt photo preview */}
              <div className="border border-dashed border-slate-200 rounded-2xl p-3 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-slate-400" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-700 block">Receipt Attachment</span>
                    <span className="text-[8px] text-emerald-600 font-semibold block">✓ Captured (Mock)</span>
                  </div>
                </div>
                <img src={importFields.photoUrl} alt="Receipt preview" className="w-10 h-10 object-cover rounded-lg border" />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-xs active:scale-[0.98] transition-transform shadow-md shadow-blue-500/10"
              >
                Import Parcel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DUPLICATE FOUND PREVIEW CARD */}
      {duplicateFoundInfo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Parcel Already Exists</span>
              </div>
              <button onClick={() => setDuplicateFoundInfo(null)} className="p-1.5 rounded-full bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Tracking No:</span>
                <span className="font-mono font-bold text-slate-800">{duplicateFoundInfo.id}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Current Status:</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getBadgeStyle(duplicateFoundInfo.currentState)}`}>
                  {getFriendlyState(duplicateFoundInfo.currentState)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">COD Amount:</span>
                <span className="font-bold text-slate-800">₹{Number(duplicateFoundInfo.codAmount).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              {user?.role === 'DELIVERY_AGENT' && duplicateFoundInfo.currentState === 'CREATED' && (
                <button
                  onClick={async () => {
                    const id = duplicateFoundInfo.id;
                    setDuplicateFoundInfo(null);
                    setImportStep('saving');
                    await handleCollect(id, Number(duplicateFoundInfo.codAmount));
                    setImportStep('done');
                    setTimeout(() => {
                      setImportStep('idle');
                    }, 1200);
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl text-xs active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-4 h-4" /> Collect ₹{Number(duplicateFoundInfo.codAmount)}
                </button>
              )}

              {user?.role === 'BRANCH_STAFF' && duplicateFoundInfo.currentState === 'COD_COLLECTED' && (
                <button
                  onClick={async () => {
                    const id = duplicateFoundInfo.id;
                    setDuplicateFoundInfo(null);
                    setImportStep('saving');
                    await handleHandoverConfirm(id, Number(duplicateFoundInfo.codAmount));
                    setImportStep('done');
                    setTimeout(() => {
                      setImportStep('idle');
                    }, 1200);
                  }}
                  className="w-full bg-[var(--color-primary)] hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-xs active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Accept Handover
                </button>
              )}

              <button
                onClick={() => {
                  const id = duplicateFoundInfo.id;
                  setDuplicateFoundInfo(null);
                  setActiveTab('parcels');
                  setSelectedParcelId(id);
                }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs active:scale-[0.98] transition-transform"
              >
                Open Timeline Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP-BY-STEP PROGRESS INDICATOR */}
      {importStep !== 'idle' && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur flex items-center justify-center p-6">
          <div className="bg-slate-850 border border-slate-800 rounded-3xl p-6 w-full max-w-xs space-y-6 text-white text-center">
            <div>
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
              <h3 className="font-bold text-sm">Processing Import...</h3>
            </div>
            
            <div className="space-y-3.5 text-left text-xs font-semibold px-4">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${importStep !== 'saving' ? 'bg-emerald-500 text-white' : 'bg-blue-500/10 border border-blue-500/30 text-blue-400 animate-pulse'}`}>
                  {importStep !== 'saving' ? '✓' : '1'}
                </div>
                <span className={importStep !== 'saving' ? 'text-slate-400' : 'text-white'}>Saving Consignment...</span>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${importStep === 'done' ? 'bg-emerald-500 text-white' : importStep === 'ledger' ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400 animate-pulse' : 'bg-slate-800 text-slate-600'}`}>
                  {importStep === 'done' ? '✓' : '2'}
                </div>
                <span className={importStep === 'done' ? 'text-slate-400' : importStep === 'ledger' ? 'text-white' : 'text-slate-600'}>Ledger Auditing...</span>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${importStep === 'done' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600'}`}>
                  {importStep === 'done' ? '✓' : '3'}
                </div>
                <span className={importStep === 'done' ? 'text-white font-bold' : 'text-slate-600'}>Completed</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
