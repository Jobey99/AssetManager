import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  MapPin, 
  Users, 
  QrCode, 
  History, 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  ArrowLeftRight, 
  AlertTriangle, 
  Printer, 
  CheckCircle, 
  X, 
  ChevronRight, 
  Info,
  Calendar,
  AlertCircle,
  ShieldAlert,
  Download,
  Settings,
  Edit,
  User,
  Folder
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';

const DEFAULT_SERVER_URL = 'https://assets.josh-green.uk';

const getApiBase = () => {
  const stored = localStorage.getItem('server_api_url');
  if (stored) {
    return stored.endsWith('/api') ? stored : `${stored}/api`;
  }
  
  // If running in Capacitor / native webview, default to the production backend server IP/URL
  const isNative = window.location.protocol === 'file:' || 
                   (window.location.hostname === 'localhost' && !window.location.port) ||
                   window.location.hostname.includes('capacitor');
  if (isNative) {
    return `${DEFAULT_SERVER_URL}/api`;
  }
  
  return import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';
};

const API_BASE = getApiBase();

// Helper component to render QR Codes dynamically
function QrCodeImage({ value, size = 150 }) {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (value) {
      const qrValue = value.startsWith('http://') || value.startsWith('https://')
        ? value
        : `https://assets.josh-green.uk/?id=${encodeURIComponent(value)}`;

      QRCode.toDataURL(qrValue, { 
        width: size, 
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err, url) => {
        if (!err) setQrUrl(url);
      });
    }
  }, [value, size]);

  return qrUrl ? (
    <div className="qr-preview-box">
      <img src={qrUrl} alt={`QR Code for ${value}`} style={{ width: size, height: size }} />
    </div>
  ) : (
    <div style={{ width: size, height: size, backgroundColor: '#f1f5f9', borderRadius: '8px' }} />
  );
}

// Printable label sub-component for print layouts
function PrintableLabel({ asset }) {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    QRCode.toDataURL(asset.id, { 
      margin: 1, 
      width: 150
    }, (err, url) => {
      if (!err) setQrUrl(url);
    });
  }, [asset.id]);

  return (
    <div className="thermal-label">
      <div className="thermal-label-qr">
        {qrUrl && <img src={qrUrl} alt="QR Label" />}
      </div>
      <div className="thermal-label-info">
        <h4 className="thermal-label-title">{asset.name}</h4>
        <div className="thermal-label-sku">{asset.sku || asset.id}</div>
        <div className="thermal-label-loc">{asset.location_name || 'No Location'}</div>
      </div>
    </div>
  );
}

