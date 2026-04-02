import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Plus, 
  Search, 
  Trash2, 
  Minus, 
  Printer, 
  ChevronRight,
  Settings,
  LogOut,
  Menu,
  History,
  Tag,
  Sun,
  Moon,
  ShieldAlert,
  Edit,
  Download,
  Wifi,
  WifiOff,
  RefreshCw,
  User,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  CheckCircle2,
  Store,
  X,
  FileText,
  FileSpreadsheet,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Category, Item, CartItem, Sale, DayEndReport, PaymentMethod, Customer, InventoryReportData } from './types';

interface StockAdjustment {
  id: number;
  item_id: number;
  adjustment: number;
  reason: string;
  username: string;
  timestamp: string;
}

interface Settings {
  company_name: string;
  tax_rate: string;
  address: string;
  contact: string;
  logo_url: string;
  app_logo_url: string;
  vat_id: string;
  currency: string;
  timezone: string;
  thermal_paper_size: '58mm' | '80mm';
  thermal_font_style: 'normal' | 'bold' | 'condensed';
  thermal_print_density: number;
}

const AuditLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/edit-logs')
      .then(res => res.json())
      .then(data => setLogs(data));
  }, []);

  const exportLogs = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Timestamp,User,Table,Action,Details\n"
      + logs.map(log => `${new Date(log.timestamp).toISOString()},${log.username || 'System'},${log.table_name},${log.action},"${(log.details || '').replace(/"/g, '""')}"`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Audit Logs</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track all system modifications</p>
        </div>
        <button onClick={exportLogs} className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
          <Download size={18} /> 
          <span className="text-sm font-bold uppercase tracking-wider">Export CSV</span>
        </button>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Table</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-sm">
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 text-slate-900 dark:text-white font-bold whitespace-nowrap">{log.username || 'System'}</td>
                  <td className="px-6 py-4 text-slate-900 dark:text-white font-bold whitespace-nowrap">{log.table_name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 
                      log.action === 'UPDATE' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                      log.action === 'DELETE' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                      'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                    {(() => {
                      try {
                        const details = JSON.parse(log.details);
                        if (typeof details === 'object' && details !== null) {
                          return (
                            <div className="space-y-1 max-w-md">
                              {Object.entries(details).map(([key, value]: [string, any]) => (
                                <div key={key} className="text-[10px] flex gap-2 flex-wrap">
                                  <span className="font-bold uppercase text-slate-400">{key}:</span>
                                  {typeof value === 'object' && value !== null ? (
                                    <span className="flex items-center gap-1">
                                      <span className="text-red-500 line-through">{String(value.before)}</span>
                                      <ChevronRight size={10} className="text-slate-400" />
                                      <span className="text-emerald-500 font-bold">{String(value.after)}</span>
                                    </span>
                                  ) : (
                                    <span>{String(value)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return <span className="text-xs italic">{log.details}</span>;
                      } catch (e) {
                        return <span className="text-xs italic">{log.details}</span>;
                      }
                    })()}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">No logs recorded yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
const PrintStyles = () => (
  <style>{`
    @media print {
      @page { margin: 0; size: auto; }
      html, body { height: 100%; overflow: visible !important; background: white !important; margin: 0 !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .print-only { 
        display: block !important; 
        position: static !important; 
        visibility: visible !important;
        width: 100% !important; 
        height: auto !important; 
        overflow: visible !important;
        opacity: 1 !important;
      }
      .page-break { page-break-after: always; }
      #root { display: block !important; height: auto !important; overflow: visible !important; }
      
      /* Thermal Printer Specific Sizing */
      .receipt-80mm { width: 80mm !important; }
      .receipt-58mm { width: 58mm !important; }
    }
    /* Screen Display Sizing */
    .receipt-80mm { width: 300px; }
    .receipt-58mm { width: 220px; }
    /* Hide on screen but keep in DOM for React to render */
    .print-only { 
      position: fixed; 
      top: -10000px; 
      left: 0; 
      width: 1px; 
      height: 1px; 
      overflow: hidden; 
      opacity: 0;
      pointer-events: none;
    }
  `}</style>
);

const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload image');
  const data = await res.json();
  return data.url;
};

// --- Components ---

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark') || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDark(true);
    }
  };

  return (
    <button 
      onClick={toggleTheme}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all mb-2"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
      {isDark ? 'Light Mode' : 'Dark Mode'}
    </button>
  );
};

const Sidebar = ({ activeTab, setActiveTab, onLogout, currentUser, settings, isOnline, pendingSalesCount, isSyncing, syncPendingSales, isOpen, setIsOpen, newOrdersCount, setNewOrdersCount }: { 
  activeTab: string, 
  setActiveTab: (tab: string) => void, 
  onLogout: () => void, 
  currentUser: { username: string, role: string } | null, 
  settings: Settings,
  isOnline: boolean,
  pendingSalesCount: number,
  isSyncing: boolean,
  syncPendingSales: () => void,
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  newOrdersCount?: number,
  setNewOrdersCount: (count: number) => void
}) => {
  const menuItems = [
    { id: 'pos', icon: ShoppingCart, label: 'Checkout' },
    { id: 'inventory', icon: Package, label: 'Inventory' },
    { id: 'inventory_report', icon: FileText, label: 'Inventory Report' },
    { id: 'customers', icon: User, label: 'Customers' },
    { id: 'reports', icon: BarChart3, label: 'Reports' },
  ];

  if (currentUser?.role === 'admin' || currentUser?.role === 'cashier') {
    menuItems.splice(1, 0, { id: 'pending_orders', icon: Bell, label: 'Pending Orders' });
  }

  if (currentUser?.role === 'kds') {
    menuItems.splice(0, menuItems.length, { id: 'kds', icon: Package, label: 'Kitchen Display' });
  }

  if (currentUser?.role === 'admin') {
    menuItems.push({ id: 'admin', icon: Settings, label: 'Admin' });
    menuItems.push({ id: 'logs', icon: ShieldAlert, label: 'Audit Logs' });
  }

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col h-screen no-print transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.app_logo_url || settings.logo_url ? (
              <img src={settings.app_logo_url || settings.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded-xl shadow-lg shadow-indigo-200" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <LayoutDashboard size={24} />
              </div>
            )}
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-[120px]">{settings.company_name || 'Modern POS'}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Store Management</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id === 'pending_orders' || item.id === 'kds') {
                  setNewOrdersCount(0);
                }
                if (window.innerWidth < 1024) setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 font-semibold' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="flex-1 text-left">{item.label}</span>
              {(item.id === 'pending_orders' || item.id === 'kds') && newOrdersCount !== undefined && newOrdersCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {newOrdersCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Wifi size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <WifiOff size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Offline</span>
                </div>
              )}
            </div>
            {pendingSalesCount > 0 && (
              <button 
                onClick={() => isOnline && !isSyncing && syncPendingSales()}
                disabled={!isOnline || isSyncing}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${
                  isOnline 
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSyncing ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                )}
                <span className="text-[10px] font-bold">{pendingSalesCount} Pending</span>
              </button>
            )}
          </div>
          
          <ThemeToggle />
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

// --- Receipt Component ---
const Receipt = ({ sale, items, settings, branches = [] }: { sale: any, items: any[], settings: Settings, branches?: any[] }) => {
  const saleDate = sale.timestamp ? new Date(sale.timestamp) : new Date();
  const taxRate = parseFloat(settings.tax_rate) || 0;
  const currency = settings.currency || '₱';
  
  const branch = branches.find(b => b.id === sale.branch_id);

  // Thermal Printer settings
  const paperSize = settings.thermal_paper_size || '80mm';
  const fontStyle = settings.thermal_font_style || 'normal';
  const printDensity = settings.thermal_print_density || 3;

  const fontStyleClass = 
    fontStyle === 'bold' ? 'font-bold' : 
    fontStyle === 'condensed' ? 'tracking-tighter' : '';

  // Simulate density with opacity and weight
  const densityStyles = {
    opacity: printDensity <= 3 ? 0.6 + (printDensity * 0.13) : 1,
    fontWeight: printDensity > 3 ? (printDensity === 4 ? 600 : 800) : 'inherit'
  };
  
  return (
    <div 
      className={`receipt-${paperSize} font-mono text-xs leading-tight text-black bg-white dark:bg-slate-800 p-2 ${fontStyleClass}`}
      style={densityStyles}
    >
      <div className="text-center mb-2">
        {settings.logo_url && (
          <img src={settings.logo_url} alt="Company Logo" className="w-16 h-16 mx-auto mb-2 object-contain" referrerPolicy="no-referrer" />
        )}
        <h2 className="text-lg font-bold uppercase">{branch?.name || settings.company_name || 'MODERN STORE'}</h2>
        <p>{branch?.address || settings.address || '123 Business Street, City'}</p>
        <p>Tel: {branch?.contact || settings.contact || '+1 234 567 890'}</p>
        {branch?.vat_id ? <p>VAT ID: {branch.vat_id}</p> : settings.vat_id && <p>VAT ID: {settings.vat_id}</p>}
      </div>
      
      <div className="border-t border-b border-dashed border-black py-2 mb-2">
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{saleDate.toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Time:</span>
          <span>{saleDate.toLocaleTimeString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Receipt:</span>
          <span>#{sale.id || 'TEMP'}</span>
        </div>
      </div>

      {sale.customer_name && (
        <div className="mb-2 border-b border-dashed border-black pb-2">
          <p className="font-bold uppercase text-[10px]">Customer Details</p>
          <p>{sale.customer_name}</p>
          {sale.customer_phone && <p>Tel: {sale.customer_phone}</p>}
          {sale.customer_address && <p className="mt-1 italic">{sale.customer_address}</p>}
        </div>
      )}

      <div className="mb-2">
        <div className="flex justify-between font-bold border-b border-dashed border-black pb-1 mb-1">
          <span className="w-1/2">Item</span>
          <span className="w-1/4 text-center">Qty</span>
          <span className="w-1/4 text-right">Price</span>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between py-1">
            <span className="w-1/2 truncate">{item.name}</span>
            <span className="w-1/4 text-center">x{item.quantity}</span>
            <span className="w-1/4 text-right">{currency}{((item.price_at_sale || item.price || 0) * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-black pt-2 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{currency}{sale.subtotal?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>VAT ({taxRate}%):</span>
          <span>{currency}{sale.tax?.toFixed(2)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>-{currency}{(sale.discount || 0).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg border-t border-black pt-1 mt-1">
          <span>TOTAL:</span>
          <span>{currency}{sale.total?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mt-2">
          <span>Payment:</span>
          <span className="uppercase">{sale.payment_method}</span>
        </div>
      </div>
      
      <div className="text-center mt-4 text-[10px]">
        <p>Thank you for your purchase!</p>
        <p>Please come again.</p>
      </div>
    </div>
  );
};

// --- Report Print Component ---
const ReportPrint = ({ report, salesHistory, settings, type, date }: { report: DayEndReport, salesHistory: Sale[], settings: Settings, type: string, date: string }) => {
  console.log("Rendering ReportPrint", { report, salesHistory });
  const summary = report?.summary || [];
  const totalRevenue = summary.reduce((a, b) => a + (b.total_sales || 0), 0);
  const totalTransactions = summary.reduce((a, b) => a + (b.transaction_count || 0), 0);
  const currency = settings.currency || '₱';

  // Thermal Printer settings
  const paperSize = settings.thermal_paper_size || '80mm';
  const fontStyle = settings.thermal_font_style || 'normal';
  const printDensity = settings.thermal_print_density || 3;

  const fontStyleClass = 
    fontStyle === 'bold' ? 'font-bold' : 
    fontStyle === 'condensed' ? 'tracking-tighter' : '';

  const densityStyles = {
    opacity: printDensity <= 3 ? 0.6 + (printDensity * 0.13) : 1,
    fontWeight: printDensity > 3 ? (printDensity === 4 ? 600 : 800) : 'inherit'
  };

  return (
    <div 
      className={`receipt-${paperSize} font-mono text-xs leading-tight text-black bg-white dark:bg-slate-800 p-2 ${fontStyleClass}`}
      style={densityStyles}
    >
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold uppercase">{settings.company_name}</h2>
        <p>{settings.address}</p>
        <p>Tel: {settings.contact}</p>
        {settings.vat_id && <p>VAT ID: {settings.vat_id}</p>}
        <div className="border-b border-black my-2"></div>
        <p className="text-sm font-bold uppercase">
          {type === 'day' ? 'DAILY' : type === 'month' ? 'MONTHLY' : 'YEARLY'} SALES REPORT
        </p>
        <p>Date: {type === 'day' ? new Date(date).toLocaleDateString() : date}</p>
        <p>Generated: {new Date().toLocaleTimeString()}</p>
      </div>
      
      <div className="mb-4">
        <h3 className="font-bold border-b border-dashed border-black mb-2">SALES SUMMARY</h3>
        <div className="flex justify-between mb-1">
          <span>Total Revenue:</span>
          <span className="font-bold">{currency}{(totalRevenue || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Transactions:</span>
          <span>{totalTransactions || 0}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Avg Transaction:</span>
          <span>{currency}{totalTransactions > 0 ? ((totalRevenue || 0) / totalTransactions).toFixed(2) : '0.00'}</span>
        </div>
        
        <div className="mt-2 pt-2 border-t border-dashed border-black">
          <div className="font-bold mb-1">BY PAYMENT METHOD</div>
          {summary.map(s => (
            <div key={s.payment_method} className="flex justify-between mb-1 pl-2">
              <span className="uppercase">{s.payment_method}:</span>
              <span>{currency}{(s.total_sales || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {report.categories && report.categories.length > 0 && (
        <div className="mb-4">
          <h3 className="font-bold border-b border-dashed border-black mb-2">SALES BY CATEGORY</h3>
          {report.categories.map((cat, idx) => (
            <div key={idx} className="flex justify-between mb-1">
              <span>{cat.name || 'Uncategorized'}</span>
              <span>{currency}{(cat.total_revenue || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-bold border-b border-dashed border-black mb-2">TOP ITEMS (By Revenue)</h3>
        <div className="flex justify-between font-bold border-b border-black pb-1 mb-1">
          <span className="w-1/2">Item</span>
          <span className="w-1/4 text-center">Qty</span>
          <span className="w-1/4 text-right">Amt</span>
        </div>
        {report.items.slice(0, 10).map((item, idx) => (
          <div key={idx} className="flex justify-between py-1">
            <span className="w-1/2 truncate">{item.name}</span>
            <span className="w-1/4 text-center">{item.total_quantity}</span>
            <span className="w-1/4 text-right">{(item.total_revenue || 0).toFixed(2)}</span>
          </div>
        ))}
        {(!report.items || report.items.length === 0) && (
          <div className="text-center py-2">No sales recorded</div>
        )}
      </div>

      <div className="mb-4">
        <h3 className="font-bold border-b border-dashed border-black mb-2">RECENT TRANSACTIONS</h3>
        <div className="flex justify-between font-bold border-b border-black pb-1 mb-1">
          <span className="w-1/3">Time</span>
          <span className="w-1/3 text-center">Type</span>
          <span className="w-1/3 text-right">Total</span>
        </div>
        {salesHistory.slice(0, 10).map(sale => (
          <div key={sale.id} className="flex justify-between py-1">
            <span className="w-1/3">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="w-1/3 text-center uppercase">{sale.payment_method.substring(0, 4)}</span>
            <span className="w-1/3 text-right">{(sale.total || 0).toFixed(2)}</span>
          </div>
        ))}
      </div>
      
      <div className="text-center mt-6 border-t border-black pt-2">
        <p>*** END OF REPORT ***</p>
        <p className="mt-2 text-[10px]">Printed by: {settings.company_name}</p>
      </div>
    </div>
  );
};

// --- Inventory Report Component ---
const InventoryReport = ({ data, settings, categories }: { data: InventoryReportData | null, settings: Settings, categories: Category[] }) => {
  const [filterCategory, setFilterCategory] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all');

  if (!data) return <div className="p-8 text-center text-slate-500">Loading inventory report...</div>;

  const filteredItems = data.items.filter(item => {
    const matchesCategory = filterCategory === '' || item.category_id === filterCategory;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'low' && item.status === 'low') ||
                         (filterStatus === 'out' && item.status === 'out');
    return matchesCategory && matchesStatus;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 lg:space-y-8 p-4 lg:p-8 max-w-7xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Inventory Report</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Detailed stock levels, valuation, and profit analysis</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select 
            className="input text-sm py-2"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select 
            className="input text-sm py-2"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="card p-6 bg-indigo-600 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <Package size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Total Valuation</span>
          </div>
          <div className="text-2xl font-black">{settings.currency || '₱'}{data.summary.total_valuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="text-xs mt-1 opacity-80">{data.summary.total_stock} items in stock</div>
        </div>

        <div className="card p-6 bg-emerald-600 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingUp size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Potential Profit</span>
          </div>
          <div className="text-2xl font-black">{settings.currency || '₱'}{data.summary.total_potential_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="text-xs mt-1 opacity-80">Based on current stock levels</div>
        </div>

        <div className="card p-6 bg-amber-500 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <ShieldAlert size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Low Stock</span>
          </div>
          <div className="text-2xl font-black">{data.summary.low_stock_count}</div>
          <div className="text-xs mt-1 opacity-80">Items below threshold</div>
        </div>

        <div className="card p-6 bg-red-600 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <AlertCircle size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Out of Stock</span>
          </div>
          <div className="text-2xl font-black">{data.summary.out_of_stock_count}</div>
          <div className="text-xs mt-1 opacity-80">Items with zero stock</div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Item Details</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Stock</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Cost Price</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Sale Price</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Valuation</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Pot. Profit</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-sm">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{item.sku || 'No SKU'} • {item.category_name || 'Uncategorized'}</div>
                  </td>
                  <td className="px-6 py-4 text-center font-bold">{item.stock}</td>
                  <td className="px-6 py-4 text-right text-slate-500">{settings.currency || '₱'}{item.cost_price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-slate-900 dark:text-white">{settings.currency || '₱'}{item.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-indigo-600">{settings.currency || '₱'}{item.valuation.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">{settings.currency || '₱'}{item.potential_profit.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'normal' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                      item.status === 'low' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                      'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No items found matching the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

// --- Settings Component ---
const SettingsPanel = ({ settings, onUpdate, currentUser }: { settings: Settings, onUpdate: (s: Settings) => void, currentUser: any }) => {
  const [formData, setFormData] = useState(settings);
  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        onUpdate(formData);
        setMessage('Settings updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to update settings.');
      }
    } catch (err) {
      setMessage('Error updating settings.');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6 lg:space-y-8"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage company details and tax configuration</p>
        </div>
      </div>

      <div className="card p-4 lg:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Company Name</label>
              <input 
                type="text" 
                name="company_name"
                className="input w-full text-sm" 
                value={formData.company_name}
                onChange={handleChange}
                placeholder="Enter company name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Receipt Logo</label>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                {formData.logo_url && <img src={formData.logo_url} alt="Logo" className="h-12 w-12 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-1" referrerPolicy="no-referrer" />}
                <input 
                  type="file" 
                  accept="image/*"
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/20 dark:file:text-indigo-400" 
                  onChange={async (e) => {
                    if (e.target.files?.[0]) {
                      try {
                        const url = await uploadImage(e.target.files[0]);
                        setFormData({...formData, logo_url: url});
                      } catch (err) {
                        alert('Failed to upload image');
                      }
                    }
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">App Interface Logo</label>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                {formData.app_logo_url && <img src={formData.app_logo_url} alt="App Logo" className="h-12 w-12 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-1" referrerPolicy="no-referrer" />}
                <input 
                  type="file" 
                  accept="image/*"
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/20 dark:file:text-indigo-400" 
                  onChange={async (e) => {
                    if (e.target.files?.[0]) {
                      try {
                        const url = await uploadImage(e.target.files[0]);
                        setFormData({...formData, app_logo_url: url});
                      } catch (err) {
                        alert('Failed to upload image');
                      }
                    }
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Tax Rate (%)</label>
              <input 
                type="number" 
                name="tax_rate"
                className="input w-full text-sm" 
                value={formData.tax_rate}
                onChange={handleChange}
                step="0.01"
                placeholder="e.g. 12"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Address</label>
              <input 
                type="text" 
                name="address"
                className="input w-full text-sm" 
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter business address"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Contact Number</label>
              <input 
                type="text" 
                name="contact"
                className="input w-full text-sm" 
                value={formData.contact}
                onChange={handleChange}
                placeholder="Enter contact number"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">VAT ID</label>
              <input 
                type="text" 
                name="vat_id"
                className="input w-full text-sm" 
                value={formData.vat_id || ''}
                onChange={handleChange}
                placeholder="e.g. GB123456789"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Currency</label>
              <select 
                name="currency"
                className="input w-full text-sm" 
                value={formData.currency || '₱'}
                onChange={handleChange as any}
              >
                <optgroup label="North America">
                  <option value="$">USD ($) - US Dollar</option>
                  <option value="C$">CAD (C$) - Canadian Dollar</option>
                  <option value="MX$">MXN (MX$) - Mexican Peso</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="€">EUR (€) - Euro</option>
                  <option value="£">GBP (£) - British Pound</option>
                  <option value="CHF">CHF - Swiss Franc</option>
                  <option value="kr">NOK/SEK/DKK (kr) - Krone</option>
                  <option value="zł">PLN (zł) - Polish Zloty</option>
                  <option value="₽">RUB (₽) - Russian Ruble</option>
                  <option value="₺">TRY (₺) - Turkish Lira</option>
                </optgroup>
                <optgroup label="Asia">
                  <option value="₱">PHP (₱) - Philippine Peso</option>
                  <option value="¥">JPY (¥) - Japanese Yen</option>
                  <option value="CN¥">CNY (CN¥) - Chinese Yuan</option>
                  <option value="₹">INR (₹) - Indian Rupee</option>
                  <option value="₩">KRW (₩) - South Korean Won</option>
                  <option value="HK$">HKD (HK$) - Hong Kong Dollar</option>
                  <option value="S$">SGD (S$) - Singapore Dollar</option>
                  <option value="RM">MYR (RM) - Malaysian Ringgit</option>
                  <option value="฿">THB (฿) - Thai Baht</option>
                  <option value="Rp">IDR (Rp) - Indonesian Rupiah</option>
                  <option value="₫">VND (₫) - Vietnamese Dong</option>
                  <option value="₨">PKR (₨) - Pakistani Rupee</option>
                  <option value="৳">BDT (৳) - Bangladeshi Taka</option>
                </optgroup>
                <optgroup label="Middle East & Africa">
                  <option value="د.إ">AED (د.إ) - UAE Dirham</option>
                  <option value="SAR">SAR - Saudi Riyal</option>
                  <option value="BHD">BHD - Bahraini Dinar</option>
                  <option value="R">ZAR (R) - South African Rand</option>
                  <option value="₦">NGN (₦) - Nigerian Naira</option>
                  <option value="E£">EGP (E£) - Egyptian Pound</option>
                  <option value="KSh">KES (KSh) - Kenyan Shilling</option>
                </optgroup>
                <optgroup label="Oceania & South America">
                  <option value="A$">AUD (A$) - Australian Dollar</option>
                  <option value="NZ$">NZD (NZ$) - New Zealand Dollar</option>
                  <option value="R$">BRL (R$) - Brazilian Real</option>
                  <option value="$">ARS ($) - Argentine Peso</option>
                  <option value="CLP$">CLP (CLP$) - Chilean Peso</option>
                  <option value="COL$">COP (COL$) - Colombian Peso</option>
                  <option value="S/">PEN (S/) - Peruvian Sol</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Timezone</label>
              <select 
                name="timezone"
                className="input w-full text-sm" 
                value={formData.timezone || 'UTC'}
                onChange={handleChange as any}
              >
                {Intl.supportedValuesOf('timeZone').map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Thermal Printer Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Paper Size</label>
                <select 
                  name="thermal_paper_size"
                  className="input w-full text-sm" 
                  value={formData.thermal_paper_size || '80mm'}
                  onChange={handleChange as any}
                >
                  <option value="80mm">80mm (Standard)</option>
                  <option value="58mm">58mm (Compact)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Font Style</label>
                <select 
                  name="thermal_font_style"
                  className="input w-full text-sm" 
                  value={formData.thermal_font_style || 'normal'}
                  onChange={handleChange as any}
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="condensed">Condensed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Print Density (1-5)</label>
                <div className="space-y-2">
                  <input 
                    type="range" 
                    name="thermal_print_density"
                    min="1"
                    max="5"
                    step="1"
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                    value={formData.thermal_print_density || 3}
                    onChange={(e) => setFormData({...formData, thermal_print_density: parseInt(e.target.value)})}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                    <span>Light</span>
                    <span>Normal</span>
                    <span>Dark</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button 
              type="submit" 
              className="btn btn-primary w-full sm:w-auto px-8 py-3 text-sm font-bold uppercase tracking-widest"
            >
              Save Changes
            </button>
            {message && (
              <span className={`text-sm font-bold ${message.includes('success') ? 'text-emerald-500' : 'text-red-500'} animate-pulse`}>
                {message}
              </span>
            )}
          </div>
        </form>
      </div>
    </motion.div>
  );
};

// --- KDS Panel Component ---
const KDSPanel = ({ orders, onUpdateStatus, currentUser, isSoundEnabled, setIsSoundEnabled, onTestSound }: { 
  orders: Sale[], 
  onUpdateStatus: (id: number, status: string) => void, 
  currentUser: any,
  isSoundEnabled: boolean,
  setIsSoundEnabled: (enabled: boolean) => void,
  onTestSound: () => void
}) => {
  const branchOrders = orders.filter(o => !currentUser.branch_id || o.branch_id === currentUser.branch_id);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Kitchen Display System</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage order preparation for your branch</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${
              isSoundEnabled 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800' 
                : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
            }`}
            title={isSoundEnabled ? "Mute Alert" : "Unmute Alert"}
          >
            {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            <span className="text-xs font-bold uppercase tracking-wider">{isSoundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>
          <button 
            onClick={onTestSound}
            className="p-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all"
            title="Test Sound"
          >
            <BellRing size={20} />
          </button>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Active Orders: {branchOrders.length}</span>
          </div>
        </div>
      </div>

      {!isSoundEnabled && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl flex items-center gap-3 text-amber-700 dark:text-amber-400">
          <AlertCircle size={18} />
          <p className="text-sm font-medium">Sound alerts are currently muted. You may miss new orders!</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branchOrders.map((order) => (
          <div key={order.id} className="card overflow-hidden border-t-4 border-indigo-500">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order ID</span>
                <div className="font-black text-lg text-slate-900 dark:text-white">#{order.id}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time</span>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">{new Date(order.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
            
            <div className="p-4 space-y-3 min-h-[150px]">
              {(order as any).items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-start gap-3">
                  <div className="flex gap-2">
                    <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2 py-0.5 rounded-md h-fit">
                      {item.quantity}x
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  order.preparation_status === 'ready' ? 'bg-emerald-100 text-emerald-600' :
                  order.preparation_status === 'preparing' ? 'bg-amber-100 text-amber-600' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {order.preparation_status || 'pending'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {(!order.preparation_status || order.preparation_status === 'pending') && (
                  <button 
                    onClick={() => onUpdateStatus(order.id, 'preparing')}
                    className="col-span-2 btn bg-amber-500 hover:bg-amber-600 text-white text-xs py-2"
                  >
                    Start Preparing
                  </button>
                )}
                {order.preparation_status === 'preparing' && (
                  <button 
                    onClick={() => onUpdateStatus(order.id, 'ready')}
                    className="col-span-2 btn bg-emerald-500 hover:bg-emerald-600 text-white text-xs py-2"
                  >
                    Mark as Ready
                  </button>
                )}
                {order.preparation_status === 'ready' && (
                  <button 
                    onClick={() => onUpdateStatus(order.id, 'delivered')}
                    className="col-span-2 btn bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-2"
                  >
                    Mark as Delivered
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {branchOrders.length === 0 && (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Package size={40} />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">No active orders for this branch.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// --- Admin Component ---
const AdminPanel = ({ onUpdatePaymentMethods, currentUser }: { onUpdatePaymentMethods?: () => void, currentUser: any }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('cashier');
  const [branchId, setBranchId] = useState<number | ''>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchContact, setNewBranchContact] = useState('');
  const [newBranchVatId, setNewBranchVatId] = useState('');
  const [branchError, setBranchError] = useState('');
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editBranchId, setEditBranchId] = useState<number | ''>('');
  const [userToDelete, setUserToDelete] = useState<number | null>(null);

  // Payment Methods State
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [paymentMethodError, setPaymentMethodError] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchPaymentMethods();
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (err) {
      console.error("Failed to fetch branches");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users");
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch('/api/payment-methods');
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data);
      }
    } catch (err) {
      console.error("Failed to fetch payment methods");
    }
  };

  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPaymentMethod.trim()) return;
    setPaymentMethodError('');

    try {
      const res = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify({ name: newPaymentMethod }),
      });
      
      if (res.ok) {
        setNewPaymentMethod('');
        fetchPaymentMethods();
        onUpdatePaymentMethods?.();
      } else {
        const data = await res.json();
        setPaymentMethodError(data.error || 'Failed to add payment method');
      }
    } catch (err) {
      setPaymentMethodError('Network error');
    }
  };

  const handleDeletePaymentMethod = async (id: number) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;
    try {
      const res = await fetch(`/api/payment-methods/${id}`, { 
        method: 'DELETE',
        headers: { 'X-Username': currentUser?.username || 'System' }
      });
      if (res.ok) {
        fetchPaymentMethods();
        onUpdatePaymentMethods?.();
      }
    } catch (err) {
      console.error("Failed to delete payment method");
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setBranchError('');

    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify({ name: newBranchName, address: newBranchAddress, contact: newBranchContact, vat_id: newBranchVatId }),
      });
      
      if (res.ok) {
        setNewBranchName('');
        setNewBranchAddress('');
        setNewBranchContact('');
        setNewBranchVatId('');
        fetchBranches();
      } else {
        const data = await res.json();
        setBranchError(data.error || 'Failed to add branch');
      }
    } catch (err) {
      setBranchError('Network error');
    }
  };

  const handleDeleteBranch = async (id: number) => {
    if (!confirm('Are you sure you want to delete this branch?')) return;
    try {
      const res = await fetch(`/api/branches/${id}`, { 
        method: 'DELETE',
        headers: { 'X-Username': currentUser?.username || 'System' }
      });
      if (res.ok) {
        fetchBranches();
      }
    } catch (err) {
      console.error("Failed to delete branch");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify({ username, password, role, branch_id: branchId || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`User ${data.username} created successfully!`);
        setUsername('');
        setPassword('');
        setRole('cashier');
        setBranchId('');
        fetchUsers();
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleDeleteClick = (id: number) => {
    setUserToDelete(id);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`/api/users/${userToDelete}`, { 
        method: 'DELETE',
        headers: { 'X-Username': currentUser?.username || 'System' }
      });
      if (res.ok) {
        fetchUsers();
        setUserToDelete(null);
      } else {
        alert('Failed to delete user');
      }
    } catch (err) {
      alert('Error deleting user');
    }
  };

  const handleUpdatePassword = async (id: number) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify({ password: newPassword || undefined, branch_id: editBranchId || null }),
      });
      if (res.ok) {
        setEditingUser(null);
        setNewPassword('');
        setEditBranchId('');
        fetchUsers();
        alert('User updated successfully');
      } else {
        alert('Failed to update user');
      }
    } catch (err) {
      alert('Error updating user');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6 lg:space-y-8"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">Admin Panel</h2>
          <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400">Manage system users and settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="card p-4 lg:p-6">
          <h3 className="text-lg font-bold mb-6">Create New User</h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Username</label>
              <input 
                type="text" 
                className="input w-full text-sm" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                placeholder="e.g. jdoe"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Password</label>
              <input 
                type="password" 
                className="input w-full text-sm" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Role</label>
              <select 
                className="input w-full text-sm" 
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                <option value="cashier">Cashier</option>
                <option value="callcenter">Call Center</option>
                <option value="kds">KDS (Kitchen)</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Branch</label>
              <select 
                className="input w-full text-sm" 
                value={branchId}
                onChange={e => setBranchId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">No Branch (Global)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            
            {message && <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-xl font-bold animate-pulse">{message}</div>}
            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-bold animate-pulse">{error}</div>}

            <button type="submit" className="btn btn-primary w-full py-3 text-sm font-bold uppercase tracking-widest">Create User</button>
          </form>
        </div>

        <div className="card p-4 lg:p-6">
          <h3 className="text-lg font-bold mb-6">Existing Users</h3>
          <div className="space-y-3">
            {users.map(user => (
              <div key={user.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between group hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">{user.username}</div>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${user.role === 'admin' ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {user.role} {user.branch_id ? `- ${branches.find(b => b.id === user.branch_id)?.name || 'Unknown Branch'}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      setEditingUser(user.id);
                      setNewPassword('');
                      setEditBranchId(user.branch_id || '');
                    }}
                    className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors"
                    title="Edit User"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(user.id)}
                    className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                    disabled={user.username === currentUser?.username}
                    title="Delete User"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-center py-8 text-sm italic">No users found.</p>}
          </div>
        </div>
      </div>

      {/* Branches Section */}
      <div className="card p-4 lg:p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <MapPin size={24} className="text-indigo-600" />
          Branches
        </h2>
        
        <form onSubmit={handleAddBranch} className="flex flex-col sm:flex-row gap-3 mb-8 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Branch Name</label>
            <input 
              type="text" 
              placeholder="e.g. Downtown Branch" 
              className="input w-full text-sm"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Address</label>
            <input 
              type="text" 
              placeholder="e.g. 123 Main St" 
              className="input w-full text-sm"
              value={newBranchAddress}
              onChange={(e) => setNewBranchAddress(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">Contact</label>
            <input 
              type="text" 
              placeholder="e.g. 555-0123" 
              className="input w-full text-sm"
              value={newBranchContact}
              onChange={(e) => setNewBranchContact(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 tracking-wider">VAT ID</label>
            <input 
              type="text" 
              placeholder="e.g. VAT-123456" 
              className="input w-full text-sm"
              value={newBranchVatId}
              onChange={(e) => setNewBranchVatId(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary px-6 py-3 text-sm font-bold uppercase tracking-widest whitespace-nowrap">
            <Plus size={18} className="mr-2" />
            Add Branch
          </button>
        </form>

        {branchError && (
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl mb-6 text-sm font-bold animate-pulse">
            {branchError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((branch) => (
            <div key={branch.id} className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-200 capitalize text-sm block">{branch.name}</span>
                <span className="text-xs text-slate-500 block">{branch.address}</span>
                <span className="text-xs text-slate-500 block">{branch.contact}</span>
                {branch.vat_id && <span className="text-xs text-slate-500 block">VAT: {branch.vat_id}</span>}
              </div>
              <button 
                onClick={() => handleDeleteBranch(branch.id)}
                className="text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Methods Section */}
      <div className="card p-4 lg:p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Settings size={24} className="text-indigo-600" />
          Payment Methods
        </h2>
        
        <form onSubmit={handleAddPaymentMethod} className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="flex-1">
            <input 
              type="text" 
              placeholder="e.g. GCash, Maya, Bank Transfer" 
              className="input w-full text-sm"
              value={newPaymentMethod}
              onChange={(e) => setNewPaymentMethod(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary px-6 py-3 text-sm font-bold uppercase tracking-widest whitespace-nowrap">
            <Plus size={18} className="mr-2" />
            Add Method
          </button>
        </form>

        {paymentMethodError && (
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl mb-6 text-sm font-bold animate-pulse">
            {paymentMethodError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paymentMethods.map((method) => (
            <div key={method.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
              <span className="font-bold text-slate-700 dark:text-slate-200 capitalize text-sm">{method.name}</span>
              <button 
                onClick={() => handleDeletePaymentMethod(method.id)}
                className="text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black\/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-none p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4 text-red-600">Delete User?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={confirmDeleteUser}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1"
              >
                Delete
              </button>
              <button 
                onClick={() => setUserToDelete(null)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-none p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Edit User</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Update user details.</p>
            <input 
              type="password" 
              className="input w-full mb-4" 
              placeholder="New Password (leave blank to keep)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <select 
              className="input w-full mb-4 text-sm" 
              value={editBranchId}
              onChange={e => setEditBranchId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">No Branch (Global)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button 
                onClick={() => handleUpdatePassword(editingUser)}
                className="btn btn-primary flex-1"
              >
                Update
              </button>
              <button 
                onClick={() => { setEditingUser(null); setNewPassword(''); setEditBranchId(''); }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// --- Customers Section Component ---
const CustomersSection = ({ currentUser, settings }: { currentUser: any, settings: Settings }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCustomers = async (query: string) => {
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error("Failed to fetch customers");
    }
  };

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => fetchCustomers(searchQuery), 300);
      return () => clearTimeout(timer);
    } else if (searchQuery.length === 0) {
      fetchCustomers('');
    }
  }, [searchQuery]);

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoading(true);
    try {
      const [statsRes, salesRes] = await Promise.all([
        fetch(`/api/customers/${customer.id}/stats`),
        fetch(`/api/customers/${customer.id}/sales`)
      ]);
      if (statsRes.ok && salesRes.ok) {
        const stats = await statsRes.json();
        const sales = await salesRes.json();
        setCustomerStats(stats);
        setCustomerSales(sales);
      }
    } catch (err) {
      console.error("Failed to fetch customer details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Customer Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track customer sales and branch activity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customer List/Search */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Search customers..."
                className="input w-full pl-10"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {customers.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCustomer(c)}
                  className={`w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${selectedCustomer?.id === c.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-600' : ''}`}
                >
                  <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.phone || 'No phone'}</p>
                </button>
              ))}
              {customers.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  No customers found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCustomer ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-6 bg-indigo-600 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Total Sales</p>
                  <p className="text-2xl font-bold">{settings.currency || '₱'}{customerStats?.total_spent?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="card p-6 bg-emerald-600 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Total Orders</p>
                  <p className="text-2xl font-bold">{customerStats?.total_orders || 0}</p>
                </div>
                <div className="card p-6 bg-amber-600 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Branches Visited</p>
                  <p className="text-2xl font-bold">{customerStats?.branch_count || 0}</p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="card p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600">
                    <User size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</h3>
                    <p className="text-slate-500">{selectedCustomer.email || 'No email'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex items-center gap-3">
                    <Phone className="text-slate-400" size={18} />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</p>
                      <p className="text-sm font-medium">{selectedCustomer.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="text-slate-400" size={18} />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</p>
                      <p className="text-sm font-medium">{selectedCustomer.address || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sales History */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <History size={18} className="text-indigo-600" />
                    Sales History
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Branch</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {customerSales.map(sale => (
                        <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-6 py-4 text-sm whitespace-nowrap">
                            {new Date(sale.timestamp).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                            {sale.branch_name || 'Main'}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold whitespace-nowrap">
                            {settings.currency || '₱'}{sale.total.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              sale.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                            }`}>
                              {sale.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {customerSales.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                            No sales history found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-12 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <User size={40} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">No Customer Selected</h3>
                <p className="text-slate-500">Select a customer from the list to view their sales history and branch activity.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Login Component ---
const Login = ({ onLogin, settings }: { onLogin: (user: any) => void, settings: Settings }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        onLogin(data);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-none overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center">
          {settings.app_logo_url || settings.logo_url ? (
            <img src={settings.app_logo_url || settings.logo_url} alt="Logo" className="w-16 h-16 mx-auto mb-4 object-contain rounded-2xl bg-white p-1 shadow-lg shadow-indigo-200" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-16 h-16 bg-white dark:bg-slate-800/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <LayoutDashboard size={32} className="text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-white mb-2">{settings.company_name || 'Modern POS'}</h1>
          <p className="text-indigo-100">Store Management System</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                placeholder="Enter username"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                placeholder="Enter password"
              />
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Access System'}
            </button>
          </form>
          
          <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Protected System • Authorized Personnel Only
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string, role: string, branch_id?: number } | null>(null);
  const [activeTab, setActiveTab] = useState('pos');
  const [inventoryReportData, setInventoryReportData] = useState<InventoryReportData | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [discount, setDiscount] = useState('');
  const [lastSale, setLastSale] = useState<{ id: number; subtotal: number; tax: number; total: number; payment_method: string; items: CartItem[], discount: number } | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedSaleItems, setSelectedSaleItems] = useState<any[]>([]);
  const [loadingSaleItems, setLoadingSaleItems] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [branches, setBranches] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  // Customer State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [printCopies, setPrintCopies] = useState(1);
  const [showPrintCopiesModal, setShowPrintCopiesModal] = useState(false);

  // Inventory State
  const [newItem, setNewItem] = useState({ name: '', price: '', cost_price: '', category_id: '', sku: '', stock: '', image_url: '', low_stock_threshold: '5' });
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [adjustStockItem, setAdjustStockItem] = useState<Item | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [stockHistoryItem, setStockHistoryItem] = useState<Item | null>(null);
  const [stockHistory, setStockHistory] = useState<StockAdjustment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Reports State
  const [dayEndReport, setDayEndReport] = useState<DayEndReport | null>(null);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [reportType, setReportType] = useState<'day' | 'month' | 'year'>('day');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportBranchId, setReportBranchId] = useState<number | ''>('');

  const [isPrinting, setIsPrinting] = useState(false);

  const [settings, setSettings] = useState<Settings>({
    company_name: 'MODERN STORE',
    tax_rate: '12',
    address: '123 Main St, City',
    contact: '555-0123',
    logo_url: '',
    app_logo_url: '',
    vat_id: '',
    currency: '₱',
    timezone: 'UTC',
    thermal_paper_size: '80mm',
    thermal_font_style: 'normal',
    thermal_print_density: 3,
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Offline State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSales, setPendingSales] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pendingSales');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  const alertSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/989/989-preview.mp3');
    audio.volume = 1.0;
    audio.preload = 'auto';
    
    audio.addEventListener('error', (e) => {
      console.error("Audio failed to load, trying fallback...", e);
      // Fallback to a different stable source if the first one fails
      audio.src = 'https://www.soundjay.com/buttons/sounds/beep-07.mp3';
    });

    alertSound.current = audio;
  }, []);

  const playAlertSound = () => {
    if (isSoundEnabled && alertSound.current) {
      alertSound.current.currentTime = 0;
      alertSound.current.play().catch(e => console.error("Audio play failed:", e));
      
      // Play again after 1.5 seconds for extra loudness/urgency
      setTimeout(() => {
        if (alertSound.current) {
          alertSound.current.currentTime = 0;
          alertSound.current.play().catch(e => console.error("Audio play failed:", e));
        }
      }, 1500);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('pendingSales', JSON.stringify(pendingSales));
  }, [pendingSales]);

  useEffect(() => {
    if (activeTab === 'kds' || activeTab === 'pending_orders') {
      setNewOrdersCount(0);
    }
  }, [activeTab, pendingOrders.length]);

  useEffect(() => {
    if (isOnline && pendingSales.length > 0 && !isSyncing) {
      syncPendingSales();
    }
  }, [isOnline, pendingSales.length, isSyncing]);

  const syncPendingSales = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    const salesToSync = [...pendingSales];
    console.log(`Syncing ${salesToSync.length} pending sales...`);
    
    for (const sale of salesToSync) {
      try {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Username': sale.username
          },
          body: JSON.stringify({
            items: sale.items,
            subtotal: sale.subtotal,
            tax: sale.tax,
            total: sale.total,
            payment_method: sale.payment_method,
            discount: sale.discount,
            timestamp: sale.timestamp,
            customer_id: sale.customer_id,
            branch_id: sale.branch_id
          })
        });
        
        if (res.ok) {
          setPendingSales(prev => prev.filter(s => s.offlineId !== sale.offlineId));
        } else {
          console.error('Failed to sync sale:', await res.text());
          break; // Stop on error
        }
      } catch (err) {
        console.error('Error syncing sale:', err);
        break;
      }
    }
    setIsSyncing(false);
    if (isAuthenticated) fetchItems();
  };

  const fetchCustomers = async (search?: string) => {
    setIsSearchingCustomers(true);
    try {
      const url = search ? `/api/customers?search=${encodeURIComponent(search)}` : '/api/customers';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error("Failed to fetch customers");
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = !!selectedCustomer && newCustomer.name === selectedCustomer.name; // Simple check if we are editing
      // Actually let's use a more explicit check or just handle both
      
      if (selectedCustomer && customers.some(c => c.id === selectedCustomer.id && c.name === newCustomer.name)) {
         // This is a bit ambiguous, let's add an explicit ID check or separate function
      }

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify(newCustomer),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedCustomer(data);
        setShowCustomerModal(false);
        setNewCustomer({ name: '', phone: '', email: '', address: '' });
        fetchCustomers();
      } else {
        alert('Failed to create customer');
      }
    } catch (err) {
      alert('Error creating customer');
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify(newCustomer),
      });
      if (res.ok) {
        setSelectedCustomer({ ...selectedCustomer, ...newCustomer });
        setShowCustomerModal(false);
        setIsEditingCustomer(false);
        setNewCustomer({ name: '', phone: '', email: '', address: '' });
        fetchCustomers();
      } else {
        alert('Failed to update customer');
      }
    } catch (err) {
      alert('Error updating customer');
    }
  };

  useEffect(() => {
    if (customerSearchQuery.length >= 2) {
      const timer = setTimeout(() => {
        fetchCustomers(customerSearchQuery);
      }, 300);
      return () => clearTimeout(timer);
    } else if (customerSearchQuery.length === 0) {
      setCustomers([]);
    }
  }, [customerSearchQuery]);

  const fetchInventoryReport = async () => {
    try {
      const res = await fetch('/api/reports/inventory');
      if (res.ok) {
        const data = await res.json();
        setInventoryReportData(data);
      }
    } catch (err) {
      console.error("Failed to fetch inventory report:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
    if (isAuthenticated) {
      fetchItems();
      fetchCategories();
      fetchPaymentMethods();
      fetchBranches();
      fetchPendingOrders();
      if (activeTab === 'inventory_report') {
        fetchInventoryReport();
      }
    }
  }, [isAuthenticated, activeTab]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAuthenticated && (currentUser?.role === 'admin' || currentUser?.role === 'cashier' || currentUser?.role === 'kds')) {
      interval = setInterval(() => {
        fetchPendingOrders(true);
      }, 10000); // Poll every 10 seconds
    }
    return () => clearInterval(interval);
  }, [isAuthenticated, currentUser]);

  const fetchPendingOrders = async (isPolling = false) => {
    if (!currentUser) return;
    try {
      let url = '/api/orders/pending';
      if ((currentUser.role === 'cashier' || currentUser.role === 'kds') && currentUser.branch_id) {
        url += `?branch_id=${currentUser.branch_id}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPendingOrders(prev => {
          if (isPolling && data.length > prev.length) {
            const newCount = data.length - prev.length;
            setNewOrdersCount(c => c + newCount);
            
            // Play sound for KDS and Cashier
            if (currentUser.role === 'kds' || currentUser.role === 'cashier') {
              playAlertSound();
            }

            // Show alert for new orders
            if (Notification.permission === 'granted') {
              new Notification('New Order Received', {
                body: `You have ${newCount} new pending order(s).`
              });
            }
          }
          return data;
        });
      }
    } catch (err) {
      console.error("Failed to fetch pending orders");
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (err) {
      console.error("Failed to fetch branches");
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch('/api/payment-methods');
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data);
      }
    } catch (err) {
      console.error("Failed to fetch payment methods");
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    
    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (user.role === 'kds') {
      setActiveTab('kds');
    } else if (user.role === 'callcenter') {
      setActiveTab('pending_orders');
    } else {
      setActiveTab('pos');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCart([]);
    setActiveTab('pos');
  };

  const fetchItems = async () => {
    const res = await fetch('/api/items');
    const data = await res.json();
    setItems(data);
  };

  const fetchCategories = async () => {
    const res = await fetch('/api/categories');
    const data = await res.json();
    setCategories(data);
  };

  const fetchStockHistory = async (itemId: number) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/items/${itemId}/stock-history`);
      if (res.ok) {
        const data = await res.json();
        setStockHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch stock history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAdjustStock = async () => {
    if (!adjustStockItem || !adjustmentAmount) return;
    
    const adjustment = parseInt(adjustmentAmount);
    if (isNaN(adjustment)) {
      alert("Please enter a valid number");
      return;
    }

    try {
      const res = await fetch(`/api/items/${adjustStockItem.id}/adjust-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify({ adjustment, reason: adjustmentReason })
      });
      
      if (res.ok) {
        setAdjustStockItem(null);
        setAdjustmentAmount('');
        setAdjustmentReason('');
        fetchItems();
      } else {
        alert("Failed to adjust stock");
      }
    } catch (err) {
      console.error("Error adjusting stock:", err);
      alert("Failed to adjust stock");
    }
  };

  const addToCart = (item: Item) => {
    if (isNaN(item.price) || item.price < 0) {
      alert("This item has an invalid price and cannot be added to the cart.");
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: number) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === itemId) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxRate = parseFloat(settings.tax_rate) || 0;
  const cartTax = cartSubtotal * (taxRate / 100);
  const cartTotal = cartSubtotal + cartTax;

  const fetchSaleItems = async (saleId: number) => {
    setLoadingSaleItems(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/items`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSaleItems(data);
      }
    } catch (err) {
      console.error("Failed to fetch sale items:", err);
    } finally {
      setLoadingSaleItems(false);
    }
  };

  const handleVoidSale = async (saleId: number) => {
    if (!statusReason) {
      alert("Please provide a reason for voiding this sale.");
      return;
    }
    try {
      const res = await fetch(`/api/sales/${saleId}/void`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify({ reason: statusReason })
      });
      if (res.ok) {
        alert("Sale voided successfully.");
        setSelectedSale(null);
        setStatusReason('');
        fetchSalesHistory();
        fetchReportSummary();
        fetchItems();
      } else {
        const data = await res.json();
        alert(`Failed to void sale: ${data.error}`);
      }
    } catch (err) {
      alert("Error voiding sale.");
    }
  };

  const handleRefundSale = async (saleId: number) => {
    if (!statusReason) {
      alert("Please provide a reason for refunding this sale.");
      return;
    }
    try {
      const res = await fetch(`/api/sales/${saleId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify({ reason: statusReason })
      });
      if (res.ok) {
        alert("Sale refunded successfully.");
        setSelectedSale(null);
        setStatusReason('');
        fetchSalesHistory();
        fetchReportSummary();
        fetchItems();
      } else {
        const data = await res.json();
        alert(`Failed to refund sale: ${data.error}`);
      }
    } catch (err) {
      alert("Error refunding sale.");
    }
  };

  const handleCheckout = async (paymentMethod: string) => {
    console.log('Starting checkout with method:', paymentMethod);
    if (cart.length === 0) {
      console.warn('Cart is empty, cannot checkout');
      return;
    }

    if (currentUser?.role === 'callcenter' && !selectedBranch) {
      alert('Please select a branch for this order.');
      return;
    }

    const discountValue = parseFloat(discount) || 0;
    const finalTotal = Math.max(0, cartTotal - discountValue);

    // Handle Offline Mode
    if (!isOnline) {
      const offlineId = Date.now();
      const offlineSale = {
        offlineId,
        items: cart,
        subtotal: cartSubtotal,
        tax: cartTax,
        total: finalTotal,
        payment_method: paymentMethod,
        discount: discountValue,
        timestamp: new Date().toISOString(),
        username: currentUser?.username || 'System',
        customer_id: selectedCustomer?.id || null
      };

      setPendingSales(prev => [...prev, offlineSale]);
      
      // Update local stock immediately for offline feedback
      setItems(prevItems => {
        const newItems = [...prevItems];
        cart.forEach(cartItem => {
          const itemIndex = newItems.findIndex(i => i.id === cartItem.id);
          if (itemIndex > -1) {
            newItems[itemIndex] = {
              ...newItems[itemIndex],
              stock: newItems[itemIndex].stock - cartItem.quantity
            };
          }
        });
        return newItems;
      });

      setLastSale({ 
        id: offlineId, 
        subtotal: cartSubtotal, 
        tax: cartTax, 
        total: finalTotal, 
        payment_method: paymentMethod,
        items: [...cart],
        discount: discountValue
      });
      setShowReceipt(true);
      setCart([]);
      setDiscount('');
      setSelectedCustomer(null);
      setCustomerSearchQuery('');
      return;
    }

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify({
          items: cart,
          subtotal: cartSubtotal,
          tax: cartTax,
          total: finalTotal,
          payment_method: paymentMethod,
          discount: discountValue,
          customer_id: selectedCustomer?.id || null,
          branch_id: selectedBranch || currentUser?.branch_id || null,
          status: currentUser?.role === 'callcenter' ? 'pending' : 'completed'
        })
      });
      
      // If server returns error, don't fallback to offline (it's a logic error)
      if (!res.ok) {
        const data = await res.json();
        console.error('Checkout failed:', data.error, data.details);
        alert(`Checkout failed: ${data.error || 'Unknown error'}${data.details ? ` (${data.details})` : ''}`);
        return;
      }

      const data = await res.json();
      console.log('Checkout response:', data);
      if (data.success) {
        setLastSale({ 
          id: data.id, 
          subtotal: cartSubtotal, 
          tax: cartTax, 
          total: finalTotal, 
          payment_method: paymentMethod,
          items: [...cart],
          discount: discountValue,
          customer_name: selectedCustomer?.name,
          customer_phone: selectedCustomer?.phone,
          customer_address: selectedCustomer?.address,
          branch_id: selectedBranch || currentUser?.branch_id || null
        });
        setShowReceipt(true);
        setCart([]);
        setDiscount('');
        setSelectedCustomer(null);
        setCustomerSearchQuery('');
        fetchItems(); // Refresh stock
      }
    } catch (err) {
      console.error('Checkout network error, falling back to offline:', err);
      // Fallback to offline mode on network error
      const offlineId = Date.now();
      const offlineSale = {
        offlineId,
        items: cart,
        subtotal: cartSubtotal,
        tax: cartTax,
        total: finalTotal,
        payment_method: paymentMethod,
        discount: discountValue,
        timestamp: new Date().toISOString(),
        username: currentUser?.username || 'System',
        customer_id: selectedCustomer?.id || null
      };

      setPendingSales(prev => [...prev, offlineSale]);
      
      setItems(prevItems => {
        const newItems = [...prevItems];
        cart.forEach(cartItem => {
          const itemIndex = newItems.findIndex(i => i.id === cartItem.id);
          if (itemIndex > -1) {
            newItems[itemIndex] = {
              ...newItems[itemIndex],
              stock: newItems[itemIndex].stock - cartItem.quantity
            };
          }
        });
        return newItems;
      });

      setLastSale({ 
        id: offlineId, 
        subtotal: cartSubtotal, 
        tax: cartTax, 
        total: finalTotal, 
        payment_method: paymentMethod,
        items: [...cart],
        discount: discountValue
      });
      setShowReceipt(true);
      setCart([]);
      setDiscount('');
      setSelectedCustomer(null);
      setCustomerSearchQuery('');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory) return;
    await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Username': currentUser?.username || 'System'
      },
      body: JSON.stringify({ name: newCategory })
    });
    setNewCategory('');
    fetchCategories();
  };

  const handleAddItem = async () => {
    const price = parseFloat(newItem.price);
    const costPrice = parseFloat(newItem.cost_price) || 0;
    const stock = parseInt(newItem.stock) || 0;
    const threshold = parseInt(newItem.low_stock_threshold) || 5;
    
    if (!newItem.name || isNaN(price)) {
      alert("Please enter a valid name and price");
      return;
    }

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify({
          ...newItem,
          price: price,
          cost_price: costPrice,
          category_id: newItem.category_id ? parseInt(newItem.category_id) : null,
          stock: stock,
          image_url: newItem.image_url,
          low_stock_threshold: threshold
        })
      });
      
      if (res.ok) {
        setNewItem({ name: '', price: '', category_id: '', sku: '', stock: '', image_url: '', low_stock_threshold: '5' });
        fetchItems();
      } else {
        const data = await res.json();
        alert("Failed to add item: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error adding item");
    }
  };

  const handleUpdatePreparationStatus = async (id: number, preparation_status: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify({ preparation_status }),
      });
      if (res.ok) {
        fetchPendingOrders();
      } else {
        alert('Failed to update preparation status');
      }
    } catch (err) {
      alert('Error updating preparation status');
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    const price = parseFloat(editingItem.price.toString());
    const costPrice = parseFloat(editingItem.cost_price?.toString() || '0');
    const stock = parseInt(editingItem.stock.toString());
    const threshold = parseInt(editingItem.low_stock_threshold?.toString() || '5');
    
    if (!editingItem.name || isNaN(price)) {
      alert("Please enter a valid name and price");
      return;
    }

    try {
      const res = await fetch(`/api/items/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': currentUser?.username || 'System'
        },
        body: JSON.stringify({
          ...editingItem,
          price: price,
          cost_price: costPrice,
          category_id: editingItem.category_id ? parseInt(editingItem.category_id.toString()) : null,
          stock: stock,
          image_url: editingItem.image_url,
          low_stock_threshold: threshold
        })
      });
      
      if (res.ok) {
        setEditingItem(null);
        fetchItems();
      } else {
        const data = await res.json();
        alert("Failed to update item: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error updating item");
    }
  };

  const fetchReportSummary = async () => {
    try {
      const branchParam = currentUser?.role === 'cashier' ? currentUser.branch_id : reportBranchId;
      const res = await fetch(`/api/reports/summary?type=${reportType}&date=${reportDate}&branch_id=${branchParam || ''}`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data = await res.json();
      setDayEndReport(data);
      return data;
    } catch (error) {
      console.error("Error fetching report summary:", error);
      return null;
    }
  };

  const fetchSalesHistory = async () => {
    try {
      const branchParam = currentUser?.role === 'cashier' ? currentUser.branch_id : reportBranchId;
      const res = await fetch(`/api/reports/sales?type=${reportType}&date=${reportDate}&branch_id=${branchParam || ''}`);
      if (!res.ok) throw new Error('Failed to fetch sales');
      const data = await res.json();
      setSalesHistory(data);
      return data;
    } catch (error) {
      console.error("Error fetching sales history:", error);
      return [];
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReportSummary();
      fetchSalesHistory();
    }
  }, [activeTab, reportType, reportDate, reportBranchId]);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === null || item.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const [printType, setPrintType] = useState<'receipt' | 'report' | null>(null);
  const [printTrigger, setPrintTrigger] = useState(0);

  const triggerPrint = () => {
    console.log("Triggering print...");
    setPrintTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (printTrigger > 0) {
      console.log("Print effect running, waiting for timeout...");
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        console.log("Calling window.print()");
        window.print();
        // Reset printing state after print dialog opens (or a bit later)
        setTimeout(() => setIsPrinting(false), 1000);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [printTrigger]);

  const handlePrintReceipt = () => {
    setPrintCopies(1);
    setShowPrintCopiesModal(true);
  };

  const executePrintReceipt = () => {
    setPrintType('receipt');
    setIsPrinting(true);
    triggerPrint();
    setShowPrintCopiesModal(false);
  };

  const handlePrintReport = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    
    try {
      // 1. Fetch latest data
      const [summaryData, salesData] = await Promise.all([
        fetchReportSummary(),
        fetchSalesHistory()
      ]);

      if (!summaryData) {
        throw new Error("Failed to load report data");
      }

      // 2. Set print type
      setPrintType('report');
      
      // 3. Trigger print
      triggerPrint();

    } catch (err) {
      console.error('Failed to prepare report:', err);
      alert("Failed to load report data. Please try again.");
      setIsPrinting(false);
    }
  };

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const summary = dayEndReport?.summary || [];
    const sales = salesHistory || [];
    
    doc.setFontSize(18);
    doc.text(settings.company_name || 'Modern POS', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Sales Report - ${new Date().toLocaleDateString()}`, 14, 30);
    
    // Summary Table
    autoTable(doc, {
      startY: 40,
      head: [['Payment Method', 'Transactions', 'Total Sales', 'Revenue']],
      body: summary.map(s => [
        s.payment_method,
        s.transaction_count,
        `${settings.currency || '₱'}${s.total_sales.toFixed(2)}`,
        `${settings.currency || '₱'}${s.total_revenue.toFixed(2)}`
      ]),
    });
    
    // Sales History Table
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Time', 'Branch', 'Method', 'Total', 'Status']],
      body: sales.map(s => [
        new Date(s.timestamp).toLocaleTimeString(),
        s.branch_name || 'Main',
        s.payment_method,
        `${settings.currency || '₱'}${s.total.toFixed(2)}`,
        s.status
      ]),
    });
    
    doc.save(`report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportCSV = () => {
    const summary = dayEndReport?.summary || [];
    const sales = salesHistory || [];
    
    // Export Sales History as CSV
    const csvData = sales.map(s => ({
      ID: s.id,
      Time: new Date(s.timestamp).toLocaleString(),
      Branch: s.branch_name || 'Main',
      Customer: s.customer_name || 'Walk-in',
      Method: s.payment_method,
      Subtotal: s.subtotal.toFixed(2),
      Tax: s.tax.toFixed(2),
      Discount: s.discount.toFixed(2),
      Total: s.total.toFixed(2),
      Status: s.status,
      CompletedBy: s.completed_by || ''
    }));
    
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sales-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} settings={settings} />;
  }

  return (
    <>
      <PrintStyles />
      <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 main-container no-print flex flex-col lg:flex-row">
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            onLogout={handleLogout} 
            currentUser={currentUser} 
            settings={settings}
            isOnline={isOnline}
            pendingSalesCount={pendingSales.length}
            isSyncing={isSyncing}
            syncPendingSales={syncPendingSales}
            isOpen={isSidebarOpen}
            setIsOpen={setIsSidebarOpen}
            newOrdersCount={newOrdersCount}
            setNewOrdersCount={setNewOrdersCount}
          />

        <main className="flex-1 overflow-auto relative flex flex-col">
          {/* Mobile Header */}
          <div className="lg:hidden p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 z-30">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 dark:text-slate-300">
              <Menu size={24} />
            </button>
            <h1 className="font-bold text-slate-900 dark:text-white truncate px-4">{settings.company_name || 'Modern POS'}</h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {isSyncing && <RefreshCw size={12} className="animate-spin text-indigo-600" />}
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              </div>
              {activeTab === 'pos' && (
                <button 
                  onClick={() => setShowMobileCart(!showMobileCart)}
                  className="relative p-2 text-indigo-600"
                >
                  <ShoppingCart size={24} />
                  {cart.length > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800">
                      {cart.reduce((acc, item) => acc + item.quantity, 0)}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
          {activeTab === 'admin' && currentUser?.role === 'admin' && (
             <div className="p-4 lg:p-8 space-y-8">
               <AdminPanel onUpdatePaymentMethods={fetchPaymentMethods} currentUser={currentUser} />
               <SettingsPanel settings={settings} onUpdate={setSettings} currentUser={currentUser} />
             </div>
          )}
          {activeTab === 'logs' && currentUser?.role === 'admin' && (
             <div className="p-4 lg:p-8">
               <AuditLogs />
             </div>
          )}
          {activeTab === 'pending_orders' && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6 lg:space-y-8"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl lg:text-3xl font-black tracking-tight flex items-center gap-3">
                  <Bell size={28} className="text-indigo-600" />
                  Pending Orders
                </h2>
                <button 
                  onClick={() => fetchPendingOrders(false)}
                  className="btn btn-secondary flex items-center gap-2 text-sm"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingOrders.length === 0 ? (
                  <div className="col-span-full p-8 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    No pending orders at the moment.
                  </div>
                ) : (
                  pendingOrders.map(order => (
                    <div key={order.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Order #{order.id}</span>
                          <span className="font-bold text-lg">{settings.currency || '₱'}{order.total.toFixed(2)}</span>
                        </div>
                        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg uppercase tracking-wider">
                          Pending
                        </span>
                      </div>

                      {order.preparation_status && (
                        <div className="mb-4">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Preparation Status</span>
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            order.preparation_status === 'ready' ? 'bg-emerald-100 text-emerald-600' :
                            order.preparation_status === 'preparing' ? 'bg-amber-100 text-amber-600' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {order.preparation_status}
                          </span>
                        </div>
                      )}
                      
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-1">
                        <p className="mb-2"><span className="font-semibold text-xs uppercase tracking-wider text-slate-500 block mb-0.5">Time:</span> {new Date(order.timestamp).toLocaleString()}</p>
                        {order.customer_name && (
                          <div className="mb-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                              <User size={14} className="text-indigo-600" />
                              {order.customer_name}
                            </p>
                            {order.customer_address && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                                <MapPin size={12} className="mt-0.5 shrink-0" />
                                {order.customer_address}
                              </p>
                            )}
                          </div>
                        )}
                        <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                          <p className="font-semibold mb-1 text-xs uppercase tracking-wider text-slate-500">Items:</p>
                          <ul className="space-y-1">
                            {order.items?.map((item: any) => (
                              <li key={item.id} className="flex justify-between text-xs">
                                <span>{item.quantity}x {item.name}</span>
                                <span>{settings.currency || '₱'}{(item.price_at_sale * item.quantity).toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <button 
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/orders/${order.id}/status`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                status: 'completed', 
                                completed_by: currentUser?.username,
                                branch_id: currentUser?.branch_id
                              })
                            });
                            if (res.ok) {
                              fetchPendingOrders(false);
                              setNewOrdersCount(Math.max(0, newOrdersCount - 1));
                              // Set last sale to this order so we can print it
                              setLastSale({
                                id: order.id,
                                subtotal: order.subtotal,
                                tax: order.tax,
                                total: order.total,
                                payment_method: order.payment_method,
                                items: order.items,
                                discount: order.discount || 0
                              });
                              // Show print copies modal
                              setPrintCopies(1);
                              setShowPrintCopiesModal(true);
                            }
                          } catch (err) {
                            console.error("Failed to complete order");
                          }
                        }}
                        className={`w-full py-2 rounded-xl font-bold text-sm transition-all shadow-lg mt-auto flex items-center justify-center ${
                          order.preparation_status === 'ready' 
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                        }`}
                      >
                        <CheckCircle2 size={16} className="mr-2" />
                        {order.preparation_status === 'ready' ? 'Complete & Print (Ready)' : 'Mark Completed'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'pos' && (
            <motion.div 
              key="pos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col lg:flex-row h-full overflow-hidden"
            >
              {/* Items Grid */}
              <div className="flex-1 p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 overflow-hidden">
                {currentUser?.role === 'callcenter' && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex items-center gap-4">
                    <MapPin className="text-indigo-600 dark:text-indigo-400" size={24} />
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase mb-1 tracking-wider">Select Branch for Order</label>
                      <select 
                        className="input w-full max-w-md text-sm border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : '')}
                      >
                        <option value="" disabled>-- Select a Branch --</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search items or scan SKU..." 
                      className="input pl-10 h-12 text-lg w-full"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:max-w-md no-scrollbar">
                    <button 
                      onClick={() => setSelectedCategory(null)}
                      className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                        selectedCategory === null ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      All
                    </button>
                    {categories.map(cat => (
                      <button 
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                          selectedCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4 content-start pb-20 lg:pb-0">
                  {filteredItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="card p-3 lg:p-4 text-left hover:border-indigo-500 hover:shadow-md transition-all group"
                    >
                      <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg mb-2 lg:mb-3 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Tag size={32} />
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white truncate text-sm lg:text-base">{item.name}</h3>
                      <p className="text-[10px] lg:text-xs text-slate-500 dark:text-slate-400 mb-1 lg:mb-2">{item.category_name || 'No Category'}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-indigo-600 font-bold text-sm lg:text-base">{settings.currency || '₱'}{item.price.toFixed(2)}</span>
                        <span className={`text-[8px] lg:text-[10px] px-1 lg:px-1.5 py-0.5 rounded ${
                          item.stock > (item.low_stock_threshold || 5) ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {item.stock}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart Sidebar (Desktop) & Drawer (Mobile) */}
              <div className={`
                fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col shadow-2xl dark:shadow-none transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                ${showMobileCart ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
              `}>
                <div className="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2">
                    <ShoppingCart size={24} className="text-indigo-600" />
                    Current Order
                  </h2>
                  <button onClick={() => setShowMobileCart(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
                    <X size={24} />
                  </button>
                </div>
                  
                  {/* Customer Selection */}
                  <div className="relative">
                    {selectedCustomer ? (
                      <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                            <User size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">{selectedCustomer.name}</p>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400">{selectedCustomer.phone || 'No phone'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setNewCustomer({ 
                                name: selectedCustomer.name, 
                                phone: selectedCustomer.phone || '', 
                                email: selectedCustomer.email || '', 
                                address: selectedCustomer.address || '' 
                              });
                              setIsEditingCustomer(true);
                              setShowCustomerModal(true);
                            }}
                            className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded-full text-indigo-600"
                            title="Edit Customer"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => setSelectedCustomer(null)}
                            className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded-full text-indigo-600"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="text"
                            placeholder="Search customer..."
                            className="input w-full pl-10 pr-16 text-sm"
                            value={customerSearchQuery}
                            onChange={e => setCustomerSearchQuery(e.target.value)}
                          />
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {customerSearchQuery && (
                              <button 
                                onClick={() => setCustomerSearchQuery('')}
                                className="p-1 text-slate-400 hover:text-slate-600"
                              >
                                <X size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => setShowCustomerModal(true)}
                              className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                              title="Add New Customer"
                            >
                              <UserPlus size={14} />
                            </button>
                          </div>
                        </div>
                        
                        {customerSearchQuery.length >= 2 && customers.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                            {customers.map(customer => (
                              <button
                                key={customer.id}
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setCustomerSearchQuery('');
                                  setCustomers([]);
                                }}
                                className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                              >
                                <p className="font-bold text-sm text-slate-900 dark:text-white">{customer.name}</p>
                                <p className="text-xs text-slate-500">{customer.phone || 'No phone'}</p>
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {customerSearchQuery.length >= 2 && customers.length === 0 && !isSearchingCustomers && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-4 text-center">
                            <p className="text-sm text-slate-500">No customers found</p>
                            <button 
                              onClick={() => {
                                setNewCustomer({ name: customerSearchQuery, phone: '', email: '', address: '' });
                                setShowCustomerModal(true);
                              }}
                              className="text-xs text-indigo-600 font-bold mt-2 hover:underline"
                            >
                              + Add "{customerSearchQuery}" as new customer
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto p-4 space-y-4">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-4">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center">
                        <ShoppingCart size={32} />
                      </div>
                      <p className="font-medium">Your cart is empty</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="flex gap-3 items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                        {item.image_url && (
                          <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded-lg" referrerPolicy="no-referrer" />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 dark:text-white truncate">{item.name}</h4>
                          <p className="text-sm text-indigo-600 font-medium">{settings.currency || '₱'}{item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                            <Plus size={14} />
                          </button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Subtotal</span>
                      <span>{settings.currency || '₱'}{cartSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>VAT ({settings.tax_rate}%)</span>
                      <span>{settings.currency || '₱'}{cartTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Discount</span>
                      <input 
                        type="number" 
                        value={discount} 
                        onChange={e => setDiscount(e.target.value)} 
                        className="w-20 text-right input py-1" 
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex justify-between text-2xl font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span>Total</span>
                      <span>{settings.currency || '₱'}{Math.max(0, cartTotal - (parseFloat(discount) || 0)).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {paymentMethods.map((method) => (
                      <button 
                        key={method.id}
                        disabled={cart.length === 0}
                        onClick={() => handleCheckout(method.name)}
                        className={`btn text-white flex flex-col items-center py-4 gap-1 ${
                          method.name.toLowerCase() === 'cash' 
                            ? 'bg-emerald-600 hover:bg-emerald-700' 
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        <span className="text-lg font-bold capitalize">{method.name}</span>
                        <span className="text-[10px] opacity-80 uppercase tracking-wider">Checkout</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'inventory' && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6 lg:space-y-8"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                  <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">Inventory Management</h2>
                  <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400">Manage your products and categories</p>
                </div>
                <button 
                  onClick={() => exportToCSV(items, 'inventory.csv', ['name', 'sku', 'price', 'stock', 'category_name'])}
                  className="btn btn-secondary w-full sm:w-auto"
                >
                  Export CSV
                </button>
              </div>

              {items.some(item => item.stock <= (item.low_stock_threshold || 5)) && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 lg:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                      <ShieldAlert size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-red-900 dark:text-red-100">Low Stock Alerts</h3>
                      <p className="text-sm text-red-600 dark:text-red-400">The following items are running low on stock</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.filter(item => item.stock <= (item.low_stock_threshold || 5)).map(item => (
                      <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-red-100 dark:border-red-900/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {item.image_url && <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded" referrerPolicy="no-referrer" />}
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">Threshold: {item.low_stock_threshold || 5}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-red-600">{item.stock}</div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Left</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Add Item Form */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="card p-4 lg:p-6">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Plus size={20} className="text-indigo-600" />
                      Add New Item
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Item Name</label>
                        <input 
                          type="text" 
                          className="input" 
                          placeholder="e.g. Organic Coffee Beans" 
                          value={newItem.name}
                          onChange={e => setNewItem({...newItem, name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Price ({settings.currency || '₱'})</label>
                        <input 
                          type="number" 
                          className="input" 
                          placeholder="0.00" 
                          value={newItem.price}
                          onChange={e => setNewItem({...newItem, price: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Cost Price ({settings.currency || '₱'})</label>
                        <input 
                          type="number" 
                          className="input" 
                          placeholder="0.00" 
                          value={newItem.cost_price}
                          onChange={e => setNewItem({...newItem, cost_price: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Category</label>
                        <select 
                          className="input"
                          value={newItem.category_id}
                          onChange={e => setNewItem({...newItem, category_id: e.target.value})}
                        >
                          <option value="">Select Category</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">SKU / Barcode</label>
                        <input 
                          type="text" 
                          className="input" 
                          placeholder="Unique ID" 
                          value={newItem.sku}
                          onChange={e => setNewItem({...newItem, sku: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Initial Stock</label>
                        <input 
                          type="number" 
                          className="input" 
                          placeholder="0" 
                          value={newItem.stock}
                          onChange={e => setNewItem({...newItem, stock: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Low Stock Alert</label>
                        <input 
                          type="number" 
                          className="input" 
                          placeholder="5" 
                          value={newItem.low_stock_threshold}
                          onChange={e => setNewItem({...newItem, low_stock_threshold: e.target.value})}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Product Image</label>
                        <div className="flex gap-2 items-center">
                          {newItem.image_url && <img src={newItem.image_url} alt="Preview" className="h-10 w-10 object-cover rounded border border-slate-200 dark:border-slate-700" />}
                          <input 
                            type="file" 
                            accept="image/*"
                            className="input text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" 
                            onChange={async (e) => {
                              if (e.target.files?.[0]) {
                                try {
                                  const url = await uploadImage(e.target.files[0]);
                                  setNewItem({...newItem, image_url: url});
                                } catch (err) {
                                  alert('Failed to upload image');
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <button onClick={handleAddItem} className="btn btn-primary w-full mt-6">Add Item to Inventory</button>
                  </div>

                  <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[600px]">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Item</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Cost</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Price</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {items.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-sm">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  {item.image_url && (
                                    <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                                  )}
                                  <div>
                                    <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-tight">{item.sku || 'No SKU'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">{item.category_name || '-'}</td>
                              <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">{settings.currency || '₱'}{item.cost_price.toFixed(2)}</td>
                              <td className="px-6 py-4 text-right font-bold text-indigo-600 whitespace-nowrap">{settings.currency || '₱'}{item.price.toFixed(2)}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                    item.stock > (item.low_stock_threshold || 5) 
                                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' 
                                      : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                  }`}>
                                    {item.stock}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => setAdjustStockItem(item)}
                                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
                                      title="Adjust Stock"
                                    >
                                      <Plus size={14} />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setStockHistoryItem(item);
                                        fetchStockHistory(item.id);
                                      }}
                                      className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg text-amber-500 transition-colors"
                                      title="Stock History"
                                    >
                                      <History size={14} />
                                    </button>
                                    <button 
                                      onClick={() => setEditingItem(item)}
                                      className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-indigo-500 transition-colors"
                                      title="Edit Item"
                                    >
                                      <Edit size={14} />
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Categories Management */}
                <div className="space-y-6">
                  <div className="card p-6">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Plus size={20} className="text-indigo-600" />
                      Add Category
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Category Name</label>
                        <input 
                          type="text" 
                          className="input" 
                          placeholder="e.g. Beverages" 
                          value={newCategory}
                          onChange={e => setNewCategory(e.target.value)}
                        />
                      </div>
                      <button onClick={handleAddCategory} className="btn btn-secondary w-full">Create Category</button>
                    </div>
                  </div>

                  <div className="card p-6">
                    <h3 className="text-lg font-bold mb-4">All Categories</h3>
                    <div className="space-y-2">
                      {categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                          <span className="font-medium text-slate-700 dark:text-slate-200">{cat.name}</span>
                          <span className="text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
                            {items.filter(i => i.category_id === cat.id).length} items
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'inventory_report' && (
            <InventoryReport data={inventoryReportData} settings={settings} categories={categories} />
          )}

          {activeTab === 'kds' && (
            <KDSPanel 
              orders={pendingOrders} 
              onUpdateStatus={handleUpdatePreparationStatus} 
              currentUser={currentUser} 
              isSoundEnabled={isSoundEnabled}
              setIsSoundEnabled={setIsSoundEnabled}
              onTestSound={playAlertSound}
            />
          )}

          {activeTab === 'customers' && (
            <motion.div 
              key="customers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 overflow-auto"
            >
              <CustomersSection currentUser={currentUser} settings={settings} />
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6 lg:space-y-8"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="flex-1">
                  <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">Sales & Reports</h2>
                  <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400">Track your business performance</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch sm:items-end">
                  {(currentUser?.role === 'admin' || currentUser?.role === 'callcenter') && (
                    <div className="flex flex-col gap-1 flex-1 sm:flex-none">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Branch</label>
                      <select 
                        className="input py-2 px-3 text-sm"
                        value={reportBranchId}
                        onChange={(e) => setReportBranchId(e.target.value ? Number(e.target.value) : '')}
                      >
                        <option value="">All Branches</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 flex-1 sm:flex-none">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</label>
                    <select 
                      className="input py-2 px-3 text-sm"
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value as any)}
                    >
                      <option value="day">Daily</option>
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 flex-1 sm:flex-none">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</label>
                    <input 
                      type={reportType === 'day' ? 'date' : reportType === 'month' ? 'month' : 'number'} 
                      className="input py-2 px-3 text-sm"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      placeholder={reportType === 'year' ? 'YYYY' : undefined}
                      min={reportType === 'year' ? '2000' : undefined}
                      max={reportType === 'year' ? '2100' : undefined}
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={handlePrintReport}
                      disabled={isPrinting}
                      className="btn btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed py-2"
                    >
                      <Printer size={16} />
                      <span className="text-sm">{isPrinting ? '...' : 'Print'}</span>
                    </button>
                    <button 
                      onClick={handleExportPDF}
                      className="btn btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2 py-2"
                    >
                      <FileText size={16} />
                      <span className="text-sm">PDF</span>
                    </button>
                    <button 
                      onClick={handleExportCSV}
                      className="btn btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2 py-2"
                    >
                      <FileSpreadsheet size={16} />
                      <span className="text-sm">CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Day End Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                <div className="card p-6 bg-indigo-600 text-white border-none shadow-xl dark:shadow-none shadow-indigo-100 sm:col-span-2 lg:col-span-1">
                  <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-wider mb-1">
                    {reportType === 'day' ? "Today's" : reportType === 'month' ? "This Month's" : "This Year's"} Total Sales
                  </p>
                  <h3 className="text-3xl lg:text-4xl font-bold">
                    {settings.currency || '₱'}{(dayEndReport?.summary || []).reduce((a, b) => a + (b.total_sales || 0), 0).toFixed(2)}
                  </h3>
                  <div className="mt-4 flex items-center gap-2 text-indigo-100 text-xs">
                    <History size={14} />
                    <span>{(dayEndReport?.summary || []).reduce((a, b) => a + (b.transaction_count || 0), 0)} Transactions</span>
                  </div>
                </div>

                {dayEndReport?.summary?.map(s => (
                  <div key={s.payment_method} className="card p-4 lg:p-6">
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">{s.payment_method} Sales</p>
                    <h3 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">{settings.currency || '₱'}{(s.total_sales || 0).toFixed(2)}</h3>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-2">{s.transaction_count} Transactions</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                {/* Top Selling Items */}
                <div className="card overflow-hidden">
                  <div className="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold">Top Selling Items ({reportType})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[300px]">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        <tr>
                          <th className="px-4 lg:px-6 py-3">Item</th>
                          <th className="px-4 lg:px-6 py-3 text-center">Qty</th>
                          <th className="px-4 lg:px-6 py-3 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {(dayEndReport?.items || []).map((item, idx) => (
                          <tr key={idx} className="text-sm lg:text-base">
                            <td className="px-4 lg:px-6 py-4 font-medium text-slate-900 dark:text-white truncate max-w-[150px]">{item.name}</td>
                            <td className="px-4 lg:px-6 py-4 text-center text-slate-600 dark:text-slate-300">{item.total_quantity}</td>
                            <td className="px-4 lg:px-6 py-4 text-right font-bold text-indigo-600">{settings.currency || '₱'}{(item.total_revenue || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                        {(!dayEndReport?.items || dayEndReport.items.length === 0) && (
                          <tr>
                            <td colSpan={3} className="px-4 lg:px-6 py-12 text-center text-slate-400 dark:text-slate-500">No sales recorded today</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="card overflow-hidden">
                  <div className="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold">Recent Transactions</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[400px]">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        <tr>
                          <th className="px-4 lg:px-6 py-3">Time</th>
                          <th className="px-4 lg:px-6 py-3">Branch</th>
                          <th className="px-4 lg:px-6 py-3">Method</th>
                          <th className="px-4 lg:px-6 py-3">Completed By</th>
                          <th className="px-4 lg:px-6 py-3 text-right">Total</th>
                          <th className="px-4 lg:px-6 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {salesHistory.slice(0, 10).map(sale => (
                          <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm">
                            <td className="px-4 lg:px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-slate-600 dark:text-slate-300">
                              <div className="flex flex-col">
                                <span className="font-medium">{sale.branch_name || 'Main'}</span>
                                {sale.completed_at_branch_name && sale.completed_at_branch_name !== sale.branch_name && (
                                  <span className="text-[10px] text-slate-400 italic">via {sale.completed_at_branch_name}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 lg:px-6 py-4">
                              <span className="uppercase text-[10px] font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {sale.payment_method}
                              </span>
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-slate-600 dark:text-slate-300">
                              {sale.completed_by ? (
                                <span className="flex items-center gap-1 text-xs">
                                  <CheckCircle2 size={12} className="text-emerald-500" />
                                  {sale.completed_by}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`font-bold ${sale.status === 'voided' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                  {settings.currency || '₱'}{(sale.total || 0).toFixed(2)}
                                </span>
                                {sale.status !== 'completed' && (
                                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                    sale.status === 'refunded' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 
                                    'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                  }`}>
                                    {sale.status}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-right">
                              <button 
                                onClick={() => {
                                  setSelectedSale(sale);
                                  fetchSaleItems(sale.id);
                                }}
                                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold text-[10px] uppercase tracking-wider"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && lastSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm no-print">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl dark:shadow-none max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold">Sale Successful</h3>
                <button onClick={() => setShowReceipt(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 bg-slate-50 dark:bg-slate-900 flex justify-center">
                <div id="thermal-receipt" className="bg-white dark:bg-slate-800 shadow-lg">
                   <Receipt sale={lastSale} items={lastSale.items} settings={settings} branches={branches} />
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <button 
                  onClick={handlePrintReceipt}
                  className="btn btn-primary flex items-center justify-center gap-2"
                >
                  <Printer size={18} />
                  Print Receipt
                </button>
                <button 
                  onClick={() => setShowReceipt(false)}
                  className="btn btn-secondary"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </div>

      {/* Stock Adjustment Modal */}
      <AnimatePresence>
        {adjustStockItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4"
            >
              <h3 className="text-xl font-bold">Adjust Stock: {adjustStockItem.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Current Stock: {adjustStockItem.stock}</p>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Adjustment Amount (+/-)</label>
                <input 
                  type="number" 
                  className="input w-full" 
                  placeholder="e.g. 5 or -5" 
                  value={adjustmentAmount}
                  onChange={e => setAdjustmentAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Reason (Optional)</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  placeholder="e.g. Damaged, Restock" 
                  value={adjustmentReason}
                  onChange={e => setAdjustmentReason(e.target.value)}
                />
              </div>
              <div className="flex gap-4 mt-6">
                <button onClick={() => setAdjustStockItem(null)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleAdjustStock} className="btn btn-primary flex-1">Adjust Stock</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Item Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl dark:shadow-none max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold">Edit Item</h3>
                <button onClick={() => setEditingItem(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200">
                  <ChevronRight size={24} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Item Name</label>
                  <input 
                    type="text" 
                    className="input w-full" 
                    value={editingItem.name}
                    onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Price</label>
                  <input 
                    type="number" 
                    className="input w-full" 
                    value={editingItem.price}
                    onChange={e => setEditingItem({...editingItem, price: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Cost Price</label>
                  <input 
                    type="number" 
                    className="input w-full" 
                    value={editingItem.cost_price || 0}
                    onChange={e => setEditingItem({...editingItem, cost_price: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Category</label>
                  <select 
                    className="input w-full"
                    value={editingItem.category_id || ''}
                    onChange={e => setEditingItem({...editingItem, category_id: e.target.value})}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">SKU / Barcode</label>
                  <input 
                    type="text" 
                    className="input w-full" 
                    value={editingItem.sku || ''}
                    onChange={e => setEditingItem({...editingItem, sku: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Stock</label>
                  <input 
                    type="number" 
                    className="input w-full" 
                    value={editingItem.stock}
                    onChange={e => setEditingItem({...editingItem, stock: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Low Stock Threshold</label>
                  <input 
                    type="number" 
                    className="input w-full" 
                    value={editingItem.low_stock_threshold || ''}
                    onChange={e => setEditingItem({...editingItem, low_stock_threshold: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Product Image</label>
                  <div className="flex gap-2 items-center">
                    {editingItem.image_url && <img src={editingItem.image_url} alt="Preview" className="h-10 w-10 object-cover rounded border border-slate-200 dark:border-slate-700" />}
                    <input 
                      type="file" 
                      accept="image/*"
                      className="input w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" 
                      onChange={async (e) => {
                        if (e.target.files?.[0]) {
                          try {
                            const url = await uploadImage(e.target.files[0]);
                            setEditingItem({...editingItem, image_url: url});
                          } catch (err) {
                            alert('Failed to upload image');
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-700">
                <button 
                  onClick={handleUpdateItem}
                  className="btn btn-primary"
                >
                  Save Changes
                </button>
                <button 
                  onClick={() => setEditingItem(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock History Modal */}
      <AnimatePresence>
        {stockHistoryItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-4">
                <div>
                  <h3 className="text-xl font-bold">Stock History: {stockHistoryItem.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">SKU: {stockHistoryItem.sku || 'N/A'}</p>
                </div>
                <button onClick={() => setStockHistoryItem(null)} className="text-slate-400 hover:text-slate-600">
                  <ChevronRight size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                {loadingHistory ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : stockHistory.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No adjustment history found for this item.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                      <tr>
                        <th className="py-3 text-xs font-bold text-slate-500 uppercase">Date & Time</th>
                        <th className="py-3 text-xs font-bold text-slate-500 uppercase">User</th>
                        <th className="py-3 text-xs font-bold text-slate-500 uppercase text-right">Adjustment</th>
                        <th className="py-3 text-xs font-bold text-slate-500 uppercase px-4">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                      {stockHistory.map(log => (
                        <tr key={log.id} className="text-sm">
                          <td className="py-3 text-slate-600 dark:text-slate-400">
                            {new Date(log.timestamp).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-3 font-medium text-slate-900 dark:text-white">{log.username || 'System'}</td>
                          <td className={`py-3 text-right font-bold ${log.adjustment > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {log.adjustment > 0 ? `+${log.adjustment}` : log.adjustment}
                          </td>
                          <td className="py-3 px-4 text-slate-500 italic">{log.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <button onClick={() => setStockHistoryItem(null)} className="btn btn-secondary w-full">Close History</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sale Details Modal */}
      <AnimatePresence>
        {selectedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl dark:shadow-none max-w-2xl w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Sale #{selectedSale.id}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {new Date(selectedSale.timestamp).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => setSelectedSale(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200">
                  <ChevronRight size={24} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <span className="uppercase text-xs font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {selectedSale.payment_method}
                      </span>
                      <span className={`uppercase text-xs font-bold px-2 py-1 rounded ${
                        selectedSale.status === 'completed' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                        selectedSale.status === 'refunded' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {selectedSale.status}
                      </span>
                    </div>
                    {selectedSale.customer_name && (
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <User size={12} />
                          <span className="font-medium">{selectedSale.customer_name}</span>
                          {selectedSale.customer_phone && <span>• {selectedSale.customer_phone}</span>}
                        </div>
                        {selectedSale.customer_address && (
                          <div className="flex items-start gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 pl-3.5">
                            <MapPin size={10} className="mt-0.5 shrink-0" />
                            <span>{selectedSale.customer_address}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-1 mt-2">
                      {selectedSale.branch_name && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <Store size={10} />
                          <span>Origin: {selectedSale.branch_name}</span>
                        </div>
                      )}
                      {selectedSale.completed_by && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <CheckCircle2 size={10} className="text-emerald-500" />
                          <span className="font-medium">
                            Completed by: {selectedSale.completed_by} 
                            {selectedSale.completed_at_branch_name && ` (${selectedSale.completed_at_branch_name})`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Total Amount</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {settings.currency || '₱'}{(selectedSale.total || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {selectedSale.status_reason && (
                  <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Reason for {selectedSale.status}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{selectedSale.status_reason}</p>
                  </div>
                )}

                <table className="w-full text-left mb-6">
                  <thead className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                    <tr>
                      <th className="py-3">Item</th>
                      <th className="py-3 text-center">Qty</th>
                      <th className="py-3 text-right">Price</th>
                      <th className="py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {loadingSaleItems ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">Loading items...</td>
                      </tr>
                    ) : selectedSaleItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-4">
                          <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.sku}</p>
                        </td>
                        <td className="py-4 text-center text-slate-600 dark:text-slate-400">{item.quantity}</td>
                        <td className="py-4 text-right text-slate-600 dark:text-slate-400">{settings.currency || '₱'}{(item.price || 0).toFixed(2)}</td>
                        <td className="py-4 text-right font-bold text-slate-900 dark:text-white">{settings.currency || '₱'}{((item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {selectedSale.status === 'completed' && (
                  <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-700">
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Reason for Refund/Void</label>
                      <textarea 
                        className="input w-full h-20 resize-none" 
                        placeholder="Enter reason here..."
                        value={statusReason}
                        onChange={e => setStatusReason(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => handleRefundSale(selectedSale.id)}
                        className="btn bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50 border-none"
                      >
                        Refund Sale
                      </button>
                      <button 
                        onClick={() => handleVoidSale(selectedSale.id)}
                        className="btn bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 border-none"
                      >
                        Void Sale
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Customer Modal */}
      <AnimatePresence>
        {showCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  {isEditingCustomer ? (
                    <>
                      <Edit className="text-indigo-600" size={24} />
                      Edit Customer
                    </>
                  ) : (
                    <>
                      <UserPlus className="text-indigo-600" size={24} />
                      Add New Customer
                    </>
                  )}
                </h3>
                <button onClick={() => { setShowCustomerModal(false); setIsEditingCustomer(false); }} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={isEditingCustomer ? handleUpdateCustomer : handleCreateCustomer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      className="input w-full pl-10" 
                      value={newCustomer.name}
                      onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                      required
                      placeholder="John Doe"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="tel" 
                      className="input w-full pl-10" 
                      value={newCustomer.phone}
                      onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                      placeholder="0912 345 6789"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="email" 
                      className="input w-full pl-10" 
                      value={newCustomer.email}
                      onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <textarea 
                      className="input w-full pl-10 h-20 resize-none pt-2" 
                      value={newCustomer.address}
                      onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                      placeholder="123 Street, City"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => { setShowCustomerModal(false); setIsEditingCustomer(false); }}
                    className="btn flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 border-none"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary flex-1">
                    {isEditingCustomer ? 'Update Customer' : 'Save Customer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Copies Modal */}
      <AnimatePresence>
        {showPrintCopiesModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Printer size={24} className="text-indigo-600" />
                  Print Receipt
                </h3>
                <button onClick={() => setShowPrintCopiesModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="text-center">
                  <p className="text-slate-500 dark:text-slate-400 mb-4">How many copies would you like to print?</p>
                  <div className="flex items-center justify-center gap-6">
                    <button 
                      onClick={() => setPrintCopies(Math.max(1, printCopies - 1))}
                      className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      -
                    </button>
                    <span className="text-4xl font-bold w-12 text-center">{printCopies}</span>
                    <button 
                      onClick={() => setPrintCopies(printCopies + 1)}
                      className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowPrintCopiesModal(false)}
                    className="btn flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 border-none"
                  >
                    Skip
                  </button>
                  <button 
                    onClick={executePrintReceipt}
                    className="btn btn-primary flex-1"
                  >
                    Print {printCopies} {printCopies === 1 ? 'Copy' : 'Copies'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Print Content Area - Always rendered to ensure availability for print */}
      <div className="print-only">
        {printType === 'receipt' && lastSale && Array.from({ length: printCopies }).map((_, i) => (
          <div key={i} className={i < printCopies - 1 ? 'page-break' : ''}>
            <Receipt sale={lastSale} items={lastSale.items} settings={settings} branches={branches} />
          </div>
        ))}
        
        {printType === 'report' && (
          dayEndReport ? (
            <ReportPrint 
              report={dayEndReport} 
              salesHistory={salesHistory} 
              settings={settings} 
              type={reportType} 
              date={reportDate} 
            />
          ) : (
            <div className="p-4 text-center font-bold text-red-500">
              ERROR: Report data not loaded.
            </div>
          )
        )}
      </div>
    </>
  );
}
