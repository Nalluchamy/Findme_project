'use client';

import React, { useState, useEffect } from 'react';
import {
  User, Shield, Truck, Building, Layers, Search, DollarSign,
  MapPin, LogOut, Package, RefreshCw, Menu, Home, Wallet,
  ChevronRight, ArrowLeft, MoreVertical, CreditCard, ChevronDown, CheckCircle, Target, ArrowRight, Clock
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

export default function FindMeApp() {
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

  const [activeTab, setActiveTab] = useState<'parcels' | 'settlements' | 'profile'>('parcels');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);

  // Forms
  const [actionAmount, setActionAmount] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [actionTargetUser, setActionTargetUser] = useState('');

  useEffect(() => {
    fetchSession();
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) setUser(data.user);
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
      setUser(null); setParcels([]); setSelectedParcelId(null);
    } catch (e) {
      console.error(e);
    }
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

  // LOGIN SCREEN
  if (!user && !isAuthLoading) {
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
      <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between z-20 shrink-0">
        <button className="text-slate-500 hover:text-slate-800 p-1 rounded-full"><Menu className="w-5 h-5" /></button>
        <h1 className="font-bold text-[15px] text-slate-900 tracking-tight">Courier Connect</h1>
        <button className="text-slate-500 hover:text-slate-800 p-1 rounded-full"><Search className="w-5 h-5" /></button>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto pb-24 relative">
        
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

        {/* Settlements / Dashboard Tab */}
        {(activeTab === 'parcels' || activeTab === 'settlements') && (
          <div className="p-5 space-y-6 animate-in fade-in duration-300">
            
            {/* Summary Cards (For Seller or Finance) */}
            {(user?.role === 'SELLER' || user?.role === 'FINANCE_OFFICER') && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Pending Settlement</h3>
                  <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
                </div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  ₹{parcels.filter(p => p.currentState === 'HANDOVER_TO_ORIGIN_BRANCH').reduce((acc, p) => acc + p.codAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-[var(--color-primary)] font-medium mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Expected by Friday, Oct 27
                </div>

                <div className="h-px w-full bg-slate-100 my-4"></div>

                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Payout</h3>
                  <CreditCard className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-xl font-bold text-slate-900 tracking-tight">
                  ₹{parcels.filter(p => p.currentState === 'SETTLED_TO_SELLER').reduce((acc, p) => acc + p.codAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Transferred on Oct 20
                </div>
              </div>
            )}

            {/* Parcel List */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-[13px] font-bold text-slate-800">Active Parcels</h3>
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full">{parcels.length} Items</span>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {parcels.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm font-medium">No parcels found.</div>
                ) : (
                  parcels.map((parcel, idx) => (
                    <div 
                      key={parcel.id} 
                      onClick={() => setSelectedParcelId(parcel.id)}
                      className={`p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${idx !== parcels.length - 1 ? 'border-b border-slate-100' : ''}`}
                    >
                      <div>
                        <div className="font-mono text-xs font-bold text-slate-900">{parcel.id}</div>
                        <div className="text-[10px] text-slate-500 mt-1 font-medium truncate max-w-[140px]">{parcel.destinationLocation.name}</div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">COD Amount</div>
                          <div className="font-bold text-sm text-[var(--color-primary)]">₹{parcel.codAmount.toFixed(2)}</div>
                        </div>
                        <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${getBadgeStyle(parcel.currentState)}`}>
                          {getFriendlyState(parcel.currentState)}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  ))
                )}
                
                {/* Simulated Sync Footer */}
                <div className="bg-slate-900 text-white p-2.5 flex items-center justify-center gap-2 text-[10px] font-medium tracking-wide">
                  <RefreshCw className="w-3 h-3 text-emerald-400" /> ALL SHIPMENTS SYNCED, 2M AGO
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full bg-white border-t border-slate-200 flex justify-around items-center pb-safe pt-2 z-30">
        <button 
          onClick={() => setActiveTab('parcels')}
          className={`flex flex-col items-center p-2 min-w-[64px] transition-colors ${activeTab === 'parcels' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Package className={`w-5 h-5 mb-1 ${activeTab === 'parcels' ? 'fill-blue-50' : ''}`} />
          <span className="text-[10px] font-semibold">Parcels</span>
        </button>
        <button 
          onClick={() => setActiveTab('settlements')}
          className={`flex flex-col items-center p-2 min-w-[64px] transition-colors ${activeTab === 'settlements' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Wallet className={`w-5 h-5 mb-1 ${activeTab === 'settlements' ? 'fill-blue-50' : ''}`} />
          <span className="text-[10px] font-semibold">Settlements</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center p-2 min-w-[64px] transition-colors ${activeTab === 'profile' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <User className={`w-5 h-5 mb-1 ${activeTab === 'profile' ? 'fill-blue-50' : ''}`} />
          <span className="text-[10px] font-semibold">Profile</span>
        </button>
      </nav>

      {/* PARCEL DETAILS SLIDE-OVER */}
      <div className={`absolute inset-0 bg-[var(--background)] z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${selectedParcel ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedParcel && (
          <>
            <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between shrink-0">
              <button onClick={() => setSelectedParcelId(null)} className="text-slate-500 hover:text-slate-800 p-1"><ArrowLeft className="w-5 h-5" /></button>
              <h1 className="font-bold text-[15px] text-slate-900 tracking-tight">Parcel Details</h1>
              <button className="text-slate-500 hover:text-slate-800 p-1"><MoreVertical className="w-5 h-5" /></button>
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
                    <span className="text-sm font-bold text-slate-900">₹{selectedParcel.codAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-medium">Creation Date</span>
                    <span className="text-sm font-bold text-slate-900">{new Date(selectedParcel.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              </div>

            </main>

            {/* Action Bar (Fixed at bottom of slide-over) */}
            <div className="absolute bottom-0 w-full bg-white border-t border-slate-200 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
              {user?.role === 'DELIVERY_AGENT' && selectedParcel.currentState === 'CREATED' && (
                <button onClick={() => handleCollect(selectedParcel.id, selectedParcel.codAmount)} className="w-full bg-[var(--color-primary)] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2">
                  <DollarSign className="w-4 h-4" /> Collect ₹{selectedParcel.codAmount}
                </button>
              )}
              
              {user?.role === 'BRANCH_STAFF' && selectedParcel.currentState === 'COD_COLLECTED' && (
                <button onClick={() => handleHandoverConfirm(selectedParcel.id, selectedParcel.codAmount)} className="w-full bg-[var(--color-primary)] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2">
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

    </div>
  );
}
