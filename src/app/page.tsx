'use client';

import React, { useState, useEffect, startTransition } from 'react';
import {
  User,
  Shield,
  Truck,
  Building,
  Activity,
  Layers,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowRight,
  DollarSign,
  Camera,
  MapPin,
  LogOut,
  Send,
  Plus,
  Target,
  Users,
  Calendar,
  Package,
  FileText,
  Smartphone
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

interface OfflineAction {
  id: string;
  url: string;
  method: 'POST';
  body: any;
  timestamp: number;
  description: string;
}

export default function FindMeApp() {
  // App state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Business state
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [metadata, setMetadata] = useState<{ locations: Location[]; users: UserProfile[] }>({
    locations: [],
    users: [],
  });
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Offline Management
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // UI flow state
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'admin' | 'payouts'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Forms state
  const [collectAmount, setCollectAmount] = useState('');
  const [collectPhoto, setCollectPhoto] = useState('');
  const [handoverExpectedAmount, setHandoverExpectedAmount] = useState('');
  const [handoverTargetUser, setHandoverTargetUser] = useState('');
  const [handoverEventType, setHandoverEventType] = useState('');
  const [handoverPhoto, setHandoverPhoto] = useState('');
  const [confirmAmounts, setConfirmAmounts] = useState<Record<string, string>>({});
  const [resolutionState, setResolutionState] = useState('');
  const [resolutionAmount, setResolutionAmount] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [payoutRefId, setPayoutRefId] = useState('');
  
  // New Parcel creation modal
  const [newParcelId, setNewParcelId] = useState('');
  const [newParcelSeller, setNewParcelSeller] = useState('');
  const [newParcelCod, setNewParcelCod] = useState('');
  const [newParcelOrigin, setNewParcelOrigin] = useState('');
  const [newParcelDest, setNewParcelDest] = useState('');
  const [parcelSuccessMsg, setParcelSuccessMsg] = useState('');

  // Setup connection monitoring & offline recovery
  useEffect(() => {
    // Check initial auth session
    fetchSession();

    // Check offline status
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      triggerQueueSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Read initial queue
    const savedQueue = localStorage.getItem('findme_offline_queue');
    if (savedQueue) {
      setOfflineQueue(JSON.parse(savedQueue));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync data automatically when user changes
  useEffect(() => {
    if (user) {
      loadData(1, searchQuery);
    }
  }, [user]);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
      } else {
        setAuthError(data.error || 'Login failed');
      }
    } catch (err) {
      setAuthError('Connection error to auth API.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleQuickLogin = async (username: string) => {
    setAuthError('');
    setIsAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ username, password: 'password123' }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
      } else {
        setAuthError(data.error);
      }
    } catch (err) {
      setAuthError('Connection error.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/me', { 
        method: 'POST',
        headers: { 'X-CSRF-Token': getCsrfToken() }
      });
      setUser(null);
      setParcels([]);
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async (page = currentPage, search = searchQuery) => {
    setIsDataLoading(true);
    try {
      const resParcels = await fetch(`/api/parcels?page=${page}&search=${encodeURIComponent(search)}`);
      const dataParcels = await resParcels.json();
      if (dataParcels.data) {
        setParcels(dataParcels.data);
        setCurrentPage(dataParcels.page || 1);
        setTotalPages(dataParcels.totalPages || 1);
      }

      const resMeta = await fetch('/api/metadata');
      const dataMeta = await resMeta.json();
      if (dataMeta.locations) {
        setMetadata(dataMeta);
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setIsDataLoading(false);
    }
  };

  // Queue an offline request
  const queueOfflineAction = (url: string, body: any, description: string) => {
    const newAction: OfflineAction = {
      id: crypto.randomUUID(),
      url,
      method: 'POST',
      body,
      timestamp: Date.now(),
      description,
    };
    const updated = [...offlineQueue, newAction];
    setOfflineQueue(updated);
    localStorage.setItem('findme_offline_queue', JSON.stringify(updated));
    alert('You are offline. This transaction has been queued and will be synced when you go back online.');
  };

  // Sync Offline queue
  const triggerQueueSync = async () => {
    if (!navigator.onLine || offlineQueue.length === 0) return;

    const queue = [...offlineQueue];
    let successCount = 0;

    for (const action of queue) {
      try {
        const res = await fetch(action.url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
          body: JSON.stringify(action.body),
        });
        if (res.ok) {
          successCount++;
        } else {
          break; // stop on first error to maintain order
        }
      } catch (err) {
        console.error('Failed syncing action:', action.description, err);
        break; // stop processing if connection dropped again
      }
    }

    const remaining = queue.slice(successCount);
    setOfflineQueue(remaining);
    localStorage.setItem('findme_offline_queue', JSON.stringify(remaining));

    if (successCount > 0) {
      loadData();
    }
  };

  // 1. COD Collection Submit
  const handleCollectionSubmit = async (parcelId: string) => {
    const payload = {
      amount: parseFloat(collectAmount),
      photoUrl: collectPhoto || null,
      gpsCoords: '19.0760,72.8777', // simulated doorstep GPS
    };

    if (!isOnline) {
      queueOfflineAction(`/api/parcels/${parcelId}/collect`, payload, `Collect COD ₹${collectAmount} for ${parcelId}`);
      resetForms();
      return;
    }

    try {
      const res = await fetch(`/api/parcels/${parcelId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.flagged ? 'Discrepancy Flagged!' : 'Cash Collected Successfully!');
        loadData();
        resetForms();
      } else {
        alert(data.error || 'Failed to submit collection');
      }
    } catch (e) {
      alert('Error connecting to backend.');
    }
  };

  // 2. Handover Initiation Submit
  const handleHandoverInitiation = async (parcelId: string) => {
    const payload = {
      eventType: handoverEventType,
      expectedAmount: parseFloat(handoverExpectedAmount),
      toPartyId: handoverTargetUser,
      photoUrl: handoverPhoto || null,
      gpsCoords: '19.0760,72.8777',
    };

    if (!isOnline) {
      queueOfflineAction(`/api/parcels/${parcelId}/handover`, payload, `Initiate Handover of ${parcelId} to recipient`);
      resetForms();
      return;
    }

    try {
      const res = await fetch(`/api/parcels/${parcelId}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Handover initiated! Awaiting recipient confirmation.');
        loadData();
        resetForms();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Error.');
    }
  };

  // 3. Handover Confirmation Submit
  const handleHandoverConfirmation = async (parcelId: string) => {
    const payload = {
      amount: parseFloat(confirmAmounts[parcelId] || ''),
    };

    if (!isOnline) {
      queueOfflineAction(`/api/parcels/${parcelId}/handover`, payload, `Confirm Handover of ${parcelId} with ₹${confirmAmounts[parcelId]}`);
      resetForms();
      return;
    }

    try {
      const res = await fetch(`/api/parcels/${parcelId}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.flagged ? 'Discrepancy Flagged due to mismatch!' : 'Handover Confirmed Successfully!');
        loadData();
        resetForms();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Error.');
    }
  };

  // 4. Resolve Discrepancy
  const handleResolveDiscrepancy = async (parcelId: string) => {
    try {
      const res = await fetch('/api/discrepancies/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({
          parcelId,
          targetState: resolutionState,
          resolvedAmount: parseFloat(resolutionAmount),
          note: resolutionNote,
        }),
      });
      if (res.ok) {
        alert('Discrepancy resolved successfully!');
        loadData();
        resetForms();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      alert('Error resolving ticket.');
    }
  };

  // 5. Payout Approval
  const handlePayoutSubmit = async (parcelId: string) => {
    try {
      const res = await fetch(`/api/parcels/${parcelId}/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ referenceId: payoutRefId }),
      });
      if (res.ok) {
        alert('Payout completed and settled to seller!');
        loadData();
        resetForms();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      alert('Error processing payout.');
    }
  };

  // 6. Create Parcel Action (Admin/Seller)
  const handleCreateParcel = async (e: React.FormEvent) => {
    e.preventDefault();
    setParcelSuccessMsg('');
    try {
      const res = await fetch('/api/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({
          id: newParcelId,
          sellerId: newParcelSeller,
          codAmount: parseFloat(newParcelCod),
          originLocationId: newParcelOrigin,
          destinationLocationId: newParcelDest,
        }),
      });
      if (res.ok) {
        setParcelSuccessMsg(`Parcel ${newParcelId} created successfully!`);
        setNewParcelId('');
        setNewParcelCod('');
        loadData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      alert('Failed to register parcel.');
    }
  };

  // 7. Simulated Overdue cron triggering (testing convenience)
  const runOverdueCron = async () => {
    try {
      const res = await fetch('/api/cron/check-overdue?seconds=10'); // for testing: check if idle > 10 seconds
      const data = await res.json();
      alert(`SLA Check Done. Handovers analyzed. Flagged ${data.flaggedCount} overdue parcels!`);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const resetForms = () => {
    setCollectAmount('');
    setCollectPhoto('');
    setHandoverExpectedAmount('');
    setHandoverTargetUser('');
    setHandoverEventType('');
    setHandoverPhoto('');
    setConfirmAmounts({});
    setResolutionState('');
    setResolutionAmount('');
    setResolutionNote('');
    setPayoutRefId('');
    setSelectedParcelId(null);
  };

  // Helper getters
  const selectedParcel = parcels.find((p) => p.id === selectedParcelId);

  // Filtered lists based on user role and current dashboard filters
  const filteredParcels = parcels.filter((p) => {
    const idMatches = p.id.toLowerCase().includes(searchQuery.toLowerCase());
    return idMatches;
  });

  const activeHandoverPendingParcels = filteredParcels.filter((p) => {
    // A parcel is pending confirmation if it has an event where confirmedByTo is false
    const pendingEvent = p.ledgerEvents.find((e) => !e.confirmedByTo);
    if (!pendingEvent) return false;
    // Check if target recipient is current user
    return pendingEvent.toPartyId === user?.id;
  });

  const discrepancies = filteredParcels.filter((p) => p.currentState === 'DISCREPANCY_FLAGGED');

  const readyForPayout = filteredParcels.filter((p) => p.currentState === 'HANDOVER_TO_ORIGIN_BRANCH');

  const regularQueue = filteredParcels.filter((p) => {
    if (p.currentState === 'SETTLED_TO_SELLER' || p.currentState === 'DISCREPANCY_FLAGGED') return false;
    // Hide if awaiting current user's confirmation
    const pendingEvent = p.ledgerEvents.find((e) => !e.confirmedByTo);
    if (pendingEvent && pendingEvent.toPartyId === user?.id) return false;
    return true;
  });

  // State colors
  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'CREATED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Created</span>;
      case 'COD_COLLECTED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">COD Collected</span>;
      case 'HANDOVER_TO_DEST_HUB':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Dest Hub</span>;
      case 'HANDOVER_TO_ORIGIN_HUB':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-mono">Origin Hub</span>;
      case 'HANDOVER_TO_ORIGIN_BRANCH':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-mono">Origin Branch</span>;
      case 'SETTLED_TO_SELLER':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">Settled (Paid)</span>;
      case 'DISCREPANCY_FLAGGED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse">Discrepancy</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-50 text-slate-600">{state}</span>;
    }
  };

  const getPlainStatusText = (parcel: Parcel) => {
    switch (parcel.currentState) {
      case 'CREATED':
        return `Ready for COD collection. COD Amount: ₹${parcel.codAmount}.`;
      case 'COD_COLLECTED':
        return `₹${parcel.codAmount} COD cash collected at destination doorstep. Traveling to Mumbai Hub next.`;
      case 'HANDOVER_TO_DEST_HUB':
        return `In transit: Cash arrived at ${parcel.destinationLocation.name} Hub.`;
      case 'HANDOVER_TO_ORIGIN_HUB':
        return `In transit: Cash dispatched from Mumbai Hub and received at Delhi Hub.`;
      case 'HANDOVER_TO_ORIGIN_BRANCH':
        return `Settlement pending: Cash back at local origin branch (${parcel.originLocation.name}), ready for payouts.`;
      case 'SETTLED_TO_SELLER':
        const event = parcel.ledgerEvents.find(e => e.eventType === 'SETTLED_TO_SELLER');
        return `Paid successfully! Seller settlement reference: ${event?.discrepancyNote || 'TXN10023'}.`;
      case 'DISCREPANCY_FLAGGED':
        const discEvent = parcel.ledgerEvents[0];
        return `Action required: Settlement on hold due to discrepancy: "${discEvent?.discrepancyNote || 'Unresolved mismatch'}".`;
      default:
        return 'Unknown tracking state.';
    }
  };

  // Login view
  if (!user && !isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center px-4 py-8">
        <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-md rounded-2xl p-8 border border-slate-700/60 shadow-2xl">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="bg-emerald-500 text-slate-900 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
              <Activity className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">FindMe</h1>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">COD Settlement PWA</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Username</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. agent, branch_mum, finance"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {authError && <p className="text-sm text-rose-400 font-medium">{authError}</p>}

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/10 transition-transform active:scale-95"
            >
              Sign In
            </button>
          </form>

          {/* Quick Switch Accounts for evaluation */}
          <div className="mt-8 pt-6 border-t border-slate-700/60">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 text-center">Quick Switch (Demo Accounts)</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => handleQuickLogin('agent')}
                className="bg-slate-950/40 hover:bg-slate-950/80 border border-slate-700/40 rounded-lg p-2.5 text-left flex items-center gap-2"
              >
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                <div>
                  <div className="font-semibold text-slate-200">Delivery Agent</div>
                  <div className="text-[10px] text-slate-500">Ramesh (Mumbai)</div>
                </div>
              </button>

              <button
                onClick={() => handleQuickLogin('branch_mum')}
                className="bg-slate-950/40 hover:bg-slate-950/80 border border-slate-700/40 rounded-lg p-2.5 text-left flex items-center gap-2"
              >
                <Building className="w-3.5 h-3.5 text-blue-400" />
                <div>
                  <div className="font-semibold text-slate-200">Branch Staff</div>
                  <div className="text-[10px] text-slate-500">Priya (Mumbai)</div>
                </div>
              </button>

              <button
                onClick={() => handleQuickLogin('hub_mum')}
                className="bg-slate-950/40 hover:bg-slate-950/80 border border-slate-700/40 rounded-lg p-2.5 text-left flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <div>
                  <div className="font-semibold text-slate-200">Hub Operator</div>
                  <div className="text-[10px] text-slate-500">Amit (Mumbai Hub)</div>
                </div>
              </button>

              <button
                onClick={() => handleQuickLogin('finance')}
                className="bg-slate-950/40 hover:bg-slate-950/80 border border-slate-700/40 rounded-lg p-2.5 text-left flex items-center gap-2"
              >
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <div>
                  <div className="font-semibold text-slate-200">Finance Officer</div>
                  <div className="text-[10px] text-slate-500">Sanjay (Payouts)</div>
                </div>
              </button>

              <button
                onClick={() => handleQuickLogin('seller')}
                className="bg-slate-950/40 hover:bg-slate-950/80 border border-slate-700/40 rounded-lg p-2.5 text-left flex items-center gap-2 col-span-2 justify-center"
              >
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <div className="text-center">
                  <span className="font-semibold text-slate-200 block text-xs">Seller View (ElectroWorld)</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col max-w-md mx-auto relative shadow-2xl border-x border-slate-900">
      
      {/* Header Banner */}
      <header className="bg-slate-900 border-b border-slate-800/80 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 text-slate-950 p-1.5 rounded-lg">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight tracking-tight text-white">FindMe</h1>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">{user?.role}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Offline Sync State Badge */}
          {offlineQueue.length > 0 ? (
            <button
              onClick={triggerQueueSync}
              className="bg-amber-950 border border-amber-800 text-amber-400 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold animate-pulse"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Syncing ({offlineQueue.length})</span>
            </button>
          ) : (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${isOnline ? 'bg-emerald-950/60 border border-emerald-800/30 text-emerald-400' : 'bg-rose-950 border border-rose-800 text-rose-400'}`}>
              {isOnline ? 'Online' : 'Offline Mode'}
            </div>
          )}

          <button onClick={handleLogout} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto px-4 py-5 pb-20 space-y-6">
        
        {/* User Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-900 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs text-slate-400">Signed In As</div>
            <div className="font-bold text-white text-base">{user?.name}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              {user?.locationId ? `Branch/Hub ID: ${user.locationId.slice(0, 8)}...` : 'Corporate Head Office'}
            </div>
          </div>
          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/30 text-emerald-400">
            {user?.role === 'DELIVERY_AGENT' && <Truck className="w-6 h-6" />}
            {user?.role === 'BRANCH_STAFF' && <Building className="w-6 h-6" />}
            {user?.role === 'HUB_OPERATOR' && <Layers className="w-6 h-6" />}
            {user?.role === 'FINANCE_OFFICER' && <DollarSign className="w-6 h-6" />}
            {user?.role === 'ADMIN' && <Shield className="w-6 h-6" />}
            {user?.role === 'SELLER' && <User className="w-6 h-6" />}
          </div>
        </div>

        {/* Dynamic View Selector */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Search by Parcel ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData(1, searchQuery)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <button 
              onClick={() => loadData(1, searchQuery)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20"
            >
              Search
            </button>
          </div>
          <div className="flex justify-between items-center px-1 text-xs text-slate-400 font-medium font-mono">
            <button 
              disabled={currentPage <= 1}
              onClick={() => loadData(currentPage - 1, searchQuery)}
              className="disabled:opacity-50 hover:text-emerald-400 uppercase tracking-widest px-2 py-1"
            >
              &larr; Prev
            </button>
            <span className="text-slate-500">PAGE {currentPage} / {totalPages}</span>
            <button 
              disabled={currentPage >= totalPages}
              onClick={() => loadData(currentPage + 1, searchQuery)}
              className="disabled:opacity-50 hover:text-emerald-400 uppercase tracking-widest px-2 py-1"
            >
              Next &rarr;
            </button>
          </div>
        </div>
        {user?.role === 'SELLER' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">My COD Settlement Dashboard</h2>
            {filteredParcels.map((parcel) => (
              <div
                key={parcel.id}
                onClick={() => startTransition(() => setSelectedParcelId(parcel.id))}
                className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 hover:border-slate-800 cursor-pointer shadow-sm relative overflow-hidden transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-white tracking-tight">{parcel.id}</span>
                  {getStatusBadge(parcel.currentState)}
                </div>
                <div className="text-xs text-slate-400 font-medium">Expected Settlement:</div>
                <div className="text-sm font-bold text-white mt-0.5">₹{parcel.codAmount}</div>
                
                <p className="text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-lg mt-3 border border-slate-800/30">
                  {getPlainStatusText(parcel)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* DELIVERY AGENT FLOW */}
        {user?.role === 'DELIVERY_AGENT' && (
          <div className="space-y-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Doorstep Cash Collection</h2>
            
            {/* Scan/Select Parcel */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase">Select Parcel for COD Collection</label>
              <div className="grid grid-cols-1 gap-2.5">
                {parcels.filter(p => p.currentState === 'CREATED').map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedParcelId(p.id);
                      setCollectAmount(p.codAmount.toString());
                    }}
                    className={`p-3.5 rounded-xl border text-left flex justify-between items-center transition-all ${selectedParcelId === p.id ? 'bg-emerald-950/40 border-emerald-500/80 text-white' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
                  >
                    <div>
                      <div className="font-bold text-slate-200">{p.id}</div>
                      <div className="text-[10px] text-slate-500">Dest: {p.destinationLocation.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400">₹{p.codAmount}</div>
                      <div className="text-[9px] text-slate-500">COD Due</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedParcelId && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-white">Enter Settlement Details</h3>
                  <span className="text-xs font-mono text-emerald-400">{selectedParcelId}</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 uppercase font-semibold mb-2">Collected COD Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="Enter exact cash amount collected"
                      value={collectAmount}
                      onChange={(e) => setCollectAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 uppercase font-semibold mb-2">Verification Proof (Optional)</label>
                    <input
                      type="text"
                      placeholder="Paste mockup verification photo URL"
                      value={collectPhoto}
                      onChange={(e) => setCollectPhoto(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                    />
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Upload cash collection/parcel receipt snapshot</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCollectionSubmit(selectedParcelId)}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Submit Cash Collection</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BRANCH STAFF & HUB OPERATOR FLOW */}
        {(user?.role === 'BRANCH_STAFF' || user?.role === 'HUB_OPERATOR') && (
          <div className="space-y-6">
            
            {/* Actions Switch */}
            <div className="flex bg-slate-900 border border-slate-800/80 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Checkpoints & Handover
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Parcel SLA Overdue
              </button>
            </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                
                {/* 1. Confirm Pending Incoming Handover */}
                {activeHandoverPendingParcels.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-500 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Pending Awaiting My Confirmation ({activeHandoverPendingParcels.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-2.5">
                      {activeHandoverPendingParcels.map((p) => {
                        const pendingEvent = p.ledgerEvents.find(e => !e.confirmedByTo);
                        return (
                          <div key={p.id} className="bg-slate-900 border border-slate-800/60 rounded-xl p-4 space-y-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-white text-sm">{p.id}</span>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  Sent By: {pendingEvent?.fromParty?.name || 'Staff'}
                                </div>
                              </div>
                              <span className="text-xs font-bold text-slate-400">
                                Transferred: ₹{pendingEvent?.expectedAmount}
                              </span>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                                  Confirm Cash Amount Received
                                </label>
                                <input
                                  type="number"
                                  placeholder="Enter physically counted cash amount"
                                  value={confirmAmounts[p.id] || ''}
                                  onChange={(e) => setConfirmAmounts({ ...confirmAmounts, [p.id]: e.target.value })}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              <button
                                onClick={() => handleHandoverConfirmation(p.id)}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs tracking-wider transition-transform active:scale-95"
                              >
                                Submit Physical Handover Check
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Dispatch / Initiate Outgoing Handover */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                    Dispatch / Initiate Handover
                  </h3>

                  <div className="grid grid-cols-1 gap-2.5">
                    {regularQueue.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedParcelId(p.id);
                          setHandoverExpectedAmount(p.codAmount.toString());
                        }}
                        className={`p-3.5 rounded-xl border text-left flex justify-between items-center transition-all ${selectedParcelId === p.id ? 'bg-slate-900 border-slate-500 text-white' : 'bg-slate-900/40 border-slate-900 hover:border-slate-800'}`}
                      >
                        <div>
                          <div className="font-bold text-slate-200">{p.id}</div>
                          <div className="text-[10px] text-slate-500">Current State: {p.currentState}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">₹{p.codAmount}</div>
                          <div className="text-[9px] text-emerald-400">Tap to Dispatch</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedParcelId && selectedParcel && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 animate-fadeIn">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h3 className="font-bold text-white">Initiate Handover Details</h3>
                      <span className="text-xs font-mono text-slate-400">{selectedParcelId}</span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-2">Handover Milestone</label>
                        <select
                          value={handoverEventType}
                          onChange={(e) => setHandoverEventType(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                        >
                          <option value="">-- Choose Next Milestone --</option>
                          <option value="HANDOVER_TO_DEST_HUB">HANDOVER_TO_DEST_HUB (Staff → Dest Hub)</option>
                          <option value="HANDOVER_TO_ORIGIN_HUB">HANDOVER_TO_ORIGIN_HUB (Dest Hub → Origin Hub)</option>
                          <option value="HANDOVER_TO_ORIGIN_BRANCH">HANDOVER_TO_ORIGIN_BRANCH (Origin Hub → Staff)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-2">Handover Cash Value (₹)</label>
                        <input
                          type="number"
                          value={handoverExpectedAmount}
                          onChange={(e) => setHandoverExpectedAmount(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm font-semibold text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-2">Target Recipient Operator</label>
                        <select
                          value={handoverTargetUser}
                          onChange={(e) => setHandoverTargetUser(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none"
                        >
                          <option value="">-- Choose Staff Recipient --</option>
                          {metadata.users.filter(u => u.id !== user?.id).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => handleHandoverInitiation(selectedParcelId)}
                        className="w-full bg-white hover:bg-slate-100 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs tracking-wider transition-transform active:scale-95"
                      >
                        Submit Handover Initiation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Overdue / Discrepancy SLA Checking tab */}
            {activeTab === 'history' && (
              <div className="space-y-5">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h3 className="font-bold text-white text-sm mb-2">48-Hour Handover SLA simulation</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Parcels in transit must be handed over within 48 hours. Trigger SLA scans here to check for overdue items.
                  </p>
                  
                  <button
                    onClick={runOverdueCron}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Run SLA Overdue Scan</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-red-400">Flagged Discrepancies</h3>
                  <div className="space-y-2">
                    {discrepancies.length === 0 ? (
                      <p className="text-xs text-slate-500">No active discrepancies flagged at your location.</p>
                    ) : (
                      discrepancies.map((p) => (
                        <div key={p.id} className="bg-red-950/20 border border-red-900/30 rounded-xl p-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-white">{p.id}</span>
                            <span className="text-red-400 font-semibold">₹{p.codAmount}</span>
                          </div>
                          <p className="text-[11px] text-red-300 mt-2">
                            {p.ledgerEvents[0]?.discrepancyNote || 'Amount discrepancy / SLA delayed.'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FINANCE & RECONCILIATION VIEW */}
        {(user?.role === 'FINANCE_OFFICER' || user?.role === 'ADMIN') && (
          <div className="space-y-6">
            {/* Tab switch */}
            <div className="flex bg-slate-900 border border-slate-800/80 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Discrepancy Tickets ({discrepancies.length})
              </button>
              <button
                onClick={() => setActiveTab('payouts')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'payouts' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Seller Payouts ({readyForPayout.length})
              </button>
            </div>

            {/* Discrepancy view */}
            {activeTab === 'dashboard' && (
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Reconciliation Queue</h3>
                  <button onClick={runOverdueCron} className="text-emerald-400 hover:underline text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Run SLA Scan</span>
                  </button>
                </div>
                
                <div className="space-y-3">
                  {discrepancies.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedParcelId(p.id);
                        setResolutionAmount(p.codAmount.toString());
                      }}
                      className={`p-4 rounded-xl border text-left space-y-2 transition-all cursor-pointer ${selectedParcelId === p.id ? 'bg-red-950/20 border-red-500' : 'bg-slate-900/60 border-slate-900 hover:border-slate-850'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-sm">{p.id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400">Discrepancy</span>
                      </div>
                      <div className="text-xs text-slate-400">Original Value: ₹{p.codAmount}</div>
                      <p className="text-xs text-red-300 italic bg-red-950/40 p-2 rounded-lg">
                        {p.ledgerEvents[0]?.discrepancyNote || 'Delayed/overdue handover.'}
                      </p>
                    </div>
                  ))}
                </div>

                {selectedParcelId && selectedParcel && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 animate-fadeIn">
                    <div className="font-bold text-white border-b border-slate-800 pb-2 flex justify-between">
                      <span>Resolve Discrepancy</span>
                      <span className="font-mono text-emerald-400">{selectedParcelId}</span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-2">Resume Flow Milestone</label>
                        <select
                          value={resolutionState}
                          onChange={(e) => setResolutionState(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200"
                        >
                          <option value="">-- Select Milestone to Resume Flow --</option>
                          <option value="COD_COLLECTED">COD_COLLECTED (Reset to collected)</option>
                          <option value="HANDOVER_TO_DEST_HUB">HANDOVER_TO_DEST_HUB (Reset to Dest Hub)</option>
                          <option value="HANDOVER_TO_ORIGIN_HUB">HANDOVER_TO_ORIGIN_HUB (Reset to Origin Hub)</option>
                          <option value="HANDOVER_TO_ORIGIN_BRANCH">HANDOVER_TO_ORIGIN_BRANCH (Reset to Origin Branch)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-2">Settle Cash Amount Value (₹)</label>
                        <input
                          type="number"
                          value={resolutionAmount}
                          onChange={(e) => setResolutionAmount(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm font-semibold text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-2">Finance Resolution Note</label>
                        <textarea
                          placeholder="Provide audit reason for settlement values"
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 h-20"
                        />
                      </div>

                      <button
                        onClick={() => handleResolveDiscrepancy(selectedParcelId)}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs tracking-wider transition-transform active:scale-95"
                      >
                        Submit Official Reconciliation Resolution
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payouts view */}
            {activeTab === 'payouts' && (
              <div className="space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Approved Payout Queue</h3>
                
                <div className="space-y-3">
                  {readyForPayout.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedParcelId(p.id)}
                      className={`p-4 rounded-xl border text-left space-y-2 cursor-pointer transition-all ${selectedParcelId === p.id ? 'bg-emerald-950/20 border-emerald-500' : 'bg-slate-900/60 border-slate-900 hover:border-slate-850'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-sm">{p.id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400">Ready</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Seller: {p.sellerId.slice(0, 8)}...</span>
                        <span className="font-bold text-white">₹{p.codAmount}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedParcelId && selectedParcel && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 animate-fadeIn">
                    <div className="font-bold text-white border-b border-slate-800 pb-2">
                      Approve Payout: <span className="font-mono text-emerald-400">{selectedParcelId}</span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-2">Seller Bank Transaction Reference ID</label>
                        <input
                          type="text"
                          placeholder="e.g. TXN99882233"
                          value={payoutRefId}
                          onChange={(e) => setPayoutRefId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-semibold text-white focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={() => handlePayoutSubmit(selectedParcelId)}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs tracking-wider transition-transform active:scale-95"
                      >
                        Approve Seller Payout & Close File
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ADMIN VIEW & AUDIT EXPLORER */}
        {user?.role === 'ADMIN' && (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex bg-slate-900 border border-slate-800/80 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
              >
                Register Parcel
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
              >
                Audit Log search
              </button>
            </div>

            {/* Create Parcel */}
            {activeTab === 'dashboard' && (
              <form onSubmit={handleCreateParcel} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2">Register COD Parcel</h3>
                
                {parcelSuccessMsg && (
                  <div className="p-3 bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs rounded-xl font-semibold">
                    {parcelSuccessMsg}
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-400">Parcel ID (Tracking Barcode)</label>
                    <input
                      type="text"
                      placeholder="e.g. PRCL-999"
                      value={newParcelId}
                      required
                      onChange={(e) => setNewParcelId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-slate-400">COD Cash Value (₹)</label>
                    <input
                      type="number"
                      placeholder="Amount to collect"
                      value={newParcelCod}
                      required
                      onChange={(e) => setNewParcelCod(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-slate-400">Seller Merchant</label>
                    <select
                      value={newParcelSeller}
                      required
                      onChange={(e) => setNewParcelSeller(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Choose Seller --</option>
                      {metadata.users.filter(u => u.role === 'SELLER').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-slate-400">Origin Branch</label>
                    <select
                      value={newParcelOrigin}
                      required
                      onChange={(e) => setNewParcelOrigin(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Choose Origin Location --</option>
                      {metadata.locations.filter(l => l.type === 'BRANCH').map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-slate-400">Destination Branch</label>
                    <select
                      value={newParcelDest}
                      required
                      onChange={(e) => setNewParcelDest(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Choose Destination Location --</option>
                      {metadata.locations.filter(l => l.type === 'BRANCH').map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs tracking-wider transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Parcel</span>
                </button>
              </form>
            )}

            {/* Audit Log search */}
            {activeTab === 'admin' && (
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by Parcel ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                </div>

                <div className="space-y-3">
                  {filteredParcels.map((parcel) => (
                    <div
                      key={parcel.id}
                      onClick={() => setSelectedParcelId(parcel.id)}
                      className={`p-4 rounded-xl border text-left space-y-2 cursor-pointer transition-all ${selectedParcelId === parcel.id ? 'bg-slate-900 border-slate-500' : 'bg-slate-900/60 border-slate-900'}`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-white">{parcel.id}</span>
                        {getStatusBadge(parcel.currentState)}
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Original COD: ₹{parcel.codAmount}</span>
                        <span>Route: {parcel.originLocation.name.split(' ')[0]} → {parcel.destinationLocation.name.split(' ')[0]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Append-Only Ledger Trail Display (Drawer popup design) */}
        {selectedParcelId && selectedParcel && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <div>
                <h4 className="font-bold text-white text-sm">Append-Only Audit Ledger</h4>
                <p className="text-[10px] text-slate-500">Un-editable ledger log events sequence</p>
              </div>
              <button onClick={() => setSelectedParcelId(null)} className="text-xs text-slate-500 hover:text-white">
                Close
              </button>
            </div>

            <div className="space-y-4 relative border-l-2 border-slate-800 ml-3 pl-4">
              {selectedParcel.ledgerEvents.map((evt) => (
                <div key={evt.id} className="relative text-xs">
                  {/* Timeline Dot */}
                  <span className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-slate-700 border-2 border-slate-950"></span>
                  
                  <div className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
                    {evt.eventType}
                  </div>
                  
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {new Date(evt.timestamp).toLocaleString()}
                  </div>

                  <div className="text-slate-300 mt-1">
                    {evt.fromParty && <span>From: {evt.fromParty.name} </span>}
                    {evt.toParty && <span>→ To: {evt.toParty.name}</span>}
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    Expected: ₹{evt.expectedAmount} | Confirmed: {evt.confirmedAmount !== null ? `₹${evt.confirmedAmount}` : 'Unconfirmed'}
                  </div>

                  {evt.discrepancyNote && (
                    <div className="mt-1.5 p-2 bg-slate-950 border border-slate-800 rounded text-[11px] text-amber-400">
                      {evt.discrepancyNote}
                    </div>
                  )}

                  {evt.gpsCoords && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                      <MapPin className="w-3 h-3" />
                      <span>GPS: {evt.gpsCoords}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Global Bottom Tab Bar (mobile-first layout feel) */}
      <footer className="bg-slate-900 border-t border-slate-800/80 fixed bottom-0 left-0 right-0 max-w-md mx-auto py-2.5 px-6 flex justify-between items-center z-40 shadow-xl">
        <button
          onClick={() => {
            resetForms();
            loadData();
          }}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4 text-emerald-400" />
          <span className="text-[9px] font-semibold">Refresh</span>
        </button>

        <div className="text-[11px] text-slate-500 font-medium">
          FindMe COD v1.0.0
        </div>
        
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span>SLA active</span>
        </div>
      </footer>
    </div>
  );
}