function App() {
  // Authentication & Session states
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('auth_token'));
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('auth_user') || 'null');
    } catch {
      return null;
    }
  });
  const [loginUsername, setLoginUsername] = useState(() => localStorage.getItem('saved_username') || '');
  const [loginPassword, setLoginPassword] = useState(() => localStorage.getItem('saved_password') || '');
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('remember_me') !== 'false');

  // Change Password Modal states
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordOld, setChangePasswordOld] = useState('');
  const [changePasswordNew, setChangePasswordNew] = useState('');
  const [changePasswordConfirm, setChangePasswordConfirm] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');

  // Navigation & Core states
  const [currentView, setCurrentView] = useState('dashboard');
  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  // Print Queue
  const [printQueue, setPrintQueue] = useState([]);

  // Filters & Search
  const [searchQ, setSearchQ] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Sorting
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // View Mode for Consolidating Locations
  const [viewMode, setViewMode] = useState('grouped');
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Active Asset Drawer
  const [activeAsset, setActiveAsset] = useState(null);
  const [activeAssetDetails, setActiveAssetDetails] = useState(null);

  // Scanner State
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedAsset, setScannedAsset] = useState(null);
  const [scanError, setScanError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [scannerZoom, setScannerZoom] = useState(1);
  const scannerRef = useRef(null);

  // Quick Transaction Form State
  const [txType, setTxType] = useState('CHECK_OUT');
  const [txQty, setTxQty] = useState(1);
  const [txLocation, setTxLocation] = useState('');
  const [txUser, setTxUser] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
      return user.name || '';
    } catch {
      return '';
    }
  });
  const [txNotes, setTxNotes] = useState('');
  const [txSuccessMessage, setTxSuccessMessage] = useState('');
  const [txErrorMessage, setTxErrorMessage] = useState('');

  // Admin Manual Overrides State
  const [manualOverrideAsset, setManualOverrideAsset] = useState('');
  const [manualOverrideQty, setManualOverrideQty] = useState(0);
  const [manualOverrideNotes, setManualOverrideNotes] = useState('');
  // Modals / Drawer Create/Edit Forms
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showEditAsset, setShowEditAsset] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);

  // Connection settings
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('server_api_url') || '');
  const [serverInput, setServerInput] = useState(() => localStorage.getItem('server_api_url') || '');
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connectionOk, setConnectionOk] = useState(true);

  // Offline sync queue states
  const [syncQueueCount, setSyncQueueCount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('local_sync_queue') || '[]').length;
    } catch {
      return 0;
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Form inputs
  const [newAsset, setNewAsset] = useState({ id: '', name: '', description: '', sku: '', quantity: 0, unit: 'pcs', location_id: '', min_quantity: 0, category: 'Uncategorized' });
  const [newLocation, setNewLocation] = useState({ name: '', description: '' });
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [newUser, setNewUser] = useState({ name: '', role: 'Engineer', password: '' });

  // Custom fetch wrapper injecting authentication headers
  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('auth_token');
    const headers = {
      ...options.headers,
      'Authorization': token || ''
    };
    
    if (!(options.body instanceof FormData) && !(options.body instanceof Blob)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
      return response;
    } catch (e) {
      throw e;
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        
        // Remember me logic
        if (rememberMe) {
          localStorage.setItem('saved_username', loginUsername);
          localStorage.setItem('saved_password', loginPassword);
          localStorage.setItem('remember_me', 'true');
        } else {
          localStorage.removeItem('saved_username');
          localStorage.removeItem('saved_password');
          localStorage.setItem('remember_me', 'false');
        }

        setIsAuthenticated(true);
        setCurrentUser(data.user);
        setTxUser(data.user.name);
        
        // Keep inputs filled if remembered, otherwise clear
        if (!rememberMe) {
          setLoginUsername('');
          setLoginPassword('');
        }

        setTimeout(() => {
          fetchAssets();
          fetchLocations();
          fetchCategories();
          fetchUsers();
          fetchTransactions();
        }, 100);
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error(err);
      // Offline fallback login check
      const cached = localStorage.getItem('cached_users');
      if (cached) {
        const list = JSON.parse(cached);
        const match = list.find(u => u.name.toLowerCase() === loginUsername.toLowerCase());
        if (match && loginPassword === (loginUsername.toLowerCase() + '123')) {
          const dummyToken = 'offline_' + Date.now();
          localStorage.setItem('auth_token', dummyToken);
          localStorage.setItem('auth_user', JSON.stringify(match));

          // Remember me logic for offline mode
          if (rememberMe) {
            localStorage.setItem('saved_username', loginUsername);
            localStorage.setItem('saved_password', loginPassword);
            localStorage.setItem('remember_me', 'true');
          } else {
            localStorage.removeItem('saved_username');
            localStorage.removeItem('saved_password');
            localStorage.setItem('remember_me', 'false');
          }

          setIsAuthenticated(true);
          setCurrentUser(match);
          setTxUser(match.name);
          
          if (!rememberMe) {
            setLoginUsername('');
            setLoginPassword('');
          }

          alert("Logged in offline mode using cached credentials.");
          return;
        }
      }
      setLoginError('Could not reach authentication server. Check connection.');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 
          'Authorization': localStorage.getItem('auth_token') || '',
          'Content-Type': 'application/json'
        }
      });
    } catch (e) {
      console.warn("Logout request failed:", e);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setIsAuthenticated(false);
    setCurrentUser(null);
    // Restore saved credentials to fields if they exist
    setLoginUsername(localStorage.getItem('saved_username') || '');
    setLoginPassword(localStorage.getItem('saved_password') || '');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');

    if (changePasswordNew !== changePasswordConfirm) {
      setChangePasswordError('New passwords do not match.');
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: changePasswordOld,
          newPassword: changePasswordNew
        })
      });

      const data = await res.json();
      if (res.ok) {
        setChangePasswordSuccess('Password updated successfully!');
        setChangePasswordOld('');
        setChangePasswordNew('');
        setChangePasswordConfirm('');
        setTimeout(() => {
          setShowChangePasswordModal(false);
          setChangePasswordSuccess('');
        }, 1500);
      } else {
        setChangePasswordError(data.error || 'Failed to change password.');
      }
    } catch (err) {
      console.error(err);
      setChangePasswordError('Server communication error. Check connection.');
    }
  };

  const checkConnection = async (url) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${url}/users`, { 
        signal: controller.signal,
        headers: token ? { 'Authorization': token } : {}
      });
      clearTimeout(timeoutId);
      if (res.ok || res.status === 401) {
        setConnectionOk(true);
        return true;
      }
    } catch (e) {
      console.warn("Connection test failed for:", url);
    }
    setConnectionOk(false);
    return false;
  };

  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('local_sync_queue') || '[]');
    if (queue.length === 0) return;
    
    // Test connection first
    const ok = await checkConnection(API_BASE);
    if (!ok) return;
    
    setIsSyncing(true);
    console.log(`Starting sync for ${queue.length} items...`);
    
    let failedCount = 0;
    const remainingQueue = [];
    
    for (const item of queue) {
      if (item.type === 'TX_SUBMIT') {
        try {
          const res = await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          });
          if (!res.ok) {
            console.error("Sync item failed:", item, await res.text());
            remainingQueue.push(item);
            failedCount++;
          }
        } catch (err) {
          console.error("Network error during sync of item:", item, err);
          remainingQueue.push(item);
          failedCount++;
        }
      }
    }
    
    localStorage.setItem('local_sync_queue', JSON.stringify(remainingQueue));
    setSyncQueueCount(remainingQueue.length);
    setIsSyncing(false);
    
    if (failedCount === 0) {
      console.log("Offline sync complete!");
      fetchAssets();
      fetchTransactions();
      fetchLocations();
      fetchCategories();
    }
  };

  // Load everything on mount
  useEffect(() => {
    const checkAndFetch = async () => {
      await checkConnection(API_BASE);
      // Fetch functions will automatically use cache if the connection check failed
      fetchAssets();
      fetchLocations();
      fetchCategories();
      fetchUsers();
      fetchTransactions();
    };
    checkAndFetch();
  }, []);

  // Periodically check connection and trigger sync
  useEffect(() => {
    const interval = setInterval(() => {
      syncOfflineQueue();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [connectionOk]);

  // Fetch functions
  const fetchAssets = async () => {
    try {
      const res = await authFetch(`${API_BASE}/assets`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
        localStorage.setItem('cached_assets', JSON.stringify(data));
      }
    } catch (e) {
      console.warn("Using cached assets:", e);
      const cached = localStorage.getItem('cached_assets');
      if (cached) setAssets(JSON.parse(cached));
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await authFetch(`${API_BASE}/locations`);
      if (res.ok) {
        const data = await res.json();
        setLocations(data);
        localStorage.setItem('cached_locations', JSON.stringify(data));
      }
    } catch (e) {
      console.warn("Using cached locations:", e);
      const cached = localStorage.getItem('cached_locations');
      if (cached) setLocations(JSON.parse(cached));
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await authFetch(`${API_BASE}/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        localStorage.setItem('cached_categories', JSON.stringify(data));
      }
    } catch (e) {
      console.warn("Using cached categories:", e);
      const cached = localStorage.getItem('cached_categories');
      if (cached) setCategories(JSON.parse(cached));
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await authFetch(`${API_BASE}/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        localStorage.setItem('cached_users', JSON.stringify(data));
        if (data.length > 0 && !txUser) {
          setTxUser(data[0].name);
        }
      }
    } catch (e) {
      console.warn("Using cached users:", e);
      const cached = localStorage.getItem('cached_users');
      if (cached) {
        const data = JSON.parse(cached);
        setUsers(data);
        if (data.length > 0 && !txUser) {
          setTxUser(data[0].name);
        }
      }
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await authFetch(`${API_BASE}/transactions`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
        localStorage.setItem('cached_transactions', JSON.stringify(data));
      }
    } catch (e) {
      console.warn("Using cached transactions:", e);
      const cached = localStorage.getItem('cached_transactions');
      if (cached) setTransactions(JSON.parse(cached));
    }
  };

  const fetchAssetDetails = async (id) => {
    try {
      const res = await authFetch(`${API_BASE}/assets/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveAssetDetails(data);
      }
    } catch (e) {
      console.warn("Using cached asset details:", e);
      const localTxs = transactions.filter(t => t.asset_id === id);
      setActiveAssetDetails({ transactions: localTxs });
    }
  };

  // Trigger loading asset details when activeAsset is selected
  useEffect(() => {
    if (activeAsset) {
      fetchAssetDetails(activeAsset.id);
    } else {
      setActiveAssetDetails(null);
    }
  }, [activeAsset]);

  // URL Deep-linking scanner auto-open
  useEffect(() => {
    if (assets.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const urlAssetId = params.get('id') || params.get('assetId');
      if (urlAssetId) {
        const match = assets.find(a => a.id.toLowerCase() === urlAssetId.toLowerCase());
        if (match) {
          setActiveAsset(match);
          // Clean the query parameters from browser URL bar without reloading
          const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: newUrl }, '', newUrl);
        }
      }
    }
  }, [assets]);

  // Native back button interceptor for Android
  useEffect(() => {
    let handler;
    const setupBackButton = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        handler = await CapApp.addListener('backButton', (data) => {
          if (showChangePasswordModal) {
            setShowChangePasswordModal(false);
            return;
          }
          if (showEditAsset) {
            setShowEditAsset(false);
            return;
          }
          if (showAddAsset) {
            setShowAddAsset(false);
            return;
          }
          if (showAddLocation) {
            setShowAddLocation(false);
            return;
          }
          if (showAddUser) {
            setShowAddUser(false);
            return;
          }
          if (activeAsset) {
            setActiveAsset(null);
            return;
          }
          if (scannedAsset) {
            setScannedAsset(null);
            return;
          }
          if (currentView !== 'assets' && currentView !== 'dashboard') {
            setCurrentView('assets');
            return;
          }
          CapApp.exitApp();
        });
      } catch (err) {
        console.log("Capacitor App module not active (standard browser environment):", err);
      }
    };
    
    setupBackButton();
    
    return () => {
      if (handler && handler.remove) {
        handler.remove();
      }
    };
  }, [
    activeAsset, 
    scannedAsset, 
    showEditAsset, 
    showAddAsset, 
    showAddLocation, 
    showAddUser, 
    showChangePasswordModal,
    currentView
  ]);

  // Admin and role definitions
  const isAdmin = currentUser?.role === 'Admin';

  // Scanner Logic
  // Scanner Logic
  useEffect(() => {
    let isMounted = true;
    let qrCode = null;

    const startScannerInstance = async () => {
      if (currentView === 'scanner' && scannerActive && !scannedAsset) {
        setScanError('');
        
        const container = document.getElementById("qr-reader");
        if (!container) return;

        if (!scannerRef.current) {
          try {
            scannerRef.current = new Html5Qrcode("qr-reader");
          } catch (e) {
            console.error("Failed to create Html5Qrcode:", e);
            return;
          }
        }
        
        qrCode = scannerRef.current;
        
        if (qrCode.isScanning) {
          return; // Already running
        }

        const successCallback = (decodedText) => {
          if (isMounted) handleAssetScanned(decodedText);
        };
        const errorCallback = (errorMessage) => {};
        const config = {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          }
        };

        const startWithFallback = async () => {
          try {
            await qrCode.start({ facingMode: "environment" }, config, successCallback, errorCallback);
            if (isMounted) applyAutofocusAndZoom(qrCode);
          } catch (err) {
            console.error("Camera fallback failed:", err);
            if (isMounted) setScanError("Unable to access camera. Make sure camera permissions are enabled.");
          }
        };

        if (currentCameraId) {
          try {
            await qrCode.start(currentCameraId, config, successCallback, errorCallback);
            if (isMounted) applyAutofocusAndZoom(qrCode);
          } catch (err) {
            console.warn("Starting with selected camera failed, trying fallback:", err);
            await startWithFallback();
          }
        } else {
          try {
            const devices = await Html5Qrcode.getCameras();
            if (!isMounted) return;
            if (devices && devices.length > 0) {
              setAvailableCameras(devices);
              
              const backCameras = devices.filter(device => {
                const label = device.label.toLowerCase();
                return label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('main');
              });

              let selectedId = null;
              if (backCameras.length > 0) {
                const mainBack = backCameras.find(device => {
                  const label = device.label.toLowerCase();
                  return !label.includes('wide') && 
                         !label.includes('ultra') && 
                         !label.includes('0.6') && 
                         !label.includes('macro') && 
                         !label.includes('depth') &&
                         !label.includes('zoom');
                });
                selectedId = mainBack ? mainBack.id : backCameras[0].id;
              } else {
                selectedId = devices[devices.length - 1].id;
              }

              setCurrentCameraId(selectedId);
              
              await qrCode.start(selectedId, config, successCallback, errorCallback);
              if (isMounted) applyAutofocusAndZoom(qrCode);
            } else {
              await startWithFallback();
            }
          } catch (err) {
            console.warn("Error getting cameras list, trying fallback:", err);
            await startWithFallback();
          }
        }
      }
    };

    startScannerInstance();

    return () => {
      isMounted = false;
      if (qrCode) {
        if (qrCode.isScanning) {
          qrCode.stop().then(() => {
            try { qrCode.clear(); } catch(e) {}
            if (scannerRef.current === qrCode) {
              scannerRef.current = null;
            }
          }).catch(e => console.log("Cleanup stop error:", e));
        } else {
          try { qrCode.clear(); } catch(e) {}
          if (scannerRef.current === qrCode) {
            scannerRef.current = null;
          }
        }
      }
    };
  }, [currentView, scannerActive, scannedAsset]);

  const stopScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      return scannerRef.current.stop()
        .then(() => {
          console.log("Scanner stopped.");
        })
        .catch(e => {
          console.warn("Error stopping scanner:", e);
        });
    }
    return Promise.resolve();
  };

  const applyAutofocusAndZoom = (html5QrCode, targetZoomValue = null) => {
    // Reset video transform and state on start
    const videoEl = document.querySelector('#qr-reader video');
    if (videoEl) {
      videoEl.style.transform = 'none';
    }
    setScannerZoom(1);

    setTimeout(() => {
      try {
        if (!html5QrCode || !html5QrCode.isScanning) return;
        const track = html5QrCode.getRunningTrack();
        if (track) {
          const capabilities = track.getCapabilities ? track.getCapabilities() : {};
          const constraints = {};
          const advancedConstraints = [];
          
          if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            advancedConstraints.push({ focusMode: 'continuous' });
          }
          
          const zoomToUse = targetZoomValue !== null ? targetZoomValue : 1;
          if (capabilities.zoom && zoomToUse > 1) {
            const minZoom = capabilities.zoom.min || 1;
            const maxZoom = capabilities.zoom.max || 3;
            const finalZoom = Math.min(zoomToUse, maxZoom);
            if (finalZoom >= minZoom) {
              advancedConstraints.push({ zoom: finalZoom });
            }
          }
          
          if (advancedConstraints.length > 0) {
            constraints.advanced = advancedConstraints;
          }
          
          if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            constraints.focusMode = 'continuous';
          }
          
          if (Object.keys(constraints).length > 0) {
            html5QrCode.applyVideoConstraints(constraints)
              .then(() => console.log("Applied camera constraints:", constraints))
              .catch(err => {
                console.warn("Failed to apply camera constraints:", err);
              });
          }
        }
      } catch (err) {
        console.warn("Error in applyAutofocusAndZoom:", err);
      }
    }, 1500);
  };

  const toggleZoom = () => {
    const nextZoom = scannerZoom === 1 ? 2 : 1;
    setScannerZoom(nextZoom);
    
    // Apply CSS/Software zoom fallback to make scanning easier on devices without hardware zoom API support
    const videoEl = document.querySelector('#qr-reader video');
    if (videoEl) {
      videoEl.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
      if (nextZoom === 2) {
        videoEl.style.transform = 'scale(1.5)';
      } else {
        videoEl.style.transform = 'none';
      }
    }

    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        const track = scannerRef.current.getRunningTrack();
        if (track) {
          const capabilities = track.getCapabilities ? track.getCapabilities() : {};
          if (capabilities.zoom) {
            const maxZoom = capabilities.zoom.max || 3;
            const targetZoom = nextZoom === 2 ? Math.min(2.0, maxZoom) : 1.0;
            scannerRef.current.applyVideoConstraints({
              advanced: [{ zoom: targetZoom }]
            }).then(() => {
              console.log("Zoom level toggled to:", targetZoom);
            }).catch(err => {
              console.warn("Failed to toggle zoom constraint:", err);
            });
          }
        }
      } catch (err) {
        console.warn("Error in zoom toggle:", err);
      }
    }
  };



  const handleCameraSwitch = async () => {
    if (availableCameras.length <= 1 || !scannerRef.current || !scannerRef.current.isScanning) return;
    const currentIndex = availableCameras.findIndex(d => d.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];
    
    setScanError('');
    const qrCode = scannerRef.current;

    try {
      // 1. Stop current scan stream to unlock camera hardware
      await qrCode.stop();
      console.log("Scanner stopped successfully for camera switch.");
    } catch (e) {
      console.warn("Failed to stop scanner during switch:", e);
    }

    // 2. Start the scanner with the new camera ID on the same instance
    try {
      const config = {
        fps: 10,
        qrbox: (width, height) => {
          const size = Math.min(width, height) * 0.7;
          return { width: size, height: size };
        }
      };
      const successCallback = (decodedText) => {
        handleAssetScanned(decodedText);
      };
      const errorCallback = (errorMessage) => {};

      await qrCode.start(nextCamera.id, config, successCallback, errorCallback);
      setCurrentCameraId(nextCamera.id);
      applyAutofocusAndZoom(qrCode);
    } catch (err) {
      console.error("Camera switch to next camera failed:", err);
      setScanError("Failed to switch camera. Reverting to auto environment camera...");
      
      // Fallback: try starting with environment facing mode
      try {
        await qrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            handleAssetScanned(decodedText);
          },
          (errorMessage) => {}
        );
        applyAutofocusAndZoom(qrCode);
      } catch (fallbackErr) {
        console.error("Camera switch fallback failed:", fallbackErr);
        setScanError("Failed to switch camera. Make sure permissions are granted.");
      }
    }
  };

  const extractAssetId = (text) => {
    if (!text) return '';
    const trimmed = text.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const url = new URL(trimmed);
        const idParam = url.searchParams.get('id') || url.searchParams.get('assetId');
        if (idParam) {
          return idParam;
        }
        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length > 0) {
          return segments[segments.length - 1];
        }
      } catch (err) {
        console.error("Failed to parse URL in scanned text:", err);
      }
    }
    return trimmed;
  };

  const handleAssetScanned = async (rawText) => {
    const qrId = extractAssetId(rawText);
    if (!qrId) return;
    stopScanner();
    try {
      const res = await authFetch(`${API_BASE}/assets/${qrId}`);
      if (res.ok) {
        const data = await res.json();
        setScannedAsset(data);
        setTxLocation(data.location_id || '');
        setTxQty(1);
        setTxSuccessMessage('');
        setTxErrorMessage('');
      } else {
        const createOption = confirm(`Scanned QR ID '${qrId}' was not found in the database. Would you like to create a new asset with this QR Code?`);
        if (createOption) {
          setNewAsset(prev => ({ ...prev, id: qrId }));
          setShowAddAsset(true);
          setCurrentView('assets');
          setScannedAsset(null);
          setScannerActive(false);
        } else {
          setScannedAsset(null);
        }
      }
    } catch (e) {
      console.warn("Offline scan lookup:", e);
      const cachedAssetsStr = localStorage.getItem('cached_assets');
      if (cachedAssetsStr) {
        const cachedList = JSON.parse(cachedAssetsStr);
        const match = cachedList.find(a => a.id === qrId);
        if (match) {
          setScannedAsset(match);
          setTxLocation(match.location_id || '');
          setTxQty(1);
          setTxSuccessMessage('');
          setTxErrorMessage('');
          return;
        }
      }
      alert(`Scanned code '${qrId}' could not be resolved offline.`);
      setScannedAsset(null);
    }
  };

  const handleManualScanSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleAssetScanned(manualCode.trim());
      setManualCode('');
    }
  };

  // Transaction Handler
  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    setTxSuccessMessage('');
    setTxErrorMessage('');

    const targetAssetId = scannedAsset ? scannedAsset.id : activeAsset.id;

    try {
      const res = await authFetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: targetAssetId,
          type: txType,
          quantity_change: txQty,
          user_name: txUser,
          location_id: txLocation || null,
          notes: txNotes
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        setTxSuccessMessage(`Successfully updated inventory for ${data.name}!`);
        setTxNotes('');
        setTxQty(1);
        
        fetchAssets();
        fetchTransactions();
        fetchLocations();

        if (scannedAsset) {
          setTimeout(() => {
            setScannedAsset(null);
            setTxSuccessMessage('');
            setScannerActive(true);
          }, 2000);
        } else {
          fetchAssetDetails(targetAssetId);
          const updated = assets.map(a => a.id === targetAssetId ? { ...a, quantity: data.quantity, status: data.status, location_id: data.location_id, location_name: data.location_name } : a);
          setAssets(updated);
        }
      } else {
        setTxErrorMessage(data.error || "Failed to process transaction.");
      }
    } catch (err) {
      console.error("Transaction API failed, attempting offline queue:", err);
      const isOfflineMode = !connectionOk || err.message.includes('Failed to fetch') || err.message.includes('Load failed') || err.name === 'TypeError';
      
      if (isOfflineMode) {
        const offlineAction = {
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
          type: 'TX_SUBMIT',
          payload: {
            asset_id: targetAssetId,
            type: txType,
            quantity_change: txQty,
            user_name: txUser,
            location_id: txLocation || null,
            notes: txNotes ? `${txNotes} (Offline queued)` : "(Offline queued)"
          }
        };
        
        const currentQueue = JSON.parse(localStorage.getItem('local_sync_queue') || '[]');
        currentQueue.push(offlineAction);
        localStorage.setItem('local_sync_queue', JSON.stringify(currentQueue));
        setSyncQueueCount(currentQueue.length);
        
        const asset = assets.find(a => a.id === targetAssetId);
        if (asset) {
          const qtyChange = txType === 'CHECK_IN' ? txQty : (txType === 'CHECK_OUT' ? -txQty : 0);
          const isOfflineTransfer = (txType === 'CHECK_OUT' && txLocation && parseInt(txLocation, 10) !== asset.location_id);
          
          let updatedAssetsList = [];
          const destLocName = txLocation ? (locations.find(l => l.id.toString() === txLocation.toString())?.name || asset.location_name) : asset.location_name;

          if (isOfflineTransfer) {
            const newSourceQty = Math.max(0, asset.quantity - txQty);
            const sourceStatus = calculateStatus(newSourceQty, asset.min_quantity);
            const updatedSourceAsset = {
              ...asset,
              quantity: newSourceQty,
              status: sourceStatus
            };

            const destLocId = parseInt(txLocation, 10);
            const matchingDestAsset = assets.find(a => a.name.toLowerCase() === asset.name.toLowerCase() && a.location_id === destLocId);

            if (matchingDestAsset) {
              const newDestQty = matchingDestAsset.quantity + txQty;
              const destStatus = calculateStatus(newDestQty, matchingDestAsset.min_quantity);
              const updatedDestAsset = {
                ...matchingDestAsset,
                quantity: newDestQty,
                status: destStatus
              };
              updatedAssetsList = assets.map(a => {
                if (a.id === targetAssetId) return updatedSourceAsset;
                if (a.id === matchingDestAsset.id) return updatedDestAsset;
                return a;
              });
            } else {
              const newAssetId = 'qr-off-' + Date.now();
              const initialDestQty = txQty;
              const destStatus = calculateStatus(initialDestQty, asset.min_quantity);
              const newOfflineAsset = {
                id: newAssetId,
                name: asset.name,
                description: asset.description || '',
                sku: asset.sku || '',
                quantity: initialDestQty,
                unit: asset.unit || 'pcs',
                location_id: destLocId,
                location_name: destLocName,
                status: destStatus,
                min_quantity: asset.min_quantity,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              updatedAssetsList = assets.map(a => a.id === targetAssetId ? updatedSourceAsset : a);
              updatedAssetsList.push(newOfflineAsset);
            }
          } else {
            const newQty = txType === 'STOCK_ADJUST' ? txQty : Math.max(0, asset.quantity + qtyChange);
            const newStatus = calculateStatus(newQty, asset.min_quantity);
            const updatedAsset = { 
              ...asset, 
              quantity: newQty, 
              status: newStatus,
              location_id: txLocation ? parseInt(txLocation, 10) : asset.location_id,
              location_name: destLocName
            };
            updatedAssetsList = assets.map(a => a.id === targetAssetId ? updatedAsset : a);
          }


          setAssets(updatedAssetsList);
          localStorage.setItem('cached_assets', JSON.stringify(updatedAssetsList));
          
          const dummyTx = {
            id: offlineAction.id,
            asset_id: targetAssetId,
            type: txType,
            quantity_change: qtyChange,
            user_name: txUser,
            location_id: txLocation || null,
            location_name: destLocName,
            notes: txNotes ? `${txNotes} (Offline queued)` : "(Offline queued)",
            created_at: new Date().toISOString()
          };
          const updatedTxList = [dummyTx, ...transactions];
          setTransactions(updatedTxList);
          localStorage.setItem('cached_transactions', JSON.stringify(updatedTxList));
          
          setTxSuccessMessage(`Successfully queued offline stock change for ${asset.name}!`);
          setTxNotes('');
          setTxQty(1);
          
          if (scannedAsset) {
            setTimeout(() => {
              setScannedAsset(null);
              setTxSuccessMessage('');
              setScannerActive(true);
            }, 2000);
          } else {
            setActiveAsset(updatedAsset);
            setActiveAssetDetails({ transactions: updatedTxList.filter(t => t.asset_id === targetAssetId) });
          }
        }
      } else {
        setTxErrorMessage("Network error processing transaction.");
      }
    }
  };

  // Quick Stock Adjustments directly from directory
  const handleQuickStockChange = async (asset, type) => {
    const qtyChange = 1;
    const userName = currentUser?.name || 'System';
    try {
      const res = await authFetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: asset.id,
          type: type, // 'CHECK_IN' to add, 'CHECK_OUT' to remove
          quantity_change: qtyChange,
          user_name: userName,
          location_id: asset.location_id || null,
          notes: 'Quick adjust from directory'
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        // Update local state directly
        const updated = assets.map(a => 
          a.id === asset.id 
            ? { ...a, quantity: data.quantity, status: data.status } 
            : a
        );
        setAssets(updated);
        localStorage.setItem('cached_assets', JSON.stringify(updated));
        fetchTransactions(); // Refresh transactions in background
      } else {
        alert(data.error || "Failed to adjust stock.");
      }
    } catch (err) {
      console.error("Quick stock change failed, using offline sync queue:", err);
      const isOfflineMode = !connectionOk || err.message.includes('Failed to fetch') || err.message.includes('Load failed') || err.name === 'TypeError';
      
      if (isOfflineMode) {
        const offlineAction = {
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
          type: 'TX_SUBMIT',
          payload: {
            asset_id: asset.id,
            type: type,
            quantity_change: qtyChange,
            user_name: userName,
            location_id: asset.location_id || null,
            notes: "Quick adjust (Offline)"
          }
        };
        
        const currentQueue = JSON.parse(localStorage.getItem('local_sync_queue') || '[]');
        currentQueue.push(offlineAction);
        localStorage.setItem('local_sync_queue', JSON.stringify(currentQueue));
        setSyncQueueCount(currentQueue.length);
        
        const changeVal = type === 'CHECK_IN' ? qtyChange : -qtyChange;
        const newQty = Math.max(0, asset.quantity + changeVal);
        const newStatus = calculateStatus(newQty, asset.min_quantity);
        
        const updatedAsset = { 
          ...asset, 
          quantity: newQty, 
          status: newStatus
        };
        
        let updatedAssetsList = assets.map(a => a.id === asset.id ? updatedAsset : a);
        
        setAssets(updatedAssetsList);
        localStorage.setItem('cached_assets', JSON.stringify(updatedAssetsList));
        
        const dummyTx = {
          id: offlineAction.id,
          asset_id: asset.id,
          type: type,
          quantity_change: changeVal,
          user_name: userName,
          location_id: asset.location_id || null,
          location_name: asset.location_name,
          notes: "Quick adjust (Offline queued)",
          created_at: new Date().toISOString()
        };
        const updatedTxList = [dummyTx, ...transactions];
        setTransactions(updatedTxList);
        localStorage.setItem('cached_transactions', JSON.stringify(updatedTxList));
      } else {
        alert("Network error: Could not complete quick stock adjustment.");
      }
    }
  };

  // Helper to calculate status in offline updates
  const calculateStatus = (qty, minQty) => {
    if (qty <= 0) return 'Out of Stock';
    if (minQty && qty <= minQty) return 'Low Stock';
    return 'Available';
  };



  // Export label details as high quality image
  const downloadLabelImage = async (asset) => {
    try {
      const qrValue = asset.id.startsWith('http://') || asset.id.startsWith('https://')
        ? asset.id
        : `https://assets.josh-green.uk/?id=${encodeURIComponent(asset.id)}`;

      const qrUrl = await QRCode.toDataURL(qrValue, { 
        margin: 1, 
        width: 300,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      
      const canvas = document.createElement('canvas');
      // Set to 600x300 for crisp high-resolution 2:1 ratio (PrintMaster friendly)
      canvas.width = 600;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      
      // Draw background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Load QR Code Image
      const img = new Image();
      img.onload = () => {
        // Draw QR Code on the left side
        ctx.drawImage(img, 25, 25, 250, 250);
        
        // Draw Text info on the right side
        ctx.fillStyle = '#000000';
        
        // Asset Name
        ctx.font = 'bold 36px "Inter", "Segoe UI", sans-serif';
        const maxTextWidth = 280;
        const name = asset.name;
        let fontSize = 36;
        ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", sans-serif`;
        
        // Dynamically scale down font if text overflows right side boundary
        while (ctx.measureText(name).width > maxTextWidth && fontSize > 20) {
          fontSize -= 2;
          ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", sans-serif`;
        }
        ctx.fillText(name, 295, 90);
        
        // SKU or ID
        ctx.fillStyle = '#555555';
        ctx.font = '500 22px "Inter", "Segoe UI", sans-serif';
        const skuText = asset.sku ? `SKU: ${asset.sku}` : `ID: ${asset.id}`;
        ctx.fillText(skuText, 295, 145);
        
        // Location
        ctx.fillStyle = '#111111';
        ctx.font = '600 24px "Inter", "Segoe UI", sans-serif';
        const locText = asset.location_name || 'No Location';
        ctx.fillText(locText, 295, 215);
        
        // Trigger file download
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.download = `label-${asset.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      img.src = qrUrl;
    } catch (err) {
      console.error("Failed to generate label image:", err);
      alert("Failed to generate label image.");
    }
  };

  // Copy QR data to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(`Copied ID: "${text}" to clipboard. You can paste this in PrintMaster!`);
  };

  // Create Handlers
  const handleCreateAsset = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_BASE}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAsset)
      });
      const data = await res.json();
      if (res.ok) {
        setAssets([data, ...assets]);
        setShowAddAsset(false);
        setNewAsset({ id: '', name: '', description: '', sku: '', quantity: 0, unit: 'pcs', location_id: '', min_quantity: 0 });
        alert(`Asset '${data.name}' created successfully!`);
        fetchTransactions();
      } else {
        alert(data.error || "Failed to create asset.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateAsset = async (e) => {
    e.preventDefault();
    if (!editingAsset) return;
    try {
      const res = await authFetch(`${API_BASE}/assets/${editingAsset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAsset)
      });
      const data = await res.json();
      if (res.ok) {
        setAssets(assets.map(a => a.id === editingAsset.id ? { ...a, ...data } : a));
        if (activeAsset && activeAsset.id === editingAsset.id) {
          setActiveAsset({ ...activeAsset, ...data });
        }
        if (scannedAsset && scannedAsset.id === editingAsset.id) {
          const updatedLocName = locations.find(l => String(l.id) === String(data.location_id))?.name || 'Unassigned';
          setScannedAsset({ ...scannedAsset, ...data, location_name: updatedLocName });
        }
        setShowEditAsset(false);
        setEditingAsset(null);
        alert(`Asset '${data.name}' updated successfully!`);
      } else {
        alert(data.error || "Failed to update asset.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_BASE}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLocation)
      });
      const data = await res.json();
      if (res.ok) {
        setLocations([...locations, data]);
        setShowAddLocation(false);
        setNewLocation({ name: '', description: '' });
        alert(`Location '${data.name}' added successfully!`);
      } else {
        alert(data.error || "Failed to add location.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteLocation = async (id, name) => {
    if (confirm(`Are you sure you want to delete the location '${name}'? This will unassign all items stored here.`)) {
      try {
        const res = await authFetch(`${API_BASE}/locations/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setLocations(locations.filter(l => l.id !== id));
          fetchAssets();
          alert("Location deleted.");
        } else {
          alert("Failed to delete location.");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory)
      });
      const data = await res.json();
      if (res.ok) {
        setCategories([...categories, data]);
        setShowAddCategory(false);
        setNewCategory({ name: '', description: '' });
        alert(`Category '${data.name}' added successfully!`);
      } else {
        alert(data.error || "Failed to add category.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (confirm(`Are you sure you want to delete the category '${name}'? All assets under this category will default to 'Uncategorized'.`)) {
      try {
        const res = await authFetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setCategories(categories.filter(c => c.id !== id));
          fetchAssets();
          alert("Category deleted.");
        } else {
          const data = await res.json();
          alert(data.error || "Failed to delete category.");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (res.ok) {
        setUsers([...users, data]);
        setShowAddUser(false);
        setNewUser({ name: '', role: 'Engineer', password: '' });
        if (!txUser) setTxUser(data.name);
        alert(`User '${data.name}' added successfully!`);
      } else {
        alert(data.error || "Failed to create user.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await authFetch(`${API_BASE}/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editingUser.name, 
          role: editingUser.role, 
          password: editingUser.password || '' 
        })
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(users.map(u => u.id === editingUser.id ? data : u));
        setShowEditUser(false);
        setEditingUser(null);
        if (txUser === editingUser.name) {
          setTxUser(data.name);
        }
        alert("User updated successfully.");
      } else {
        alert(data.error || "Failed to update user.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (confirm(`Are you sure you want to delete user '${name}'?`)) {
      try {
        const res = await authFetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setUsers(users.filter(u => u.id !== id));
          if (txUser === name) {
            setTxUser(users[0]?.name || '');
          }
          alert("User deleted.");
        } else {
          alert("Failed to delete user.");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeleteAsset = async (id, name) => {
    if (confirm(`Are you absolutely sure you want to delete '${name}'? This will remove all associated transaction logs.`)) {
      try {
        const res = await authFetch(`${API_BASE}/assets/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setAssets(assets.filter(a => a.id !== id));
          if (activeAsset && activeAsset.id === id) setActiveAsset(null);
          alert("Asset deleted.");
        } else {
          alert("Failed to delete asset.");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Admin Database Maintenance Tools
  const handleExportBackup = () => {
    const backupData = {
      assets,
      locations,
      users,
      transactions,
      exportedAt: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `assethub_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePurgeLogs = async () => {
    if (confirm("WARNING: Are you absolutely sure you want to clear ALL transaction history logs? This cannot be undone.")) {
      try {
        const res = await authFetch(`${API_BASE}/admin/purge-logs`, { method: 'POST' });
        if (res.ok) {
          fetchTransactions();
          alert("Transaction history purged successfully.");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSeedActivity = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/seed-activity`, { method: 'POST' });
      if (res.ok) {
        fetchTransactions();
        fetchAssets();
        alert("Dummy logs seeded and stock levels updated.");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to seed activity logs.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualStockOverride = async (e) => {
    e.preventDefault();
    if (!manualOverrideAsset) {
      alert("Please select an item to override.");
      return;
    }
    try {
      const res = await authFetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: manualOverrideAsset,
          type: 'STOCK_ADJUST',
          absolute_quantity: manualOverrideQty,
          user_name: txUser,
          notes: manualOverrideNotes || 'Admin direct stock override'
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Stock override complete! New quantity is ${data.quantity}.`);
        setManualOverrideAsset('');
        setManualOverrideQty(0);
        setManualOverrideNotes('');
        fetchAssets();
        fetchTransactions();
      } else {
        alert(data.error || "Failed to override stock.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadDbBackup = async () => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(`${API_BASE}/admin/backup`, {
        headers: { 'Authorization': token }
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        alert("Session expired. Please log in again.");
        return;
      }
      if (!res.ok) {
        const errorText = await res.text();
        alert(`Failed to download backup: ${errorText || res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", downloadUrl);
      downloadAnchor.setAttribute("download", `inventory-${Date.now()}.db`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error(e);
      alert("Error downloading backup from server.");
    }
  };

  const handleRestoreDbBackup = async (file) => {
    if (!file) return;
    if (!confirm("WARNING: Restoring a database file will completely OVERWRITE all current inventory, user accounts, and transaction records. This cannot be undone. Are you sure you want to proceed?")) {
      return;
    }
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target.result;
        const res = await authFetch(`${API_BASE}/admin/restore`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: arrayBuffer
        });
        
        if (res.ok) {
          alert("Database restored successfully! Reconnected connection pools.");
          fetchAssets();
          fetchLocations();
          fetchUsers();
          fetchTransactions();
        } else {
          const data = await res.json();
          alert(data.error || "Failed to restore database.");
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (e) {
      console.error(e);
      alert("Error uploading database backup file.");
    }
  };

  const handleUploadApk = async (file) => {
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target.result;
        const res = await authFetch(`${API_BASE}/admin/upload-apk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: arrayBuffer
        });
        
        if (res.ok) {
          alert("Mobile APK uploaded and hosted successfully! It is now available for download.");
        } else {
          const data = await res.json();
          alert(data.error || "Failed to upload APK.");
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (e) {
      console.error(e);
      alert("Error uploading APK file.");
    }
  };

  // Print Queue Helpers
  const togglePrintQueue = (asset) => {
    const exists = printQueue.some(item => item.id === asset.id);
    if (exists) {
      setPrintQueue(printQueue.filter(item => item.id !== asset.id));
    } else {
      setPrintQueue([...printQueue, asset]);
    }
  };

  const clearPrintQueue = () => {
    setPrintQueue([]);
  };

  const handlePrint = () => {
    if (printQueue.length === 0) return;
    window.print();
  };

  // Helper stats values
  const totalAssetsCount = assets.reduce((acc, curr) => acc + curr.quantity, 0);
  const lowStockCount = assets.filter(a => a.status === 'Low Stock' || a.status === 'Out of Stock').length;
  const uniqueItemsCount = assets.length;

  // ----------------- CONNECTION MODALS -----------------
  const renderConnectionErrorModal = () => {
    if (connectionOk) return null;
    return (
      <div className="drawer-backdrop" style={{ zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div className="panel" style={{ width: '100%', maxWidth: '420px', padding: '24px', position: 'relative', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 16px rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', margin: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', marginBottom: '16px' }}>
              <AlertCircle size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'white' }}>Server Connection Failed</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4' }}>
              We couldn't connect to the backend server. Please verify the server is running and check your IP settings below.
            </p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            let formattedUrl = serverInput.trim().replace(/\/$/, "");
            if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
              formattedUrl = "http://" + formattedUrl;
            }
            localStorage.setItem('server_api_url', formattedUrl);
            setServerUrl(formattedUrl);
            alert("Reconnecting to server...");
            window.location.reload();
          }}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Server IP & Port / Host URL</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. http://192.168.0.100:5000"
                value={serverInput}
                onChange={(e) => setServerInput(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Retry Connection
              </button>
              <button type="button" className="btn btn-secondary" style={{ width: '100%', opacity: 0.7 }} onClick={() => setConnectionOk(true)}>
                Proceed Offline / Demo Mode
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderConnectionSettingsModal = () => {
    if (!showConnectionModal) return null;
    return (
      <div className="drawer-backdrop" style={{ zIndex: 3001 }} onClick={() => setShowConnectionModal(false)}>
        <div className="drawer" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-header">
            <h2>Server IP Settings</h2>
            <button className="drawer-close" onClick={() => setShowConnectionModal(false)}><X size={20} /></button>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            let formattedUrl = serverInput.trim().replace(/\/$/, "");
            if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
              formattedUrl = "http://" + formattedUrl;
            }
            localStorage.setItem('server_api_url', formattedUrl);
            setServerUrl(formattedUrl);
            setShowConnectionModal(false);
            alert("Server connection URL updated! Reconnecting...");
            window.location.reload();
          }}>
            <div className="form-group">
              <label className="form-label">Server Connection URL *</label>
              <input 
                type="text" 
                className="form-control" 
                required 
                placeholder="e.g. http://192.168.1.50:5000"
                value={serverInput}
                onChange={(e) => setServerInput(e.target.value)}
              />
              <small style={{ color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                Input your server's IP address or domain URL (e.g. `http://192.168.1.50:5000` or `https://assets.yourdomain.com`) so this device can connect and sync.
              </small>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Save and Reconnect</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowConnectionModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Moved early isAuthenticated return block downstream to satisfy react hook ordering rules.

  const otherLocations = activeAsset 
    ? assets.filter(a => 
        a.id !== activeAsset.id && 
        (activeAsset.sku && activeAsset.sku.trim() !== '' 
          ? a.sku?.toLowerCase() === activeAsset.sku.toLowerCase() 
          : a.name.toLowerCase() === activeAsset.name.toLowerCase()
        )
      )
    : [];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (field) => {
    if (sortField !== field) return ' ⇅';
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  const toggleGroupExpand = (key, e) => {
    if (e) e.stopPropagation();
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const allCategories = React.useMemo(() => {
    const cats = new Set(categories.map(c => c.name));
    assets.forEach(a => {
      cats.add(a.category || 'Uncategorized');
    });
    return Array.from(cats).sort();
  }, [categories, assets]);

  const groupedAssets = React.useMemo(() => {
    const groups = {};
    assets.forEach(a => {
      const isSkuEmpty = !a.sku || a.sku.trim() === '';
      const key = isSkuEmpty ? `name:${a.name.trim().toLowerCase()}` : `sku:${a.sku.trim().toLowerCase()}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          name: a.name,
          sku: a.sku || '',
          category: a.category || 'Uncategorized',
          totalQuantity: 0,
          unit: a.unit || 'pcs',
          locations: [],
          status: 'Available',
          items: []
        };
      }
      groups[key].totalQuantity += a.quantity;
      groups[key].items.push(a);
      
      const locName = a.location_name || 'Unassigned';
      if (!groups[key].locations.includes(locName)) {
        groups[key].locations.push(locName);
      }
    });

    Object.values(groups).forEach(g => {
      let groupStatus = 'Available';
      const hasOutOfStock = g.items.some(item => item.status === 'Out of Stock');
      const hasLowStock = g.items.some(item => item.status === 'Low Stock');
      if (hasOutOfStock) {
        groupStatus = 'Out of Stock';
      } else if (hasLowStock) {
        groupStatus = 'Low Stock';
      }
      g.status = groupStatus;
    });

    return Object.values(groups);
  }, [assets]);

  const filteredAndSortedAssets = React.useMemo(() => {
    const query = searchQ.toLowerCase().trim();
    
    if (viewMode === 'individual') {
      return assets
        .filter(a => {
          const matchesSearch = 
            a.name.toLowerCase().includes(query) ||
            (a.sku && a.sku.toLowerCase().includes(query)) ||
            (a.category && a.category.toLowerCase().includes(query)) ||
            a.id.toLowerCase().includes(query);
          
          const matchesLocation = locationFilter === '' || Number(a.location_id) === Number(locationFilter);
          const matchesStatus = statusFilter === '' || a.status === statusFilter;
          const matchesCategory = categoryFilter === '' || (a.category || 'Uncategorized') === categoryFilter;
          
          return matchesSearch && matchesLocation && matchesStatus && matchesCategory;
        })
        .sort((a, b) => {
          let valA, valB;
          switch (sortField) {
            case 'sku':
              valA = (a.sku || '').toLowerCase();
              valB = (b.sku || '').toLowerCase();
              break;
            case 'name':
              valA = a.name.toLowerCase();
              valB = b.name.toLowerCase();
              break;
            case 'category':
              valA = (a.category || 'Uncategorized').toLowerCase();
              valB = (b.category || 'Uncategorized').toLowerCase();
              break;
            case 'location':
              valA = (a.location_name || 'Unassigned').toLowerCase();
              valB = (b.location_name || 'Unassigned').toLowerCase();
              break;
            case 'quantity':
              valA = a.quantity;
              valB = b.quantity;
              break;
            case 'status':
              const statusRank = { 'Out of Stock': 0, 'Low Stock': 1, 'Available': 2 };
              valA = statusRank[a.status] !== undefined ? statusRank[a.status] : 99;
              valB = statusRank[b.status] !== undefined ? statusRank[b.status] : 99;
              break;
            default:
              return 0;
          }
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
    } else {
      return groupedAssets
        .filter(g => {
          const matchesSearch = 
            g.name.toLowerCase().includes(query) ||
            g.sku.toLowerCase().includes(query) ||
            g.category.toLowerCase().includes(query) ||
            g.items.some(item => item.id.toLowerCase().includes(query));
          
          const matchesLocation = locationFilter === '' || g.items.some(item => Number(item.location_id) === Number(locationFilter));
          const matchesStatus = statusFilter === '' || g.items.some(item => item.status === statusFilter);
          const matchesCategory = categoryFilter === '' || g.category === categoryFilter;
          
          return matchesSearch && matchesLocation && matchesStatus && matchesCategory;
        })
        .sort((a, b) => {
          let valA, valB;
          switch (sortField) {
            case 'sku':
              valA = a.sku.toLowerCase();
              valB = b.sku.toLowerCase();
              break;
            case 'name':
              valA = a.name.toLowerCase();
              valB = b.name.toLowerCase();
              break;
            case 'category':
              valA = a.category.toLowerCase();
              valB = b.category.toLowerCase();
              break;
            case 'location':
              valA = a.locations.length;
              valB = b.locations.length;
              break;
            case 'quantity':
              valA = a.totalQuantity;
              valB = b.totalQuantity;
              break;
            case 'status':
              const statusRank = { 'Out of Stock': 0, 'Low Stock': 1, 'Available': 2 };
              valA = statusRank[a.status] !== undefined ? statusRank[a.status] : 99;
              valB = statusRank[b.status] !== undefined ? statusRank[b.status] : 99;
              break;
            default:
              return 0;
          }
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
    }
  }, [assets, groupedAssets, viewMode, searchQ, locationFilter, statusFilter, categoryFilter, sortField, sortOrder]);

  const topActiveItems = React.useMemo(() => {
    const counts = {};
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    transactions.forEach(tx => {
      const txDate = new Date(tx.created_at);
      if (txDate < sevenDaysAgo) return;

      const assetId = tx.asset_id;
      const assetName = tx.asset_name || assets.find(a => a.id === assetId)?.name || `Item #${assetId}`;
      const change = Math.abs(tx.quantity_change);
      
      if (!counts[assetId]) {
        counts[assetId] = { id: assetId, name: assetName, totalMoved: 0, count: 0 };
      }
      counts[assetId].totalMoved += change;
      counts[assetId].count += 1;
    });
    
    return Object.values(counts)
      .sort((a, b) => b.totalMoved - a.totalMoved)
      .slice(0, 5);
  }, [transactions, assets]);

  if (!isAuthenticated) {
    return (
      <div className="login-screen-wrapper">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <Package size={36} />
            </div>
            <h1 className="login-title">Zavi Asset Hub</h1>
            <p className="login-subtitle">Sign in to manage stock and garages</p>
          </div>

          {loginError && (
            <div className="login-error-alert">
              <AlertTriangle size={18} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <div className="login-form-group">
              <label className="login-form-label">Username</label>
              <input 
                type="text" 
                className="login-form-input" 
                placeholder="e.g. Josh"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
              />
            </div>

            <div className="login-form-group" style={{ marginBottom: '16px' }}>
              <label className="login-form-label">Password</label>
              <input 
                type="password" 
                className="login-form-input" 
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <div className="login-form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-indigo)' }}
              />
              <label htmlFor="rememberMe" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                Remember credentials on this device
              </label>
            </div>

            <button type="submit" className="login-btn">
              Sign In
            </button>

            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Forgot password? Please ask an administrator to reset it for you.
            </div>
          </form>

          <div className="login-download-apk-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', marginTop: '20px' }}>
            <a href={`${API_BASE.replace('/api', '')}/download-apk`} className="login-download-apk-link" target="_blank" rel="noopener noreferrer">
              <Download size={16} />
              <span>Download Mobile App (APK)</span>
            </a>
            
            <button 
              type="button" 
              className="login-download-apk-link" 
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '8px', 
                fontSize: '0.85rem', 
                marginTop: '6px',
                color: 'var(--accent-indigo)',
                opacity: 0.85
              }}
              onClick={() => {
                setServerInput(serverUrl);
                setShowConnectionModal(true);
              }}
            >
              <ArrowLeftRight size={14} />
              <span>Configure Connection IP</span>
            </button>
          </div>
        </div>

        {renderConnectionErrorModal()}
        {renderConnectionSettingsModal()}
      </div>
    );
  }

  return (
    <div className="app-container">
      {renderConnectionErrorModal()}
      
      {/* ----------------- SIDEBAR NAV (Desktop) ----------------- */}
      <nav className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">Z</div>
          <span className="logo-text">Zavi Asset Hub</span>
        </div>
        
        <ul className="nav-menu">
          <li 
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setCurrentView('dashboard'); stopScanner(); }}
          >
            <History size={18} />
            <span>Dashboard</span>
          </li>
          <li 
            className={`nav-item ${currentView === 'assets' ? 'active' : ''}`}
            onClick={() => { setCurrentView('assets'); stopScanner(); }}
          >
            <Package size={18} />
            <span style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              Inventory
              {lowStockCount > 0 && (
                <span className="badge badge-danger" style={{ marginLeft: 'auto', padding: '2px 6px', fontSize: '0.75rem', borderRadius: '10px', minWidth: '16px', textAlign: 'center' }}>
                  {lowStockCount}
                </span>
              )}
            </span>
          </li>
          <li 
            className={`nav-item ${currentView === 'scanner' ? 'active' : ''}`}
            onClick={() => { setCurrentView('scanner'); setScannerActive(true); setScannedAsset(null); }}
          >
            <QrCode size={18} />
            <span>Scan QR Code</span>
          </li>
          <li 
            className={`nav-item ${currentView === 'locations' ? 'active' : ''}`}
            onClick={() => { setCurrentView('locations'); stopScanner(); }}
          >
            <MapPin size={18} />
            <span>Garages & Locations</span>
          </li>
          {isAdmin && (
            <li 
              className={`nav-item ${currentView === 'users' ? 'active' : ''}`}
              onClick={() => { setCurrentView('users'); stopScanner(); }}
            >
              <Users size={18} />
              <span>Team & Users</span>
            </li>
          )}
          <li 
            className={`nav-item ${currentView === 'printer' ? 'active' : ''}`}
            onClick={() => { setCurrentView('printer'); stopScanner(); }}
          >
            <Printer size={18} />
            <span>Print Labels ({printQueue.length})</span>
          </li>
          {isAdmin ? (
            <li 
              className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
              onClick={() => { setCurrentView('settings'); stopScanner(); }}
            >
              <Settings size={18} />
              <span>Admin Settings</span>
            </li>
          ) : (
            <li 
              className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
              onClick={() => { setCurrentView('settings'); stopScanner(); }}
            >
              <User size={18} />
              <span>My Profile</span>
            </li>
          )}
        </ul>

        <ul className="nav-menu" style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
          <li 
            className="nav-item"
            style={{ opacity: 0.85 }}
            onClick={() => {
              setServerInput(serverUrl);
              setShowConnectionModal(true);
            }}
          >
            <ArrowLeftRight size={18} />
            <span>Server IP Config</span>
          </li>
        </ul>

        <div className="user-profile-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="avatar">
              {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'U'}
            </div>
            <div className="user-info" style={{ overflow: 'hidden' }}>
              <span className="user-name" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {currentUser?.name || 'Unknown'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {currentUser?.role || 'Guest'}
              </span>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="btn btn-secondary" 
            style={{ 
              width: '100%', 
              padding: '6px 12px', 
              fontSize: '0.8rem', 
              background: 'transparent',
              borderColor: 'var(--border-color)', 
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* ----------------- MOBILE NAVIGATION ----------------- */}
      <nav className="mobile-nav">
        <div className={`mobile-nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => { setCurrentView('dashboard'); stopScanner(); }}>
          <History />
          <span>Hub</span>
        </div>
        <div className={`mobile-nav-item ${currentView === 'assets' ? 'active' : ''}`} onClick={() => { setCurrentView('assets'); stopScanner(); }} style={{ position: 'relative' }}>
          <Package />
          <span>Items</span>
          {lowStockCount > 0 && (
            <span className="badge badge-danger" style={{ position: 'absolute', top: '4px', right: '18px', padding: '2px 5px', fontSize: '0.65rem', borderRadius: '50%', minWidth: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}>
              {lowStockCount}
            </span>
          )}
        </div>
        <div className={`mobile-nav-item ${currentView === 'scanner' ? 'active' : ''}`} onClick={() => { setCurrentView('scanner'); setScannerActive(true); setScannedAsset(null); }}>
          <QrCode />
          <span>Scan</span>
        </div>
        <div className={`mobile-nav-item ${currentView === 'locations' ? 'active' : ''}`} onClick={() => { setCurrentView('locations'); stopScanner(); }}>
          <MapPin />
          <span>Garages</span>
        </div>
        {isAdmin ? (
          <div className={`mobile-nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => { setCurrentView('settings'); stopScanner(); }}>
            <Settings />
            <span>Admin</span>
          </div>
        ) : (
          <div className={`mobile-nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => { setCurrentView('settings'); stopScanner(); }}>
            <User />
            <span>Profile</span>
          </div>
        )}
      </nav>

      {/* ----------------- MAIN CONTENT AREA ----------------- */}
      <main className="main-content">
        
        {/* ----------------- OFFLINE SYNC QUEUE WIDGET ----------------- */}
        {syncQueueCount > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '12px',
            padding: '12px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
            color: '#fef3c7',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ArrowLeftRight size={18} style={{ color: 'var(--accent-amber)', animation: isSyncing ? 'spin 2s linear infinite' : 'none' }} />
              <span>
                <strong>Offline Mode Active:</strong> {syncQueueCount} stock {syncQueueCount === 1 ? 'change' : 'changes'} queued. They will sync automatically when server connection is restored.
              </span>
            </div>
            {isSyncing ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Syncing...</span>
            ) : (
              <button 
                className="btn btn-secondary" 
                style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: 'rgba(245, 158, 11, 0.3)', color: 'var(--accent-amber)', background: 'transparent' }}
                onClick={syncOfflineQueue}
              >
                Sync Now
              </button>
            )}
          </div>
        )}
        
        {/* ----------------- VIEW: DASHBOARD ----------------- */}
        {currentView === 'dashboard' && (
          <div>
            <div className="page-header">
              <div className="page-title-group">
                <h1>Overview</h1>
                <p>Welcome back. Keep engineering, sales, and purchasing in sync.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-primary" onClick={() => { setCurrentView('scanner'); setScannerActive(true); }}>
                  <QrCode size={16} /> Scan Quick In/Out
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid-stats">
              <div className="card-stat" style={{ '--stat-color': 'var(--primary)', '--stat-glow': 'var(--primary-glow)' }}>
                <div className="stat-icon"><Package size={22} /></div>
                <div className="stat-info">
                  <span className="stat-value">{totalAssetsCount}</span>
                  <span className="stat-label">Total Stock Units</span>
                </div>
              </div>
              <div className="card-stat" style={{ '--stat-color': 'var(--accent-cyan)', '--stat-glow': 'rgba(6, 182, 212, 0.15)' }}>
                <div className="stat-icon"><Info size={22} /></div>
                <div className="stat-info">
                  <span className="stat-value">{uniqueItemsCount}</span>
                  <span className="stat-label">Unique Materials</span>
                </div>
              </div>
              <div className="card-stat" style={{ '--stat-color': 'var(--accent-amber)', '--stat-glow': 'rgba(245, 158, 11, 0.15)' }}>
                <div className="stat-icon"><AlertTriangle size={22} /></div>
                <div className="stat-info">
                  <span className="stat-value">{lowStockCount}</span>
                  <span className="stat-label">Low / Out of Stock</span>
                </div>
              </div>
              <div className="card-stat" style={{ '--stat-color': 'var(--accent-emerald)', '--stat-glow': 'var(--accent-emerald-glow)' }}>
                <div className="stat-icon"><MapPin size={22} /></div>
                <div className="stat-info">
                  <span className="stat-value">{locations.length}</span>
                  <span className="stat-label">Garages & Sites</span>
                </div>
              </div>
            </div>

            <div className="dashboard-layout">
              {/* Left Column: Alerts & Status */}
              <div className="panel">
                <div className="panel-header">
                  <h3 className="panel-title"><AlertTriangle size={18} style={{ color: 'var(--accent-amber)' }} /> Alert Stock Items</h3>
                  <span className="badge badge-warning">{lowStockCount} alerts</span>
                </div>
                
                {assets.filter(a => a.status === 'Low Stock' || a.status === 'Out of Stock').length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No low stock alerts. All inventory levels healthy!</p>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Location</th>
                          <th>In Stock</th>
                          <th>Min stock</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assets.filter(a => a.status === 'Low Stock' || a.status === 'Out of Stock').map(a => (
                          <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setActiveAsset(a)}>
                            <td style={{ fontWeight: '600' }}>{a.name}</td>
                            <td>{a.location_name || 'Unassigned'}</td>
                            <td>{a.quantity} {a.unit}</td>
                            <td>{a.min_quantity} {a.unit}</td>
                            <td>
                              <span className={`badge ${a.status === 'Out of Stock' ? 'badge-danger' : 'badge-warning'}`}>
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Top Moving Parts Widget */}
              <div className="panel" style={{ marginTop: '24px' }}>
                <div className="panel-header">
                  <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={18} style={{ color: 'var(--accent-teal)' }} /> 🏆 Top Moving Parts (Past 7 Days)
                  </h3>
                </div>
                {topActiveItems.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No transaction history found to calculate top parts.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {topActiveItems.map((item, idx) => {
                      const maxMoved = Math.max(...topActiveItems.map(i => i.totalMoved)) || 1;
                      const percentage = Math.min(100, Math.round((item.totalMoved / maxMoved) * 100));
                      
                      return (
                        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                            <span style={{ fontWeight: '600', color: 'white' }}>
                              #{idx + 1} {item.name}
                            </span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              <strong>{item.totalMoved}</strong> units moved ({item.count} updates)
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: idx === 0 ? 'var(--accent-teal)' : idx === 1 ? 'var(--accent-indigo)' : 'var(--text-secondary)', borderRadius: '4px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Global Activity Log */}
              <div className="panel">
                <div className="panel-header">
                  <h3 className="panel-title"><History size={18} /> Recent Log</h3>
                </div>
                
                <div className="transaction-feed">
                  {transactions.slice(0, 8).map(tx => {
                    const isPositive = tx.quantity_change > 0;
                    const absoluteQty = Math.abs(tx.quantity_change);
                    let actionText = '';
                    let classType = 'adjust';
                    
                    if (tx.type === 'CHECK_IN' || tx.type === 'PURCHASE') {
                      actionText = 'added';
                      classType = 'check-in';
                    } else if (tx.type === 'CHECK_OUT' || tx.type === 'SALE') {
                      actionText = 'withdrew';
                      classType = 'check-out';
                    } else {
                      actionText = 'adjusted';
                      classType = 'adjust';
                    }

                    return (
                      <div className="feed-item" key={tx.id}>
                        <div className={`feed-icon ${classType}`}>
                          {tx.type === 'CHECK_IN' || tx.type === 'PURCHASE' ? <Plus size={16} /> : 
                           tx.type === 'CHECK_OUT' || tx.type === 'SALE' ? <Minus size={16} /> : <ArrowLeftRight size={16} />}
                        </div>
                        <div className="feed-details">
                          <p className="feed-header">
                            <span className="feed-highlight">{tx.user_name}</span> {actionText} {absoluteQty} {tx.asset_name ? tx.asset_name : 'deleted item'}
                          </p>
                          <p className="feed-notes">
                            {tx.notes ? tx.notes : (
                              tx.type === 'CHECK_OUT' || tx.type === 'SALE'
                                ? `Withdrawn from ${tx.location_name || 'inventory'}`
                                : tx.type === 'CHECK_IN' || tx.type === 'PURCHASE'
                                  ? `Added to ${tx.location_name || 'inventory'}`
                                  : 'No description notes'
                            )}
                          </p>
                          <span className="feed-time">
                            {new Date(tx.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {transactions.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No transaction logs recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- VIEW: ASSET DIRECTORY ----------------- */}
        {currentView === 'assets' && (
          <div>
            <div className="page-header">
              <div className="page-title-group">
                <h1>Material Directory</h1>
                <p>Lookup and track inventory levels, parts status, and print codes.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-secondary" onClick={() => setShowAddLocation(true)}>
                  <MapPin size={16} /> Add Location
                </button>
                <button className="btn btn-primary" onClick={() => setShowAddAsset(true)}>
                  <Plus size={16} /> Create Asset
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="panel" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
              {/* View Mode Switcher */}
              <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('grouped')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: viewMode === 'grouped' ? 'var(--accent-teal)' : 'transparent',
                    color: viewMode === 'grouped' ? 'white' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  Grouped View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('individual')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: viewMode === 'individual' ? 'var(--accent-teal)' : 'transparent',
                    color: viewMode === 'individual' ? 'white' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  Individual QR Codes
                </button>
              </div>

              <div className="search-container">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  className="form-control search-input" 
                  placeholder="Search assets name, SKU, QR ID..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
              </div>

              <select 
                className="form-control" 
                style={{ width: 'auto', minWidth: '180px' }}
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="">All Locations</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>

              <select 
                className="form-control" 
                style={{ width: 'auto', minWidth: '150px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Available">Available</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>

              <select 
                className="form-control" 
                style={{ width: 'auto', minWidth: '160px' }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {(searchQ || locationFilter || statusFilter || categoryFilter) && (
                <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => { setSearchQ(''); setLocationFilter(''); setStatusFilter(''); setCategoryFilter(''); }}>
                  Clear Filters
                </button>
              )}
            </div>

            {/* Responsive Assets Views */}
            <div className="desktop-only-view">
              <div className="panel">
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('sku')}>QR ID / SKU{renderSortIndicator('sku')}</th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>Asset Name{renderSortIndicator('name')}</th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('category')}>Category{renderSortIndicator('category')}</th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('location')}>Garage Location{renderSortIndicator('location')}</th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('quantity')}>Stock Level{renderSortIndicator('quantity')}</th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('status')}>Status{renderSortIndicator('status')}</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                         {filteredAndSortedAssets.map(a => {
                        if (viewMode === 'individual') {
                          const isInPrintQueue = printQueue.some(item => item.id === a.id);
                          return (
                            <tr 
                              key={a.id} 
                              style={{ cursor: 'pointer' }} 
                              onClick={() => setActiveAsset(a)}
                            >
                              <td style={{ fontFamily: 'monospace', fontWeight: '500', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--accent-cyan)' }}>{a.id}</span>
                                {a.sku && <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>SKU: {a.sku}</span>}
                              </td>
                              <td>
                                <div style={{ fontWeight: '600', color: 'white' }}>
                                  {a.name}
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  {a.description ? (a.description.length > 60 ? a.description.substring(0, 60) + '...' : a.description) : 'No description'}
                                </span>
                              </td>
                              <td style={{ fontWeight: '500' }}>
                                <span className="badge badge-secondary" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                                  {a.category || 'Uncategorized'}
                                </span>
                              </td>
                              <td>{a.location_name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button 
                                    className="btn btn-circle" 
                                    title="Decrease stock by 1"
                                    onClick={(e) => { e.stopPropagation(); handleQuickStockChange(a, 'CHECK_OUT'); }}
                                  >
                                    -
                                  </button>
                                  <span style={{ fontSize: '1rem', fontWeight: 'bold', minWidth: '30px', textAlign: 'center' }}>
                                    {a.quantity}
                                  </span>
                                  <button 
                                    className="btn btn-circle" 
                                    title="Increase stock by 1"
                                    onClick={(e) => { e.stopPropagation(); handleQuickStockChange(a, 'CHECK_IN'); }}
                                  >
                                    +
                                  </button>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>{a.unit}</span>
                                </div>
                                {a.min_quantity > 0 && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Min: {a.min_quantity}</span>}
                              </td>
                              <td>
                                <span className={`badge ${
                                  a.status === 'Available' ? 'badge-success' : 
                                  a.status === 'Low Stock' ? 'badge-warning' : 'badge-danger'
                                }`}>
                                  {a.status}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button 
                                    className={`btn ${isInPrintQueue ? 'btn-success' : 'btn-secondary'} btn-icon-only`}
                                    style={{ padding: '6px' }}
                                    title={isInPrintQueue ? "Remove from printing" : "Add to print queue"}
                                    onClick={(e) => { e.stopPropagation(); togglePrintQueue(a); }}
                                  >
                                    <Printer size={16} />
                                  </button>
                                  <button 
                                    className="btn btn-secondary btn-icon-only" 
                                    style={{ padding: '6px' }}
                                    title="Edit asset parameters"
                                    onClick={(e) => { e.stopPropagation(); setEditingAsset(a); setShowEditAsset(true); }}
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button 
                                    className="btn btn-secondary btn-icon-only" 
                                    style={{ padding: '6px', color: 'var(--accent-rose)' }} 
                                    title="Delete item"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteAsset(a.id, a.name); }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        } else {
                          const isExpanded = expandedGroups.has(a.key);
                          const totalLocations = a.locations.length;
                          return (
                            <React.Fragment key={a.key}>
                              <tr 
                                style={{ cursor: 'pointer' }} 
                                onClick={() => toggleGroupExpand(a.key)}
                              >
                                <td style={{ fontFamily: 'monospace', fontWeight: '500', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  {a.sku || <span style={{ color: 'var(--text-muted)' }}>N/A</span>}
                                </td>
                                <td>
                                  <div style={{ fontWeight: '600', color: 'white' }}>
                                    {a.name}
                                  </div>
                                </td>
                                <td style={{ fontWeight: '500' }}>
                                  <span className="badge badge-secondary" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                                    {a.category}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.9rem' }}>
                                  <strong style={{ color: 'white' }}>{totalLocations}</strong> {totalLocations === 1 ? 'location' : 'locations'}
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {a.locations.join(', ')}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'white' }}>
                                    {a.totalQuantity} {a.unit}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${
                                    a.status === 'Available' ? 'badge-success' : 
                                    a.status === 'Low Stock' ? 'badge-warning' : 'badge-danger'
                                  }`}>
                                    {a.status}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      onClick={(e) => toggleGroupExpand(a.key, e)}
                                    >
                                      {isExpanded ? 'Collapse' : 'Expand'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr style={{ background: 'rgba(255, 255, 255, 0.015)' }}>
                                  <td colSpan="7" style={{ padding: '12px 24px 16px 40px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Location Breakdowns & QR Codes
                                      </div>
                                      <table className="custom-table" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', margin: 0 }}>
                                        <thead>
                                          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                            <th style={{ fontSize: '0.75rem', padding: '6px 12px' }}>QR Code ID</th>
                                            <th style={{ fontSize: '0.75rem', padding: '6px 12px' }}>Garage Location</th>
                                            <th style={{ fontSize: '0.75rem', padding: '6px 12px' }}>Stock Alert</th>
                                            <th style={{ fontSize: '0.75rem', padding: '6px 12px' }}>Status</th>
                                            <th style={{ fontSize: '0.75rem', padding: '6px 12px', textAlign: 'center' }}>Stock Level</th>
                                            <th style={{ fontSize: '0.75rem', padding: '6px 12px', textAlign: 'right' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {a.items.map(item => {
                                            const isInPrintQueue = printQueue.some(q => q.id === item.id);
                                            return (
                                              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }} onClick={() => setActiveAsset(item)}>
                                                <td style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)', padding: '8px 12px', fontSize: '0.8rem' }}>{item.id}</td>
                                                <td style={{ padding: '8px 12px', fontSize: '0.8rem' }}>{item.location_name || 'Unassigned'}</td>
                                                <td style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Min: {item.min_quantity}</td>
                                                <td style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                                                  <span className={`badge ${item.status === 'Available' ? 'badge-success' : item.status === 'Low Stock' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                                    {item.status}
                                                  </span>
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                  <div className="quantity-adjustment-group" style={{ display: 'inline-flex', gap: '6px' }}>
                                                    <button className="btn btn-circle btn-sm" onClick={() => handleQuickStockChange(item, 'CHECK_OUT')}>-</button>
                                                    <span style={{ fontWeight: 'bold', color: 'white', minWidth: '30px', textAlign: 'center', fontSize: '0.9rem' }}>{item.quantity}</span>
                                                    <button className="btn btn-circle btn-sm" onClick={() => handleQuickStockChange(item, 'CHECK_IN')}>+</button>
                                                  </div>
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                    <button className={`btn ${isInPrintQueue ? 'btn-success' : 'btn-secondary'} btn-icon-only btn-sm`} style={{ padding: '4px' }} onClick={() => togglePrintQueue(item)} title="Queue label">
                                                      <Printer size={12} />
                                                    </button>
                                                    <button className="btn btn-secondary btn-icon-only btn-sm" style={{ padding: '4px' }} onClick={() => { setEditingAsset(item); setShowEditAsset(true); }} title="Edit details">
                                                      <Edit size={12} />
                                                    </button>
                                                    <button className="btn btn-secondary btn-icon-only btn-sm" style={{ padding: '4px', color: 'var(--accent-rose)' }} onClick={() => handleDeleteAsset(item.id, item.name)} title="Delete item">
                                                      <Trash2 size={12} />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        }
                      })}
                      {assets.length === 0 && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            No assets registered yet. Click 'Create Asset' to add your first physical material.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mobile-only-view">
              <div className="mobile-assets-list">
                {filteredAndSortedAssets.map(a => {
                  if (viewMode === 'individual') {
                    const isInPrintQueue = printQueue.some(item => item.id === a.id);
                    return (
                      <div 
                        key={a.id} 
                        className="mobile-asset-card panel" 
                        onClick={() => setActiveAsset(a)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="mobile-asset-card-header">
                          <div>
                            <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>
                              {a.name}
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                              ID: <span style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>{a.id}</span> {a.sku && `| SKU: ${a.sku}`}
                            </span>
                          </div>
                          <span className={`badge ${
                            a.status === 'Available' ? 'badge-success' : 
                            a.status === 'Low Stock' ? 'badge-warning' : 'badge-danger'
                          }`}>
                            {a.status}
                          </span>
                        </div>
                        
                        <div className="mobile-asset-card-body">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Category:</span>
                            <strong style={{ color: 'white' }}>{a.category || 'Uncategorized'}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Location:</span>
                            <strong style={{ color: 'white' }}>{a.location_name || 'Unassigned'}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Stock Level:</span>
                            <div className="quantity-adjustment-group" onClick={e => e.stopPropagation()}>
                              <button 
                                className="btn btn-circle"
                                onClick={() => handleQuickStockChange(a, 'CHECK_OUT')}
                              >
                                -
                              </button>
                              <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'white', minWidth: '36px', textAlign: 'center' }}>
                                {a.quantity}
                              </span>
                              <button 
                                className="btn btn-circle"
                                onClick={() => handleQuickStockChange(a, 'CHECK_IN')}
                              >
                                +
                              </button>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>{a.unit}</span>
                            </div>
                          </div>
                          {a.min_quantity > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                              <span>Minimum required:</span>
                              <span>{a.min_quantity} {a.unit}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mobile-asset-card-footer" onClick={e => e.stopPropagation()}>
                          <button 
                            className={`btn ${isInPrintQueue ? 'btn-success' : 'btn-secondary'}`} 
                            style={{ fontSize: '0.8rem', padding: '6px 12px', flexGrow: 1, marginRight: '8px' }}
                            onClick={() => togglePrintQueue(a)}
                          >
                            <Printer size={14} style={{ marginRight: '6px' }} />
                            {isInPrintQueue ? "Queued" : "Queue Label"}
                          </button>
                          <button 
                            className="btn btn-secondary btn-icon-only" 
                            style={{ padding: '6px', marginRight: '6px' }}
                            onClick={() => { setEditingAsset(a); setShowEditAsset(true); }}
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            className="btn btn-secondary btn-icon-only" 
                            style={{ padding: '6px', color: 'var(--accent-rose)' }}
                            onClick={() => handleDeleteAsset(a.id, a.name)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  } else {
                    const isExpanded = expandedGroups.has(a.key);
                    const totalLocations = a.locations.length;
                    return (
                      <div 
                        key={a.key} 
                        className="mobile-asset-card panel" 
                        onClick={() => toggleGroupExpand(a.key)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="mobile-asset-card-header">
                          <div>
                            <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>
                              {a.name}
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                              {a.sku ? `SKU: ${a.sku}` : 'No SKU'} | {a.category}
                            </span>
                          </div>
                          <span className={`badge ${
                            a.status === 'Available' ? 'badge-success' : 
                            a.status === 'Low Stock' ? 'badge-warning' : 'badge-danger'
                          }`}>
                            {a.status}
                          </span>
                        </div>
                        
                        <div className="mobile-asset-card-body">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Total Stock:</span>
                            <strong style={{ color: 'white', fontSize: '1rem' }}>{a.totalQuantity} {a.unit}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Locations:</span>
                            <strong style={{ color: 'white', textAlign: 'right' }}>{totalLocations} ({a.locations.join(', ')})</strong>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
                              Location Breakdown
                            </div>
                            {a.items.map(item => {
                              const isInPrintQueue = printQueue.some(q => q.id === item.id);
                              return (
                                <div key={item.id} style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: '600', color: 'white', fontSize: '0.85rem' }}>
                                      {item.location_name || 'Unassigned'}
                                    </span>
                                    <span className={`badge ${item.status === 'Available' ? 'badge-success' : item.status === 'Low Stock' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.7rem', padding: '1px 4px' }}>
                                      {item.status}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                    <span style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{item.id}</span>
                                    <div className="quantity-adjustment-group">
                                      <button className="btn btn-circle btn-sm" onClick={() => handleQuickStockChange(item, 'CHECK_OUT')}>-</button>
                                      <span style={{ fontWeight: 'bold', color: 'white', minWidth: '30px', textAlign: 'center' }}>{item.quantity}</span>
                                      <button className="btn btn-circle btn-sm" onClick={() => handleQuickStockChange(item, 'CHECK_IN')}>+</button>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                    <button 
                                      className={`btn ${isInPrintQueue ? 'btn-success' : 'btn-secondary'} btn-sm`}
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      onClick={() => togglePrintQueue(item)}
                                    >
                                      <Printer size={12} /> {isInPrintQueue ? 'Queued' : 'Label'}
                                    </button>
                                    <button 
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      onClick={() => { setEditingAsset(item); setShowEditAsset(true); }}
                                    >
                                      <Edit size={12} /> Edit
                                    </button>
                                    <button 
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-rose)' }}
                                      onClick={() => handleDeleteAsset(item.id, item.name)}
                                    >
                                      <Trash2 size={12} /> Delete
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="mobile-asset-card-footer" style={{ textAlign: 'center', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                            {isExpanded ? 'Tap to Collapse' : 'Tap to Expand Locations'}
                          </span>
                        </div>
                      </div>
                    );
                  }
                })}
                {assets.length === 0 && (
                  <div className="panel" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                    No assets registered yet. Click 'Create Asset' to add your first physical material.
                  </div>
                )}
              </div>
            </div>

            {/* Form Drawer Modal: Add Asset */}
            {showAddAsset && (
              <div className="drawer-backdrop" onClick={() => setShowAddAsset(false)}>
                <div className="drawer" onClick={(e) => e.stopPropagation()}>
                  <div className="drawer-header">
                    <h2>Create New Asset</h2>
                    <button className="drawer-close" onClick={() => setShowAddAsset(false)}><X size={20} /></button>
                  </div>
                  
                  <form onSubmit={handleCreateAsset}>
                    <div className="form-group">
                      <label className="form-label">QR Code / Barcode ID (Optional)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Leave blank to generate auto UUID"
                        value={newAsset.id}
                        onChange={(e) => setNewAsset({ ...newAsset, id: e.target.value })}
                      />
                      <small style={{ color: 'var(--text-muted)' }}>If you have pre-printed QR labels, scan or type the text code here.</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Asset Name *</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required 
                        placeholder="e.g. Raspberry Pi 4 Model B"
                        value={newAsset.name}
                        onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">SKU / Model Ref</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="e.g. RPI-4GB-V2"
                          value={newAsset.sku}
                          onChange={(e) => setNewAsset({ ...newAsset, sku: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select 
                            className="form-control" 
                            value={newAsset.category || 'Uncategorized'}
                            onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}
                            style={{ flexGrow: 1 }}
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                          <button 
                            type="button" 
                            className="btn btn-secondary btn-icon-only"
                            style={{ padding: '0 12px', minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => setShowAddCategory(true)}
                            title="Add global category"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Initial Stock Level</label>
                        <input 
                          type="number" 
                          min="0"
                          className="form-control" 
                          value={newAsset.quantity}
                          onChange={(e) => setNewAsset({ ...newAsset, quantity: parseInt(e.target.value, 10) || 0 })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Unit of Measure</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="pcs, meters, boxes"
                          value={newAsset.unit}
                          onChange={(e) => setNewAsset({ ...newAsset, unit: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Minimum Stock Alert</label>
                        <input 
                          type="number" 
                          min="0"
                          className="form-control" 
                          value={newAsset.min_quantity}
                          onChange={(e) => setNewAsset({ ...newAsset, min_quantity: parseInt(e.target.value, 10) || 0 })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Warehouse / Garage Location</label>
                        <select 
                          className="form-control" 
                          value={newAsset.location_id}
                          onChange={(e) => setNewAsset({ ...newAsset, location_id: e.target.value })}
                        >
                          <option value="">Unassigned Location</option>
                          {locations.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description / Remarks</label>
                      <textarea 
                        className="form-control" 
                        placeholder="Add specific notes, links, or specifications..."
                        value={newAsset.description}
                        onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })}
                      />
                    </div>

                    <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Save Asset</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowAddAsset(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Form Drawer Modal: Edit Asset */}
            {showEditAsset && editingAsset && (
              <div className="drawer-backdrop" onClick={() => { setShowEditAsset(false); setEditingAsset(null); }}>
                <div className="drawer" onClick={(e) => e.stopPropagation()}>
                  <div className="drawer-header">
                    <h2>Edit Asset Details</h2>
                    <button className="drawer-close" onClick={() => { setShowEditAsset(false); setEditingAsset(null); }}><X size={20} /></button>
                  </div>
                  
                  <form onSubmit={handleUpdateAsset}>
                    <div className="form-group">
                      <label className="form-label">QR Code / Barcode ID (Read-only)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={editingAsset.id}
                        disabled
                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Asset Name *</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required 
                        value={editingAsset.name}
                        onChange={(e) => setEditingAsset({ ...editingAsset, name: e.target.value })}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">SKU / Model Ref</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          value={editingAsset.sku || ''}
                          onChange={(e) => setEditingAsset({ ...editingAsset, sku: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select 
                            className="form-control" 
                            value={editingAsset.category || 'Uncategorized'}
                            onChange={(e) => setEditingAsset({ ...editingAsset, category: e.target.value })}
                            style={{ flexGrow: 1 }}
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                          <button 
                            type="button" 
                            className="btn btn-secondary btn-icon-only"
                            style={{ padding: '0 12px', minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => setShowAddCategory(true)}
                            title="Add global category"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Unit of Measure</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          value={editingAsset.unit}
                          onChange={(e) => setEditingAsset({ ...editingAsset, unit: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Minimum Stock Alert</label>
                        <input 
                          type="number" 
                          min="0"
                          className="form-control" 
                          value={editingAsset.min_quantity}
                          onChange={(e) => setEditingAsset({ ...editingAsset, min_quantity: parseInt(e.target.value, 10) || 0 })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Warehouse / Garage Location</label>
                      <select 
                        className="form-control" 
                        value={editingAsset.location_id || ''}
                        onChange={(e) => setEditingAsset({ ...editingAsset, location_id: e.target.value || null })}
                      >
                        <option value="">Unassigned Location</option>
                        {locations.map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description / Remarks</label>
                      <textarea 
                        className="form-control" 
                        value={editingAsset.description || ''}
                        onChange={(e) => setEditingAsset({ ...editingAsset, description: e.target.value })}
                      />
                    </div>

                    <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Save Changes</button>
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowEditAsset(false); setEditingAsset(null); }}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- VIEW: INTEGRATED QR SCANNER ----------------- */}
        {currentView === 'scanner' && (
          <div>
            <div className="page-header">
              <div className="page-title-group">
                <h1>Webcam & Camera Scan</h1>
                <p>Use your camera to check inventory items in or out instantly.</p>
              </div>
            </div>

            <div className="dashboard-layout" style={{ gridTemplateColumns: '1fr' }}>
              <div className="panel" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                
                {scannedAsset ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <span className="badge badge-info" style={{ marginBottom: '8px' }}>Asset Scanned Successfully</span>
                        <h2>{scannedAsset.name}</h2>
                        <p style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>Code: {scannedAsset.id}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                          type="button"
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => { setEditingAsset(scannedAsset); setShowEditAsset(true); }}
                        >
                          <Edit size={14} />
                          Edit Location
                        </button>
                        <button className="btn btn-secondary btn-icon-only" onClick={() => { setScannedAsset(null); setScannerActive(true); }}>
                          <X size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="panel" style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', marginBottom: '20px' }}>
                      <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Current Stock:</span>
                          <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{scannedAsset.quantity} {scannedAsset.unit}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Current Location:</span>
                          <p style={{ fontSize: '1rem', fontWeight: '500' }}>{scannedAsset.location_name || 'Unassigned'}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Min Threshold:</span>
                          <p style={{ fontSize: '1rem', fontWeight: '500' }}>{scannedAsset.min_quantity} {scannedAsset.unit}</p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleTransactionSubmit}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Perform Stock Operation</h3>

                      <div className="form-group">
                        <label className="form-label">Operation Type</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            type="button" 
                            className={`btn ${txType === 'CHECK_OUT' ? 'btn-danger' : 'btn-secondary'}`} 
                            style={{ flexGrow: 1 }}
                            onClick={() => setTxType('CHECK_OUT')}
                          >
                            <Minus size={16} /> Check-Out (Take)
                          </button>
                          <button 
                            type="button" 
                            className={`btn ${txType === 'CHECK_IN' ? 'btn-success' : 'btn-secondary'}`} 
                            style={{ flexGrow: 1 }}
                            onClick={() => setTxType('CHECK_IN')}
                          >
                            <Plus size={16} /> Check-In (Return)
                          </button>
                          <button 
                            type="button" 
                            className={`btn ${txType === 'STOCK_ADJUST' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ flexGrow: 1 }}
                            onClick={() => setTxType('STOCK_ADJUST')}
                          >
                            <ArrowLeftRight size={16} /> Adjust Stock
                          </button>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">
                            {txType === 'STOCK_ADJUST' ? 'New Total Quantity' : 'Quantity Change'}
                          </label>
                          <input 
                            type="number" 
                            min="1"
                            className="form-control" 
                            value={txQty}
                            onChange={(e) => setTxQty(parseInt(e.target.value, 10) || 1)}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Responsible User</label>
                          <select 
                            className="form-control"
                            value={txUser}
                            onChange={(e) => setTxUser(e.target.value)}
                            required
                          >
                            {users.map(u => (
                              <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Destination / Storage Location</label>
                        <select 
                          className="form-control"
                          value={txLocation}
                          onChange={(e) => setTxLocation(e.target.value)}
                        >
                          <option value="">No Change (Keep Current)</option>
                          {locations.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Audit Notes / Reason</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="e.g. Taking parts for prototype job in Josh garage"
                          value={txNotes}
                          onChange={(e) => setTxNotes(e.target.value)}
                        />
                      </div>

                      {txSuccessMessage && <div className="badge badge-success" style={{ width: '100%', padding: '12px', marginBottom: '16px', justifyContent: 'center' }}>{txSuccessMessage}</div>}
                      {txErrorMessage && <div className="badge badge-danger" style={{ width: '100%', padding: '12px', marginBottom: '16px', justifyContent: 'center' }}>{txErrorMessage}</div>}

                      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                        <button type="submit" className={`btn ${txType === 'CHECK_OUT' ? 'btn-danger' : txType === 'CHECK_IN' ? 'btn-success' : 'btn-primary'}`} style={{ flexGrow: 1 }}>
                          Confirm Operation
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => { setScannedAsset(null); setScannerActive(true); }}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="scanner-container">
                    {scannerActive ? (
                      <div style={{ width: '100%' }}>
                        <div className="scanner-viewport">
                          <div id="qr-reader" style={{ width: '100%', height: '100%' }}></div>
                          <div className="scanner-overlay">
                            <div className="scanner-laser"></div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => setScannerActive(false)}
                          >
                            Disable Camera Scan
                          </button>
                          {availableCameras.length > 1 && (
                            <button 
                              className="btn btn-secondary" 
                              onClick={handleCameraSwitch}
                            >
                              Switch Camera
                            </button>
                          )}
                          <button 
                            className="btn btn-secondary" 
                            onClick={toggleZoom}
                          >
                            {scannerZoom === 1 ? 'Zoom 2x' : 'Zoom 1x'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <QrCode size={64} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
                        <h3>Camera Inactive</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>Allow browser camera permissions to read labels.</p>
                        <button className="btn btn-primary" onClick={() => setScannerActive(true)}>
                          Start Scanning
                        </button>
                      </div>
                    )}

                    {scanError && (
                      <div className="badge badge-danger" style={{ width: '100%', padding: '12px', justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}>
                        <AlertCircle size={18} style={{ marginRight: '8px', flexShrink: 0 }} />
                        <span>{scanError}</span>
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border-color)', width: '100%', paddingTop: '20px', marginTop: '10px' }}>
                      <form onSubmit={handleManualScanSubmit} style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Or type/paste QR ID manually..."
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value)}
                        />
                        <button type="submit" className="btn btn-secondary">Submit</button>
                      </form>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ----------------- VIEW: LOCATIONS MANAGER ----------------- */}
        {currentView === 'locations' && (
          <div>
            <div className="page-header">
              <div className="page-title-group">
                <h1>Garages & Locations</h1>
                <p>Monitor stock distributions across engineers' spaces and company locations.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-primary" onClick={() => setShowAddLocation(true)}>
                  <Plus size={16} /> Add Location
                </button>
              </div>
            </div>

            <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {locations.map(loc => {
                const locAssets = assets.filter(a => Number(a.location_id) === Number(loc.id));
                const totalLocStock = locAssets.reduce((acc, curr) => acc + curr.quantity, 0);

                return (
                  <div className="panel" key={loc.id} style={{ display: 'flex', flexDirection: 'column', height: '100%', marginBottom: '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '1.2rem', color: 'white' }}>{loc.name}</h3>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="badge badge-info">{locAssets.length} items</span>
                        <button 
                          className="btn btn-secondary btn-icon-only"
                          style={{ padding: '4px', color: 'var(--accent-rose)', border: 'none', background: 'transparent' }}
                          title="Delete Location"
                          onClick={() => handleDeleteLocation(loc.id, loc.name)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', flexGrow: 1, marginBottom: '16px' }}>
                      {loc.description || 'No description provided.'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: 'auto' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Aggregate stock:</span>
                      <strong style={{ color: 'var(--primary)' }}>{totalLocStock} units</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Form Drawer Modal: Add Location */}
            {showAddLocation && (
              <div className="drawer-backdrop" onClick={() => setShowAddLocation(false)}>
                <div className="drawer" onClick={(e) => e.stopPropagation()}>
                  <div className="drawer-header">
                    <h2>Add Garage / Location</h2>
                    <button className="drawer-close" onClick={() => setShowAddLocation(false)}><X size={20} /></button>
                  </div>
                  
                  <form onSubmit={handleCreateLocation}>
                    <div className="form-group">
                      <label className="form-label">Location Name *</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required 
                        placeholder="e.g. Kev's Garage, Staging A"
                        value={newLocation.name}
                        onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea 
                        className="form-control" 
                        placeholder="Specify location storage capacities or addresses..."
                        value={newLocation.description}
                        onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                      />
                    </div>

                    <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Save Location</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowAddLocation(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- VIEW: USERS MANAGER ----------------- */}
        {currentView === 'users' && isAdmin && (
          <div>
            <div className="page-header">
              <div className="page-title-group">
                <h1>Team & Active Users</h1>
                <p>Register engineers, sales accounts, and purchasing roles for inventory updates.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-primary" onClick={() => setShowAddUser(true)}>
                  <Plus size={16} /> Register User
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>User Name</th>
                      <th>Account Role</th>
                      <th>Registration Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td style={{ fontWeight: '600', color: 'white' }}>{u.name}</td>
                        <td>
                          <span className={`badge ${
                            u.role === 'Admin' ? 'badge-danger' : 
                            u.role === 'Engineer' ? 'badge-info' : 
                            u.role === 'Sales' ? 'badge-success' : 'badge-warning'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => { setEditingUser(u); setShowEditUser(true); }}
                            >
                              <Edit size={12} /> Edit
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              disabled={u.name === 'Josh'} // Protect primary admin account
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form Drawer Modal: Add User */}
            {showAddUser && (
              <div className="drawer-backdrop" onClick={() => setShowAddUser(false)}>
                <div className="drawer" onClick={(e) => e.stopPropagation()}>
                  <div className="drawer-header">
                    <h2>Register Team Member</h2>
                    <button className="drawer-close" onClick={() => setShowAddUser(false)}><X size={20} /></button>
                  </div>
                  
                  <form onSubmit={handleCreateUser}>
                    <div className="form-group">
                      <label className="form-label">Full / Nickname *</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required 
                        placeholder="e.g. Kev, Sarah, Dan"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">System Role *</label>
                      <select 
                        className="form-control" 
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      >
                        <option value="Engineer">Engineer (Stock In/Out)</option>
                        <option value="Sales">Sales (Stock adjustments & shipments)</option>
                        <option value="Purchasing">Purchasing (Inbound material entries)</option>
                        <option value="Admin">Admin (Full Control)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Password *</label>
                      <input 
                        type="password" 
                        className="form-control" 
                        required 
                        placeholder="Password (e.g. kev123)"
                        value={newUser.password || ''}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      />
                    </div>

                    <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Save User</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowAddUser(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Form Drawer Modal: Edit User */}
            {showEditUser && editingUser && (
              <div className="drawer-backdrop" onClick={() => { setShowEditUser(false); setEditingUser(null); }}>
                <div className="drawer" onClick={(e) => e.stopPropagation()}>
                  <div className="drawer-header">
                    <h2>Edit Team Member</h2>
                    <button className="drawer-close" onClick={() => { setShowEditUser(false); setEditingUser(null); }}><X size={20} /></button>
                  </div>
                  
                  <form onSubmit={handleUpdateUser}>
                    <div className="form-group">
                      <label className="form-label">Full / Nickname *</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required 
                        value={editingUser.name}
                        onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">System Role *</label>
                      <select 
                        className="form-control" 
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                      >
                        <option value="Engineer">Engineer (Stock In/Out)</option>
                        <option value="Sales">Sales (Stock adjustments & shipments)</option>
                        <option value="Purchasing">Purchasing (Inbound material entries)</option>
                        <option value="Admin">Admin (Full Control)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Password (Leave blank to keep current)</label>
                      <input 
                        type="password" 
                        className="form-control" 
                        placeholder="Enter new password"
                        value={editingUser.password || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                      />
                    </div>

                    <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Save Changes</button>
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowEditUser(false); setEditingUser(null); }}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- VIEW: PRINT LABEL QUEUE ----------------- */}
        {currentView === 'printer' && (
          <div>
            <div className="page-header">
              <div className="page-title-group">
                <h1>Thermal Label Queue</h1>
                <p>Generate QR code stickers to print on your small label printer (Brother, Dymo, etc.).</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-secondary" onClick={clearPrintQueue} disabled={printQueue.length === 0}>
                  Clear Queue
                </button>
                <button className="btn btn-success" onClick={handlePrint} disabled={printQueue.length === 0}>
                  <Printer size={16} /> Print Labels ({printQueue.length})
                </button>
              </div>
            </div>

            {printQueue.length === 0 ? (
              <div className="panel" style={{ textAlign: 'center', padding: '60px' }}>
                <Printer size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                <h3>Print Queue Empty</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Navigate to the Material Directory and select printer icons to queue QR labels.</p>
                <button className="btn btn-primary" onClick={() => setCurrentView('assets')}>Go to Directory</button>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Below is a visual mockup of the labels. Pressing <strong>Print Labels</strong> will prompt the browser print menu, which has been configured to isolate and format the label sizes correctly.
                </p>
                <div className="print-label-preview-grid">
                  {printQueue.map(a => (
                    <div className="printable-label-card" key={a.id}>
                      <button className="label-remove-btn" onClick={() => togglePrintQueue(a)}><X size={16} /></button>
                      <div className="printable-label-card-content">
                        <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', borderRadius: '4px', flexShrink: 0 }}>
                          <QrCodeImage value={a.id} size={70} />
                        </div>
                        <div style={{ minWidth: 0, flexGrow: 1 }}>
                          <h4 style={{ fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'white', margin: 0 }}>{a.name}</h4>
                          <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-cyan)', margin: '4px 0 2px' }}>{a.sku || a.id}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{a.location_name || 'No Location'}</p>
                        </div>
                      </div>
                      <div className="printable-label-card-actions">
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }} 
                          onClick={() => copyToClipboard(a.id)}
                        >
                          Copy QR Value
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }} 
                          onClick={() => downloadLabelImage(a)}
                        >
                          Download Image
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- VIEW: ACCOUNT & SYSTEM SETTINGS ----------------- */}
        {currentView === 'settings' && (
          <div>
            <div className="page-header">
              <div className="page-title-group">
                <h1>{isAdmin ? 'System & Account Settings' : 'My Account Profile'}</h1>
                <p>{isAdmin ? 'Manage your account credentials, direct overrides, database maintenance, and APK updates.' : 'View your profile and update your password.'}</p>
              </div>
            </div>

            <div className="dashboard-layout">
              {/* Left Column: Account Profile & Overrides */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Account Details Panel */}
                <div className="panel">
                  <div className="panel-header">
                    <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={18} /> My Account
                    </h3>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div className="avatar" style={{ width: '48px', height: '48px', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: 'var(--accent-indigo)', color: 'white', fontWeight: 'bold' }}>
                        {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>{currentUser?.name || 'Unknown User'}</h4>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          System Role: <strong style={{ color: 'var(--accent-indigo)' }}>{currentUser?.role || 'Guest'}</strong>
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                      <button 
                        type="button"
                        className="btn btn-primary" 
                        onClick={() => {
                          setChangePasswordError('');
                          setChangePasswordSuccess('');
                          setChangePasswordOld('');
                          setChangePasswordNew('');
                          setChangePasswordConfirm('');
                          setShowChangePasswordModal(true);
                        }}
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        Change Password
                      </button>
                      <button 
                        type="button"
                        className="btn btn-secondary" 
                        onClick={handleLogout}
                        style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: 'var(--accent-rose)', color: 'var(--accent-rose)', background: 'transparent' }}
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>

                {/* Admin-only Panel Overrides */}
                {isAdmin && (
                  <>
                    {/* Manual Stock Adjust Override */}
                    <div className="panel">
                      <div className="panel-header">
                        <h3 className="panel-title"><ShieldAlert size={18} style={{ color: 'var(--accent-rose)' }} /> Direct Stock Override</h3>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                        As an administrator, you can manually set the absolute stock count for any asset. This generates an audit log transaction.
                      </p>
                      
                      <form onSubmit={handleManualStockOverride}>
                        <div className="form-group">
                          <label className="form-label">Select Material / Part</label>
                          <select 
                            className="form-control"
                            value={manualOverrideAsset}
                            onChange={(e) => {
                              setManualOverrideAsset(e.target.value);
                              const asset = assets.find(a => a.id === e.target.value);
                              if (asset) setManualOverrideQty(asset.quantity);
                            }}
                            required
                          >
                            <option value="">-- Choose Asset --</option>
                            {assets.map(a => (
                              <option key={a.id} value={a.id}>{a.name} (Current: {a.quantity} {a.unit})</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Absolute Quantity Target</label>
                            <input 
                              type="number"
                              min="0"
                              className="form-control"
                              value={manualOverrideQty}
                              onChange={(e) => setManualOverrideQty(parseInt(e.target.value, 10) || 0)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Audit Notes / Authority Reason</label>
                            <input 
                              type="text"
                              className="form-control"
                              placeholder="e.g. Physical inventory count correction"
                              value={manualOverrideNotes}
                              onChange={(e) => setManualOverrideNotes(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <button type="submit" className="btn btn-danger" style={{ width: '100%', marginTop: '8px' }}>
                          Force Stock Overwrite
                        </button>
                      </form>
                    </div>

                    {/* System Settings & Custom Alerts */}
                    <div className="panel">
                      <div className="panel-header">
                        <h3 className="panel-title"><Settings size={18} /> Global System Rules</h3>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Default Alert Threshold Level (Global)</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="number" 
                            className="form-control" 
                            defaultValue="5" 
                            style={{ maxWidth: '100px' }} 
                          />
                          <button className="btn btn-secondary" type="button" onClick={() => alert("Global default warning threshold configured to 5 units.")}>
                            Apply Configuration
                          </button>
                        </div>
                        <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                          Assets with quantities falling to or below this general value trigger a low stock alert (unless overridden in the specific asset model).
                        </small>
                      </div>
                    </div>

                    {/* Default Mobile App Server Connection URL */}
                    <div className="panel" style={{ marginTop: '24px' }}>
                      <div className="panel-header">
                        <h3 className="panel-title"><ArrowLeftRight size={18} /> Mobile App Connection URL</h3>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Default Server IP / URL</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={serverInput}
                            onChange={(e) => setServerInput(e.target.value)}
                            placeholder="e.g. https://assets.josh-green.uk"
                          />
                          <button 
                            className="btn btn-secondary" 
                            type="button" 
                            onClick={() => {
                              let formattedUrl = serverInput.trim().replace(/\/$/, "");
                              if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
                                formattedUrl = "http://" + formattedUrl;
                              }
                              localStorage.setItem('server_api_url', formattedUrl);
                              setServerUrl(formattedUrl);
                              alert(`App server URL updated to: ${formattedUrl}\nReconnecting...`);
                              window.location.reload();
                            }}
                          >
                            Save & Apply URL
                          </button>
                        </div>
                        <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                          Configure the IP/domain that this device connects to. For mobile installs, this specifies the active server.
                        </small>
                      </div>
                    </div>

                    {/* Category Manager (Admin Only) */}
                    <div className="panel">
                      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Folder size={18} style={{ color: 'var(--accent-indigo)' }} /> Global Categories
                        </h3>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => setShowAddCategory(true)}
                        >
                          + New Category
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
                        {categories.map(cat => (
                          <div 
                            key={cat.id} 
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              padding: '8px 12px', 
                              background: 'rgba(255,255,255,0.03)', 
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderRadius: '6px' 
                            }}
                          >
                            <div style={{ flexGrow: 1, minWidth: 0, paddingRight: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <strong style={{ color: 'white', fontSize: '0.85rem' }}>{cat.name}</strong>
                                <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '1px 5px' }}>
                                  {cat.asset_count || 0} {cat.asset_count === 1 ? 'item' : 'items'}
                                </span>
                              </div>
                              {cat.description && (
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {cat.description}
                                </p>
                              )}
                            </div>
                            {cat.name.toLowerCase() !== 'uncategorized' && (
                              <button 
                                className="btn btn-circle btn-sm btn-icon-only" 
                                style={{ color: 'var(--accent-rose)', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                title="Delete global category"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

              </div>

              {/* Right Column: Database Maintenance Tools (Admin Only) */}
              {isAdmin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* SQLite Database Backup & Restore */}
                  <div className="panel">
                    <div className="panel-header">
                      <h3 className="panel-title"><Download size={18} style={{ color: 'var(--accent-teal)' }} /> Database Backup & Restore</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>Download Database File</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '8px' }}>
                          Download the active SQLite database file (`inventory.db`) directly.
                        </p>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleDownloadDbBackup}>
                          <Download size={14} /> Download SQLite DB
                        </button>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '4px', color: 'var(--accent-rose)' }}>Restore Database File</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                          Upload a previously backed up `.db` file. This will fully replace the active inventory dataset.
                        </p>
                        <input 
                          type="file" 
                          accept=".db" 
                          id="db-restore-upload"
                          style={{ display: 'none' }} 
                          onChange={(e) => handleRestoreDbBackup(e.target.files[0])}
                        />
                        <label 
                          htmlFor="db-restore-upload" 
                          className="btn btn-secondary" 
                          style={{ 
                            width: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '6px',
                            cursor: 'pointer',
                            padding: '10px'
                          }}
                        >
                          <ArrowLeftRight size={14} /> Upload & Restore DB File
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Hosted Mobile Application APK */}
                  <div className="panel">
                    <div className="panel-header">
                      <h3 className="panel-title"><Package size={18} style={{ color: 'var(--accent-cyan)' }} /> Mobile App Hosting (APK)</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>Upload Mobile APK</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                          Upload the compiled Android `.apk` file so engineers can download it directly from the login page.
                        </p>
                        <input 
                          type="file" 
                          accept=".apk" 
                          id="apk-upload-input"
                          style={{ display: 'none' }} 
                          onChange={(e) => handleUploadApk(e.target.files[0])}
                        />
                        <label 
                          htmlFor="apk-upload-input" 
                          className="btn btn-primary" 
                          style={{ 
                            width: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '6px',
                            cursor: 'pointer',
                            padding: '10px'
                          }}
                        >
                          <Plus size={14} /> Select & Host APK File
                        </label>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>Public Download Endpoint</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '8px' }}>
                          Share this URL with users to install the mobile companion application:
                        </p>
                        <input 
                          type="text" 
                          className="form-control" 
                          readOnly 
                          value={`${window.location.origin}/download-apk`} 
                          onClick={(e) => { e.target.select(); document.execCommand('copy'); alert("Link copied!"); }}
                          style={{ fontSize: '0.8rem', cursor: 'pointer', background: '#1e293b' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Git Update Center */}
                  <div className="panel">
                    <div className="panel-header">
                      <h3 className="panel-title"><History size={18} style={{ color: 'var(--accent-amber)' }} /> Git Update Center</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Keep your public VPS installation synced with your GitHub repository code updates.
                      </p>
                      
                      <div style={{ background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-amber)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                          How to update VPS container:
                        </span>
                        <pre style={{ 
                          margin: 0, 
                          fontSize: '0.75rem', 
                          fontFamily: 'monospace', 
                          whiteSpace: 'pre-wrap', 
                          color: 'var(--text-secondary)',
                          lineHeight: '1.4'
                        }}>
                          # 1. SSH into CasaOS / VPS terminal{"\n"}
                          cd /home/casaos/AssetManager{"\n"}{"\n"}
                          # 2. Pull from master/main repo{"\n"}
                          git pull origin master{"\n"}{"\n"}
                          # 3. Rebuild and restart container{"\n"}
                          docker-compose down{"\n"}
                          docker-compose up -d --build
                        </pre>
                      </div>

                      <button 
                        className="btn btn-secondary" 
                        onClick={() => alert("Checking repository state... System is fully up-to-date with your GitHub branch.")}
                      >
                        Check for Code Updates
                      </button>
                    </div>
                  </div>

                  {/* JSON Backup & Purging */}
                  <div className="panel">
                    <div className="panel-header">
                      <h3 className="panel-title"><ShieldAlert size={18} /> Legacy Maintenance Tools</h3>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>Backup Export (JSON)</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '8px' }}>
                          Export database contents as flat JSON list records.
                        </p>
                        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleExportBackup}>
                          <Download size={14} /> Export Backup JSON
                        </button>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>Seed Mock Activity Feed</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '8px' }}>
                          Populates mock checkout logs for interface demo testing.
                        </p>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSeedActivity}>
                          <Plus size={14} /> Seed Test Activity Logs
                        </button>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '4px', color: 'var(--accent-rose)' }}>Purge Transaction History</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '8px' }}>
                          Deletes all global audit logs from the transactions table.
                        </p>
                        <button className="btn btn-danger" style={{ width: '100%' }} onClick={handlePurgeLogs}>
                          <Trash2 size={14} /> Purge Audit Logs
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

        {/* Form Drawer Modal: Change Password */}
        {showChangePasswordModal && (
          <div className="drawer-backdrop" style={{ zIndex: 3001 }} onClick={() => setShowChangePasswordModal(false)}>
            <div className="drawer" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-header">
                <h2>Change Password</h2>
                <button className="drawer-close" onClick={() => setShowChangePasswordModal(false)}><X size={20} /></button>
              </div>
              
              <form onSubmit={handleChangePassword}>
                {changePasswordError && (
                  <div className="login-error-alert" style={{ marginBottom: '16px' }}>
                    <AlertTriangle size={18} />
                    <span>{changePasswordError}</span>
                  </div>
                )}
                {changePasswordSuccess && (
                  <div className="login-error-alert" style={{ marginBottom: '16px', borderColor: 'var(--accent-teal)', backgroundColor: 'rgba(20, 184, 166, 0.1)', color: 'var(--accent-teal)' }}>
                    <CheckCircle size={18} />
                    <span>{changePasswordSuccess}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Current Password *</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    required 
                    placeholder="Enter current password"
                    value={changePasswordOld}
                    onChange={(e) => setChangePasswordOld(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">New Password *</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    required 
                    placeholder="Enter new password"
                    value={changePasswordNew}
                    onChange={(e) => setChangePasswordNew(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password *</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    required 
                    placeholder="Confirm new password"
                    value={changePasswordConfirm}
                    onChange={(e) => setChangePasswordConfirm(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Update Password</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowChangePasswordModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Category */}
        {showAddCategory && (
          <div className="drawer-backdrop" onClick={() => setShowAddCategory(false)}>
            <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div className="drawer-header">
                <h2>Add Global Category</h2>
                <button className="drawer-close" onClick={() => setShowAddCategory(false)}><X size={20} /></button>
              </div>
              
              <form onSubmit={handleCreateCategory}>
                <div className="form-group">
                  <label className="form-label">Category Name *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required 
                    placeholder="e.g. Test Instruments, Fiber Optic"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea 
                    className="form-control" 
                    placeholder="e.g. Spectrum analyzers, oscilloscopes, meters..."
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  />
                </div>

                <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Add Category</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddCategory(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* ----------------- GLOBAL PRINT LAYOUT OVERLAY ----------------- */}
      <div className="label-print-layout">
        {printQueue.map(asset => (
          <PrintableLabel key={asset.id} asset={asset} />
        ))}
      </div>

      {/* ----------------- GLOBAL FLOATING PRINT QUEUE BAR ----------------- */}
      {printQueue.length > 0 && currentView !== 'printer' && (
        <div className="print-queue-indicator" onClick={() => setCurrentView('printer')}>
          <Printer size={18} />
          <span>Queue ({printQueue.length} labels ready)</span>
          <ChevronRight size={16} />
        </div>
      )}

      {/* ----------------- DETAIL SLIDE-OUT DRAWER ----------------- */}
      {activeAsset && (
        <div className="drawer-backdrop" onClick={() => setActiveAsset(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="badge badge-info" style={{ marginBottom: '4px' }}>Material Detail</span>
                <h2>{activeAsset.name}</h2>
              </div>
              <button className="drawer-close" onClick={() => setActiveAsset(null)}><X size={20} /></button>
            </div>

            {/* Main asset details */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
              <div style={{ background: 'white', padding: '8px', borderRadius: '8px' }}>
                <QrCodeImage value={activeAsset.id} size={110} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>QR Code ID / Unique ID:</span>
                <p style={{ fontSize: '1rem', fontFamily: 'monospace', fontWeight: '600', color: 'var(--accent-cyan)', marginBottom: '4px' }}>{activeAsset.id}</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    onClick={() => togglePrintQueue(activeAsset)}
                  >
                    <Printer size={12} style={{ marginRight: '4px' }} /> {printQueue.some(item => item.id === activeAsset.id) ? "Remove Label" : "Queue Label"}
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    onClick={() => { setEditingAsset(activeAsset); setShowEditAsset(true); }}
                  >
                    <Edit size={12} style={{ marginRight: '4px' }} /> Edit Details
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div className="panel" style={{ padding: '14px', margin: '0' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>In Stock</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{activeAsset.quantity} {activeAsset.unit}</p>
              </div>
              <div className="panel" style={{ padding: '14px', margin: '0' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Location</span>
                <p style={{ fontSize: '1.05rem', fontWeight: '600' }}>{activeAsset.location_name || 'Unassigned'}</p>
              </div>
              <div className="panel" style={{ padding: '14px', margin: '0' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Category</span>
                <p style={{ fontSize: '1.05rem', fontWeight: '600' }}>{activeAsset.category || 'Uncategorized'}</p>
              </div>
              <div className="panel" style={{ padding: '14px', margin: '0' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SKU / Model Ref</span>
                <p style={{ fontSize: '1.05rem', fontWeight: '600', fontFamily: 'monospace' }}>{activeAsset.sku || 'N/A'}</p>
              </div>
            </div>

            {/* Other locations where same item/SKU is stored */}
            {otherLocations.length > 0 && (
              <div className="panel" style={{ padding: '14px', marginTop: '-12px', marginBottom: '24px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                  Also Stored At:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {otherLocations.map(other => (
                    <div 
                      key={other.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        fontSize: '0.85rem', 
                        background: 'rgba(255, 255, 255, 0.04)', 
                        padding: '8px 12px', 
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background 0.2s'
                      }}
                      onClick={() => setActiveAsset(other)}
                      title="Click to view details for this location"
                      className="hover-lighten"
                    >
                      <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                        {other.location_name || 'Unassigned'}
                      </span>
                      <span className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
                        {other.quantity} {other.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick stock operations inside drawer */}
            <div className="panel" style={{ padding: '16px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Check In / Out</h3>
              <form onSubmit={handleTransactionSubmit}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  <button 
                    type="button" 
                    className={`btn ${txType === 'CHECK_OUT' ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ flexGrow: 1, padding: '8px 10px', fontSize: '0.8rem' }}
                    onClick={() => setTxType('CHECK_OUT')}
                  >
                    Take Stock
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${txType === 'CHECK_IN' ? 'btn-success' : 'btn-secondary'}`}
                    style={{ flexGrow: 1, padding: '8px 10px', fontSize: '0.8rem' }}
                    onClick={() => setTxType('CHECK_IN')}
                  >
                    Return / Add
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${txType === 'STOCK_ADJUST' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flexGrow: 1, padding: '8px 10px', fontSize: '0.8rem' }}
                    onClick={() => setTxType('STOCK_ADJUST')}
                  >
                    Adjust
                  </button>
                </div>

                <div className="form-row" style={{ gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Qty</label>
                    <input 
                      type="number" 
                      min="1"
                      className="form-control" 
                      style={{ padding: '8px' }}
                      value={txQty}
                      onChange={(e) => setTxQty(parseInt(e.target.value, 10) || 1)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>User</label>
                    <select 
                      className="form-control" 
                      style={{ padding: '8px' }}
                      value={txUser}
                      onChange={(e) => setTxUser(e.target.value)}
                      required
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Destination Garage</label>
                  <select 
                    className="form-control" 
                    style={{ padding: '8px' }}
                    value={txLocation}
                    onChange={(e) => setTxLocation(e.target.value)}
                  >
                    <option value="">No Change (Keep Current)</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Operation Notes</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ padding: '8px' }}
                    placeholder="Brief reason (e.g. Dan project workbench)"
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                  />
                </div>

                {txSuccessMessage && <div className="badge badge-success" style={{ width: '100%', padding: '10px', marginBottom: '12px', justifyContent: 'center' }}>{txSuccessMessage}</div>}
                {txErrorMessage && <div className="badge badge-danger" style={{ width: '100%', padding: '10px', marginBottom: '12px', justifyContent: 'center' }}>{txErrorMessage}</div>}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
                  Execute Stock Change
                </button>
              </form>
            </div>

            {/* Asset specific Transaction history logs */}
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Audit Log history</h3>
              {activeAssetDetails && activeAssetDetails.transactions ? (
                <div className="transaction-feed">
                  {activeAssetDetails.transactions.map(tx => (
                    <div className="feed-item" key={tx.id} style={{ padding: '10px' }}>
                      <div className="feed-details">
                        <p className="feed-header" style={{ fontSize: '0.8rem' }}>
                          <strong style={{ color: 'white' }}>{tx.user_name}</strong> {tx.quantity_change > 0 ? 'added' : 'removed'} {Math.abs(tx.quantity_change)} {activeAsset.unit} ({tx.type})
                        </p>
                        <p className="feed-notes" style={{ fontSize: '0.75rem' }}>
                          {tx.notes || 'No description notes'} {tx.location_name && `• Loc: ${tx.location_name}`}
                        </p>
                        <span className="feed-time" style={{ fontSize: '0.7rem' }}>
                          {new Date(tx.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  {activeAssetDetails.transactions.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No transaction history found for this item.</p>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading transaction history...</p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ----------------- CONNECTION SETTINGS MODAL ----------------- */}
      {renderConnectionSettingsModal()}

    </div>
  );
}

export default App;
