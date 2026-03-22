import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Search, Plus, BarChart3, ShoppingCart, X, Trash2,
    CheckCircle2, TrendingUp, CreditCard, Wallet, UserMinus,
    ArrowRight, Minus, Edit3, Receipt, Calendar,
    RotateCcw, Download, Upload, Layers, Bell, Info, ArrowUpRight, Clock, ShieldAlert, Filter, User, CloudDownload,
    ChevronLeft, ChevronRight, NotebookPen, ClipboardList, Share2, Sparkles, ListOrdered, Calculator, ScanLine, Camera, Package, ShoppingCartPlus
} from 'lucide-react';
import { db } from './db';
import { Medicine, ViewType, Sale, CartItem, Expense, Customer, AppNotification, WantedItem, Pharmacy, Note } from './types';

// Supabase Configuration has been moved to db.ts

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('raha_pro_activated') === 'true');
    const [loginCode, setLoginCode] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasInitialSynced, setHasInitialSynced] = useState(false);
    const [showSupportDialog, setShowSupportDialog] = useState(false);

    const [view, setView] = useState<ViewType>('pos');
    const [currentPharmacy, setCurrentPharmacy] = useState<Pharmacy | null>(null);
    const [isLoginSheetOpen, setIsLoginSheetOpen] = useState(false);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [notifs, setNotifs] = useState<AppNotification[]>([]);
    const [wantedItems, setWantedItems] = useState<WantedItem[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [activeNotif, setActiveNotif] = useState<AppNotification | null>(null);
    const [isSuspended, setIsSuspended] = useState(false);
    const [activationData, setActivationData] = useState({ key: '', password: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [invSearchQuery, setInvSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('الكل');
    // Inventory Filters
    const [invStockFilter, setInvStockFilter] = useState<'all' | 'low' | 'out' | 'stagnant'>('all');
    const [invExpiryFilter, setInvExpiryFilter] = useState<'all' | 'expired' | 'near'>('all');
    const [invSupplierFilter, setInvSupplierFilter] = useState('الكل');
    const [invCategoryFilter, setInvCategoryFilter] = useState('الكل');
    const [invDateFilter, setInvDateFilter] = useState('');
    // Accounting Filters (Updated)
    const [accDateFilter, setAccDateFilter] = useState(new Date().toISOString().split('T')[0]);
    const [accPaymentFilter, setAccPaymentFilter] = useState<'all' | 'cash' | 'bank' | 'debt'>('all');
    // Expenses Filters (Date Range)
    const [expStartDate, setExpStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [expEndDate, setExpEndDate] = useState(new Date().toISOString().split('T')[0]);
    // POS & Modals
    const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingMed, setEditingMed] = useState<Medicine | null>(null);
    const [payData, setPayData] = useState({ discount: '', cash: '', bank: '', debt: '', trx: '', cust: '' });

    // Wanted List Modals
    const [isWantedOpen, setIsWantedOpen] = useState(false);
    const [isWantedListOpen, setIsWantedListOpen] = useState(false);
    const [wantedData, setWantedData] = useState({ name: '', note: '', reminder: '' });
    
    // Calculator State
    const [calcDisplay, setCalcDisplay] = useState('0');
    const [calcPreviousValue, setCalcPreviousValue] = useState<number | null>(null);
    const [calcOperation, setCalcOperation] = useState<string | null>(null);
    const [calcWaitingForNewValue, setCalcWaitingForNewValue] = useState(false);
    
    // Enhanced Accounting Filters State
    const [showReturns, setShowReturns] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [showResetHistory, setShowResetHistory] = useState(false);
    
    // Scanner State
    const [isScannerActive, setIsScannerActive] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState('');
    const [scannerMode, setScannerMode] = useState<'sell' | 'add'>('sell');
    const [foundMedicine, setFoundMedicine] = useState<Medicine | null>(null);
    const [showScannerResult, setShowScannerResult] = useState(false);
    
    // Notes State
    const [notesFilter, setNotesFilter] = useState<'all' | 'private' | 'public'>('all');
    const [notesDateFilter, setNotesDateFilter] = useState('');
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [noteData, setNoteData] = useState({ title: '', content: '', type: 'private' as 'private' | 'public' });
    
    // Undo State
    const [lastAction, setLastAction] = useState<any>(null);
    const [showUndoToast, setShowUndoToast] = useState(false);

    // Multi-Select & Advanced Debt
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [accSearchQuery, setAccSearchQuery] = useState('');
    const [debtorDetailName, setDebtorDetailName] = useState<string | null>(null);
    const [selectionTimer, setSelectionTimer] = useState<NodeJS.Timeout | null>(null);

    // Enhanced Wanted List States
    const [isOrderAggregatorOpen, setIsOrderAggregatorOpen] = useState(false);
    const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
    const [selectedWantedItem, setSelectedWantedItem] = useState<WantedItem | null>(null);
    const [aggregatorSupplier, setAggregatorSupplier] = useState({ name: '', phone: '' });

    // Admin Lock System
    const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
    const [unlockAttempts, setUnlockAttempts] = useState(0);
    const [isUnlockSheetOpen, setIsUnlockSheetOpen] = useState(false);
    const [unlockCode, setUnlockCode] = useState('');

    // Raha Pro Optimization: Memoized trigger for dynamic notifications
    const triggerNotif = useCallback(async (message: string, type: 'warning' | 'error' | 'info' = 'info') => {
        const n: AppNotification = {
            id: crypto.randomUUID(),
            pharmacyId: currentPharmacy?.id,
            message,
            type,
            timestamp: Date.now()
        };
        await db.notifications.add(n);
        setActiveNotif(n);
        setTimeout(() => setActiveNotif(null), 4000);
        const allN = await db.notifications.orderBy('timestamp').reverse().toArray();
        setNotifs(allN);
    }, [currentPharmacy]);

    const handleAdminUnlock = useCallback((code: string) => {
        if (!currentPharmacy) return;
        const masterKey = currentPharmacy.masterPassword;
        if (code === masterKey) {
            setIsAdminUnlocked(true);
            setIsUnlockSheetOpen(false);
            setLoginCode('');
            setUnlockCode('');
            setUnlockAttempts(0);
            triggerNotif("تم فك القفل الإداري بنجاح", "info");
        } else {
            const nextAttempts = unlockAttempts + 1;
            setUnlockAttempts(nextAttempts);
            setUnlockCode('');
            if (nextAttempts >= 3) {
                triggerNotif("⚠️ تنبيه: محاولات فك قفل متكررة خاطئة!", "error");
            } else {
                triggerNotif(`رمز خاطئ (محاولة ${nextAttempts} من 3)`, "error");
            }
        }
    }, [unlockAttempts, triggerNotif, currentPharmacy]);

    const loadData = useCallback(async () => {
        const [m, s, e, c, n, w, notes] = await Promise.all([
            db.medicines.toArray(),
            db.sales.orderBy('timestamp').reverse().toArray(),
            db.expenses.orderBy('timestamp').reverse().toArray(),
            db.customers.toArray(),
            db.notifications.orderBy('timestamp').reverse().toArray(),
            db.wantedItems.orderBy('createdAt').reverse().toArray(),
            db.notes.orderBy('createdAt').reverse().toArray()
        ]);
        setMedicines(m);
        setSalesHistory(s);
        setExpenses(e);
        setCustomers(c);
        setNotifs(n);
        setWantedItems(w);
        setNotes(notes);
    }, []);

    const checkStatus = useCallback(async () => {
        // Placeholder for future health checks or inventory alerts
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            console.log('🔍 Starting initAuth...');
            const saved = await db.pharmacies.toCollection().first();
            console.log('🔍 Saved pharmacy found:', saved);
            
            if (saved) {
                console.log('🔍 Found saved pharmacy:', saved.pharmacyKey);
                
                // التحقق من أن Master Password لا يزال صالحاً (90 يوم للتحقق من الملكية)
                const now = Date.now();
                const lastActive = saved.lastActive ? new Date(saved.lastActive).getTime() : now;
                const masterPasswordTimeout = 90 * 24 * 60 * 60 * 1000; // 90 يوم
                
                console.log('🔍 Time since last active:', Math.floor((now - lastActive) / (1000 * 60 * 60 * 24)), 'days');
                
                // إذا مرت 90 يوم، نطلب Master Password للتحقق من الملكية فقط
                if (now - lastActive > masterPasswordTimeout) {
                    console.log('🔍 90 days passed, requiring Master Password');
                    setCurrentPharmacy(saved);
                    setIsAuthenticated(false);
                    // يمكن إضافة رسالة: "يرجى إدخال Master Password للتحقق من الملكية"
                    return;
                }
                
                // تحديث lastActive للاستخدام الحالي
                await db.pharmacies.update(saved.id!, { lastActive: Date.now() });
                
                // بدون أي timeout للاستخدام - النظام يعمل دائماً
                console.log('🔍 Auto-login successful');
                setCurrentPharmacy(saved);
                setIsAuthenticated(true);
                localStorage.setItem('raha_pro_activated', 'true');
                
                // فقط تحميل البيانات المحلية، لا مزامنة تلقائية
                loadData();

                // Periodic status check - Real Supabase
                const statusCheck = await db.verifyPharmacy(saved.pharmacyKey);
                if (statusCheck && statusCheck.status === 'suspended') {
                    setIsSuspended(true);
                }

                // Device Ban Check - Real Supabase
                const hardwareId = localStorage.getItem('raha_hardware_id');
                if (hardwareId && saved.id) {
                    const isBanned = await db.checkDeviceBan(saved.id, hardwareId);
                    if (isBanned) {
                        alert('🛑 تم قفل وإيقاف هذا الجهاز من قبل الإدارة المركزية.');
                        await db.purgeAllLocalData();
                        localStorage.removeItem('raha_pro_activated');
                        window.location.reload();
                        return;
                    }
                }
            } else {
                console.log('🔍 No saved pharmacy found');
                setIsAuthenticated(false);
            }
        };
        initAuth();

        // Check for active reminders on app start (Pulse mode)
        const checkReminders = async () => {
            const items = await db.wantedItems.toArray();
            const now = Date.now();
            const activeReminders = items.filter(i => i.status === 'pending' && i.reminderAt && i.reminderAt <= now);
            for (const item of activeReminders) {
                triggerNotif(`⏰ تذكر: "${item.itemName}" موجود في النواقص وحان موعده`, 'info');
                await db.wantedItems.update(item.id!, { reminderAt: undefined });
            }
        };
        const rTimer = setTimeout(checkReminders, 2000);

        return () => {
            clearTimeout(rTimer);
        };
    }, []); // Empty dependencies - run only once

    // Calculator Functions
    const handleCalcNumber = useCallback((num: string) => {
        if (calcWaitingForNewValue) {
            setCalcDisplay(num);
            setCalcWaitingForNewValue(false);
        } else {
            setCalcDisplay(calcDisplay === '0' ? num : calcDisplay + num);
        }
    }, [calcDisplay, calcWaitingForNewValue]);

    const handleCalcDecimal = useCallback(() => {
        if (calcWaitingForNewValue) {
            setCalcDisplay('0.');
            setCalcWaitingForNewValue(false);
        } else if (calcDisplay.indexOf('.') === -1) {
            setCalcDisplay(calcDisplay + '.');
        }
    }, [calcDisplay, calcWaitingForNewValue]);

    const handleCalcOperator = useCallback((nextOperator: string) => {
        const inputValue = parseFloat(calcDisplay);

        if (calcOperation && !calcWaitingForNewValue) {
            setCalcOperation(nextOperator);
            return;
        }

        if (calcPreviousValue === null) {
            setCalcPreviousValue(inputValue);
        } else if (calcOperation) {
            const currentValue = calcPreviousValue || 0;
            const newValue = calculate(currentValue, inputValue, calcOperation);
            setCalcDisplay(String(newValue));
            setCalcPreviousValue(newValue);
        }

        setCalcWaitingForNewValue(true);
        setCalcOperation(nextOperator);
    }, [calcDisplay, calcOperation, calcPreviousValue, calcWaitingForNewValue]);

    const handleCalcEquals = useCallback(() => {
        const inputValue = parseFloat(calcDisplay);

        if (calcPreviousValue !== null && calcOperation) {
            const newValue = calculate(calcPreviousValue, inputValue, calcOperation);
            setCalcDisplay(String(newValue));
            setCalcPreviousValue(null);
            setCalcOperation(null);
            setCalcWaitingForNewValue(true);
        }
    }, [calcDisplay, calcOperation, calcPreviousValue]);

    const handleCalcClear = useCallback(() => {
        setCalcDisplay('0');
        setCalcPreviousValue(null);
        setCalcOperation(null);
        setCalcWaitingForNewValue(false);
    }, []);

    const handleCalcDelete = useCallback(() => {
        if (calcWaitingForNewValue) {
            setCalcWaitingForNewValue(false);
        } else {
            setCalcDisplay(calcDisplay === '0' ? '0' : calcDisplay.slice(0, -1));
        }
    }, [calcDisplay, calcWaitingForNewValue]);

    const calculate = (firstValue: number, secondValue: number, operation: string): number => {
        switch (operation) {
            case '+': return firstValue + secondValue;
            case '-': return firstValue - secondValue;
            case '*': return firstValue * secondValue;
            case '/': return firstValue / secondValue;
            default: return secondValue;
        }
    };

    // Scanner Functions
    const handleStartScanner = useCallback(() => {
        setIsScannerActive(true);
        setScannedBarcode('');
        setFoundMedicine(null);
        setShowScannerResult(false);
    }, []);

    const handleStopScanner = useCallback(() => {
        setIsScannerActive(false);
    }, []);

    const handleBarcodeScanned = useCallback(async (barcode: string) => {
        setScannedBarcode(barcode);
        
        // Search for medicine by barcode
        const medicine = medicines.find(m => m.barcode === barcode);
        
        if (medicine) {
            setFoundMedicine(medicine);
            setShowScannerResult(true);
            setIsScannerActive(false);
            
            if (scannerMode === 'sell') {
                // Add to cart
                const cartItem: CartItem = {
                    medicine,
                    quantity: 1,
                    totalPrice: medicine.price || 0
                };
                setCart(prev => new Map(prev).set(medicine.id, cartItem));
                triggerNotif(`تمت إضافة ${medicine.name} للسلة`, 'success');
            } else {
                // Open edit modal
                setEditingMed(medicine);
                setIsEditOpen(true);
                triggerNotif(`جاري تعديل ${medicine.name}`, 'info');
            }
        } else {
            // Medicine not found
            setShowScannerResult(true);
            setIsScannerActive(false);
            
            if (scannerMode === 'add') {
                // Add new medicine
                const newMedicine: Medicine = {
                    id: crypto.randomUUID(),
                    pharmacyId: currentPharmacy?.id,
                    name: '',
                    barcode: barcode,
                    price: 0,
                    costPrice: 0,
                    stock: 0,
                    category: '',
                    expiryDate: '',
                    supplier: '',
                    supplierPhone: '',
                    minStockAlert: 5,
                    addedDate: new Date().toISOString().split('T')[0]
                };
                setEditingMed(newMedicine);
                setIsEditOpen(true);
                triggerNotif('دواء جديد - يرجى إكمال البيانات', 'info');
            } else {
                triggerNotif('الباركود غير موجود في النظام', 'error');
            }
        }
    }, [medicines, scannerMode, setCart, triggerNotif, setEditingMed, setIsEditOpen, currentPharmacy]);

    const handleManualBarcodeInput = useCallback(() => {
        const barcode = prompt('أدخل الباركود يدوياً:');
        if (barcode) {
            handleBarcodeScanned(barcode);
        }
    }, [handleBarcodeScanned]);

    // Enhanced Notification System
    const checkOverdueDebts = useCallback(async () => {
        const overdueThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days
        const now = Date.now();
        
        const overdueSales = salesHistory.filter(sale => 
            (sale.debtAmount || 0) > 0 && 
            (now - sale.timestamp) > overdueThreshold
        );
        
        if (overdueSales.length > 0) {
            const customerNames = [...new Set(overdueSales.map(s => s.customerName || 'عميل غير معروف'))];
            
            // Check if we already showed this notification today
            const today = new Date().toDateString();
            const lastNotif = localStorage.getItem(`debt_notif_${today}`);
            
            if (!lastNotif) {
                triggerNotif(`⚠️ يوجد ${overdueSales.length} ديون متأخرة لـ ${customerNames.length} عملاء`, 'warning');
                localStorage.setItem(`debt_notif_${today}`, 'shown');
            }
        }
    }, [salesHistory, triggerNotif]);

    // Undo System
    const saveAction = useCallback((action: any) => {
        setLastAction(action);
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);
    }, []);

    const handleUndo = useCallback(async () => {
        if (!lastAction) return;
        
        try {
            switch (lastAction.type) {
                case 'sale':
                    // Remove the last sale
                    if (lastAction.saleId) {
                        await db.sales.delete(lastAction.saleId);
                        triggerNotif('تم التراجع عن عملية البيع', 'success');
                    }
                    break;
                case 'expense':
                    // Restore the expense
                    if (lastAction.expense) {
                        await db.expenses.add(lastAction.expense);
                        triggerNotif('تم التراجع عن حذف المصروف', 'success');
                    }
                    break;
                case 'medicine':
                    // Restore the medicine
                    if (lastAction.medicine) {
                        await db.medicines.add(lastAction.medicine);
                        triggerNotif('تم التراجع عن حذف الدواء', 'success');
                    }
                    break;
            }
            
            setLastAction(null);
            setShowUndoToast(false);
            loadData();
        } catch (error) {
            triggerNotif('فشل التراجع عن العملية', 'error');
        }
    }, [lastAction, triggerNotif, loadData]);

    // Check overdue debts periodically
    useEffect(() => {
        if (isAuthenticated && currentPharmacy) {
            checkOverdueDebts();
            
            // Check every hour
            const interval = setInterval(checkOverdueDebts, 60 * 60 * 1000);
            
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, currentPharmacy, checkOverdueDebts]);

    // Memoized calculations for performance
    const financeStats = useMemo(() => {
        const validSales = salesHistory.filter(s => !s.isReturned);
        const totalSales = validSales.reduce((sum, s) => sum + (s.netAmount || 0), 0);
        const totalCosts = validSales.reduce((sum, s) => sum + (s.totalCost || 0), 0);
        const profit = totalSales - totalCosts;
        
        return { sales: totalSales, costs: totalCosts, profit };
    }, [salesHistory]);

    // Re-check authentication state after data loads
    useEffect(() => {
        if (isAuthenticated && currentPharmacy) {
            console.log('🔍 Auth state confirmed - user is logged in');
        } else if (!isAuthenticated) {
            console.log('🔍 Auth state - user not authenticated');
        }
    }, [isAuthenticated, currentPharmacy]);

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleBulkDelete = useCallback(async () => {
        const count = selectedIds.size;
        if (!count) return;
        if (!isAdminUnlocked) { setIsUnlockSheetOpen(true); return; }
        if (!confirm(`هل أنت متأكد من حذف ${count} عنصر؟ لا يمكن التراجع.`)) return;

        try {
            const ids = Array.from(selectedIds);
            if (view === 'inventory') await db.medicines.bulkDelete(ids);
            else if (view === 'accounting') await db.sales.bulkDelete(ids);
            else if (view === 'expenses') await db.expenses.bulkDelete(ids);

            triggerNotif(`تم حذف ${count} عنصر بنجاح`, "info");
            setSelectedIds(new Set());
            loadData();
        } catch (err) {
            triggerNotif("خطأ أثناء الحذف الجماعي", "error");
        }
    }, [selectedIds, view, loadData, triggerNotif]);

    const startSelect = useCallback((id: string) => {
        const timer = setTimeout(() => {
            toggleSelect(id);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 600);
        setSelectionTimer(timer);
    }, [toggleSelect]);

    const stopSelect = () => {
        if (selectionTimer) clearTimeout(selectionTimer);
        setSelectionTimer(null);
    };

    // Initial Load & Auth-Guard Sync (Raha Cloud Engine)
    useEffect(() => {
        if (isAuthenticated && currentPharmacy?.id && !isSyncing && !hasInitialSynced) {
            const runInitialSync = async () => {
                setHasInitialSynced(true);
                if (navigator.onLine) {
                    setIsSyncing(true);
                    try {
                        const res = await db.fullSyncFromCloud(currentPharmacy.id);
                        if (res) triggerNotif(`تمت مزامنة البيانات من السحاب بنجاح`, "info");
                        else triggerNotif(`فشلت المزامنة`, "error");
                    } catch (err) {
                        console.error('Sync error:', err);
                        triggerNotif(`فشل الاتصال بالسحابة`, "error");
                    }
                } else {
                    triggerNotif(`لا يوجد اتصال بالإنترنت`, "error");
                }
                loadData();
                setIsSyncing(false);
            };
            runInitialSync();
        }
    }, [isAuthenticated, currentPharmacy?.id, hasInitialSynced]);

    // Smart Business Health Analyzer - نظام التنبيهات الذكي
    const analyzeBusinessHealth = useCallback(async () => {
        const alerts: AppNotification[] = [];
        const today = new Date().toISOString().split('T')[0];

        // 1. فحص المخزون المنخفض والمنتهي
        const stagnantMeds = medicines.filter(med => {
            if (med.stock <= 0) return false;
            const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
            const addedTime = med.addedDate ? new Date(med.addedDate).getTime() : Date.now();

            if (med.lastSold) {
                const lastSoldTime = typeof med.lastSold === 'number' ? med.lastSold : new Date(med.lastSold).getTime();
                return lastSoldTime < sixtyDaysAgo;
            } else {
                // منتج جديد لم يُبع أبداً، نحسب الركود من تاريخ الإضافة
                return addedTime < sixtyDaysAgo;
            }
        });

        if (stagnantMeds.length > 0) {
            alerts.push({
                id: crypto.randomUUID(),
                pharmacyId: currentPharmacy?.id || '',
                message: `📦 ${stagnantMeds.length} منتج راكد (لم يُبع منذ 60+ يوم)`,
                type: 'warning',
                timestamp: Date.now()
            });
        }

        // 3. الفحص المالي - مقارنة المصروفات بالأرباح
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalProfit = salesHistory
            .filter(s => !s.isReturned)
            .reduce((sum, s) => sum + (s.profit || 0), 0);

        const netProfit = totalProfit - totalExpenses;

        if (netProfit < 0) {
            alerts.push({
                id: crypto.randomUUID(),
                pharmacyId: currentPharmacy?.id || '',
                message: `💰 تحذير مالي: عجز قدره ${Math.abs(netProfit).toFixed(2)} ج.م`,
                type: 'error',
                timestamp: Date.now()
            });
        }

        // حفظ التنبيهات في قاعدة البيانات (تجنب التكرار)
        if (alerts.length > 0) {
            try {
                // فحص آخر تنبيه لتجنب التكرار
                const lastNotif = await db.notifications.orderBy('timestamp').reverse().first();
                const hourAgo = Date.now() - (60 * 60 * 1000);

                // إضافة فقط إذا مر أكثر من ساعة على آخر فحص
                if (!lastNotif || lastNotif.timestamp < hourAgo) {
                    await db.notifications.bulkAdd(alerts);
                    console.log(`✅ تم إضافة ${alerts.length} تنبيه ذكي`);
                    loadData(); // تحديث البيانات لعرض التنبيهات
                }
            } catch (err) {
                console.error('خطأ في حفظ التنبيهات:', err);
            }
        }
    }, [medicines, expenses, salesHistory, loadData]);

    useEffect(() => {
        const timer = setTimeout(() => analyzeBusinessHealth(), 5000);
        const interval = setInterval(() => analyzeBusinessHealth(), 10 * 60 * 1000);
        return () => { clearTimeout(timer); clearInterval(interval); };
    }, [analyzeBusinessHealth]);

    const categories = useMemo(() => ['الكل', ...Array.from(new Set(medicines.map(m => (m.category || '').trim()))).filter(Boolean)], [medicines]);
    const suppliers = useMemo(() => ['الكل', ...Array.from(new Set(medicines.map(m => (m.supplier || '').trim()))).filter(Boolean)], [medicines]);

    const posItems = useMemo(() => {
        return medicines.filter(m => {
            const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || (m.barcode && m.barcode.includes(searchQuery));
            const matchesCat = activeCategory === 'الكل' || m.category === activeCategory;
            return matchesSearch && matchesCat;
        });
    }, [medicines, searchQuery, activeCategory]);

    const inventoryValue = useMemo(() => {
        return medicines.reduce((acc, m) => {
            acc.sell += (m.price || 0) * (m.stock || 0);
            // Surgical Accounting: Capital = (stock / unitsPerPkg) * costPrice
            const unitsPerPkg = (m.unitsPerPkg && m.unitsPerPkg > 0) ? m.unitsPerPkg : 1;
            acc.cost += (m.stock / unitsPerPkg) * (m.costPrice || 0);
            return acc;
        }, { sell: 0, cost: 0 });
    }, [medicines]);

    const alerts = useMemo(() => {
        const low = medicines.filter(m => m.stock > 0 && m.stock <= 10).length;
        const out = medicines.filter(m => m.stock <= 0).length;
        return { total: low + out };
    }, [medicines]);

    const inventoryAnalytics = useMemo(() => {
        const total = medicines.length || 1;
        const soldAtLeastOnce = medicines.filter(m => m.lastSold).length;
        const salesRate = (soldAtLeastOnce / total) * 100;

        const stagnantCount = medicines.filter(m => {
            if (m.stock <= 0) return false;
            const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
            const addedTime = m.addedDate ? new Date(m.addedDate).getTime() : Date.now();
            return m.lastSold ? (typeof m.lastSold === 'number' ? m.lastSold : 0) < sixtyDaysAgo : addedTime < sixtyDaysAgo;
        }).length;

        const suggestions = medicines.filter((m: Medicine) =>
            m.stock === 0 &&
            m.lastSold &&
            m.lastSold > (Date.now() - (30 * 24 * 60 * 60 * 1000)) // Last sold within 30 days
        );

        return { salesRate, stagnantCount, total, suggestions };
    }, [medicines]);

    const expenseTypes = useMemo(() => {
        const defaults = ['إيجار', 'كهرباء', 'مياه', 'رواتب', 'نثريات', 'صيانة'];
        const existing = Array.from(new Set(expenses.map(e => e.type)));
        return Array.from(new Set([...defaults, ...existing]));
    }, [expenses]);


    const now = Date.now();

    const filteredInventory = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
        const nearDate = threeMonthsLater.toISOString().split('T')[0];
        return medicines.filter(m => {
            let matches = true;
            if (matches && invSearchQuery) {
                matches = m.name.toLowerCase().includes(invSearchQuery.toLowerCase()) ||
                    (m.barcode && m.barcode.includes(invSearchQuery));
            }
            if (invStockFilter === 'low') matches = m.stock > 0 && m.stock <= 10;
            else if (invStockFilter === 'out') matches = m.stock <= 0;
            else if (invStockFilter === 'unsold') matches = !m.lastSold && m.stock > 0;
            else if (invStockFilter === 'fragmented') matches = m.unitsPerPkg && m.unitsPerPkg > 1 && (m.stock % m.unitsPerPkg !== 0);
            else if (invStockFilter === 'stagnant') {
                if (m.stock <= 0) matches = false;
                else {
                    const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);
                    const addedTime = m.addedDate ? new Date(m.addedDate).getTime() : now;
                    if (m.lastSold) {
                        const lastSoldTime = typeof m.lastSold === 'number' ? m.lastSold : new Date(m.lastSold).getTime();
                        matches = lastSoldTime < sixtyDaysAgo;
                    } else {
                        matches = addedTime < sixtyDaysAgo;
                    }
                }
            }
            if (matches && invDateFilter) matches = m.addedDate === invDateFilter;
            if (matches && invCategoryFilter !== 'الكل') matches = m.category === invCategoryFilter;
            if (matches && invSupplierFilter !== 'الكل') matches = m.supplier === invSupplierFilter;
            if (matches) {
                if (invExpiryFilter === 'expired') matches = m.expiryDate < today;
                else if (invExpiryFilter === 'near') matches = m.expiryDate >= today && m.expiryDate <= nearDate;
            }
            return matches;
        });
    }, [medicines, invStockFilter, invDateFilter, activeCategory, invSupplierFilter, invExpiryFilter, invSearchQuery]);

    // Filtered sales for accounting view
    const filteredSales = useMemo(() => {
        let filtered = salesHistory.filter(s => new Date(s.timestamp).toISOString().split('T')[0] === accDateFilter);
        if (accPaymentFilter === 'cash') filtered = filtered.filter(s => (s.cashAmount || 0) > 0);
        else if (accPaymentFilter === 'bank') filtered = filtered.filter(s => (s.bankAmount || 0) > 0);
        else if (accPaymentFilter === 'debt') filtered = filtered.filter((s: any) => (s.debtAmount || 0) > 0);

        const totals = filtered.reduce((acc: { sales: number; costs: number; profit: number }, s: any) => {
            if (!s.isReturned) {
                acc.sales += s.netAmount || 0;
                acc.costs += s.totalCost || 0;
                acc.profit += (s.profit || 0);
            }
            return acc;
        }, { sales: 0, costs: 0, profit: 0 });
        
        return { filtered, totals };
    }, [salesHistory, accDateFilter, accPaymentFilter]);

    // Advanced Debt Ledger Logic
    const debtorsMap = useMemo(() => {
        const map = new Map<string, { total: number, transactions: any[] }>();
        salesHistory.forEach(s => {
            if (!s.isReturned && (s.debtAmount || 0) > 0 && s.customerName) {
                // Apply search filter for debtors
                if (accSearchQuery && !s.customerName.toLowerCase().includes(accSearchQuery.toLowerCase())) return;

                const current = map.get(s.customerName) || { total: 0, transactions: [] };
                current.total += (s.debtAmount || 0);
                current.transactions.push({
                    id: s.id,
                    amount: s.debtAmount,
                    date: s.timestamp,
                    customerName: s.customerName
                });
                map.set(s.customerName, current);
            }
        });
        return map;
    }, [salesHistory, accSearchQuery]);

    // Filtered expenses
    const filteredExpenses = useMemo(() => {
        return expenses.filter((e: any) => {
            const expDate = new Date(e.timestamp).toISOString().split('T')[0];
            return expDate >= expStartDate && expDate <= expEndDate;
        });
    }, [expenses, expStartDate, expEndDate]);

    const expensesFinancials = useMemo(() => {
        const filteredSales = salesHistory.filter(s => {
            const d = new Date(s.timestamp).toISOString().split('T')[0];
            return d >= expStartDate && d <= expEndDate && !s.isReturned;
        });
        const totalExp = filteredExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const totalCost = filteredSales.reduce((sum: number, s: any) => sum + (s.totalCost || 0), 0);
        const salesProfit = filteredSales.reduce((sum: number, s: any) => sum + (s.profit || 0), 0);
        const netProfit = salesProfit - totalExp;
        return { list: filteredExpenses, totalExp, totalCost, salesProfit, netProfit };
    }, [expenses, salesHistory, expStartDate, expEndDate]);

    const inlineUpdate = useCallback(async (id: string, field: string, value: any) => {
        const val = (field === 'price' || field === 'costPrice' || field === 'stock') ? parseFloat(value) : value;
        await db.medicines.update(id, { [field]: val });
        loadData();
    }, [loadData]);


    const handleReturn = useCallback(async (saleId: string) => {
        if (!isAdminUnlocked) { setIsUnlockSheetOpen(true); return; }
        if (!confirm('هل أنت متأكد من إرجاع هذه العملية؟ سيتم استعادة المخزون.')) return;
        try {
            const sale = salesHistory.find(s => s.id === saleId);
            if (sale && sale.itemsJson) {
                const items = JSON.parse(sale.itemsJson) as Array<{ name: string, quantity: number }>;
                for (const item of items) {
                    const med = medicines.find(m => m.name === item.name);
                    if (med && med.stock !== undefined) {
                        await db.medicines.update(med.id, { stock: med.stock + item.quantity });
                    }
                }
            }
            await db.sales.update(saleId, { isReturned: true });
            triggerNotif('تم إرجاع البيع بنجاح', 'info' as any);
            loadData();
        } catch (error) {
            triggerNotif('فشل إرجاع البيع', 'error');
        }
    }, [salesHistory, medicines, triggerNotif, loadData]);

    const backupData = useCallback(async () => {
        const [medicines, sales, expenses, customers, notifications] = await Promise.all([
            db.medicines.toArray(),
            db.sales.toArray(),
            db.expenses.toArray(),
            db.customers.toArray()(),
            db.notifications.toArray()
        ]);
        const data = { medicines, salesHistory: sales, expenses, customers, notifications };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `raha_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }, []);

    const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data && typeof data === 'object') {
                    if (!confirm('سيتم استبدال قاعدة البيانات الحالية بالكامل بالنسخة الاحتياطية. هل أنت متأكد؟')) return;
                    await (db as any).transaction('rw', db.medicines, db.sales, db.expenses, db.customers, db.notifications, async () => {
                        await Promise.all([
                            db.medicines.clear(),
                            db.sales.clear(),
                            db.expenses.clear(),
                            db.customers.clear(),
                            db.notifications.clear()
                        ]);
                        await Promise.all([
                            db.medicines.bulkAdd(data?.medicines || []),
                            db.sales.bulkAdd(data?.sales || data?.salesHistory || []),
                            db.expenses.bulkAdd(data?.expenses || []),
                            db.customers.bulkAdd(data?.customers || []),
                            db.notifications.bulkAdd(data?.notifications || [])
                        ]);
                    });

                    // Sync with Cloud (Mirror Restore)
                    triggerNotif("جاري مزامنة النسخة مع السحاب...", "info");
                // await db.clearCloudData();
                // await db.fullUploadToCloud();

                alert('تمت استعادة البيانات بنجاح! سيتم إعادة تشغيل التطبيق الآن.');
                window.location.reload();
                }
            } catch (err) { triggerNotif("خطأ في قراءة ملف النسخة الاحتياطية", "error"); }
        };
        reader.readAsText(file);
    }, [triggerNotif]);

    const resetApp = useCallback(async () => {
        if (!isAdminUnlocked) { setIsUnlockSheetOpen(true); return; }
        const totalSales = salesHistory?.reduce((a: number, b) => a + (b.isReturned ? 0 : (b.netAmount || 0)), 0) || 0;
        const summary = `تقرير التصفير:\nإجمالي المبيعات: ${totalSales.toFixed(2)}\nإجمالي الأصناف: ${medicines?.length || 0}`;
        if (confirm(`${summary}\n\nهل أنت متأكد من تصفير التطبيق؟\n(سيتم استبدال الحسابات والمنصرفات فقط)`)) {
            await (db as any).transaction('rw', db.sales, db.expenses, db.notifications, async () => {
                await Promise.all([
                    db.sales.clear(),
                    db.expenses.clear(),
                    db.notifications.clear()
                ]);
            });
            // Comment out non-existent methods
            // await db.clearCloudData();
            // await db.fullUploadToCloud();
            
            triggerNotif("تم تصفير التقارير بنجاح", "info");
            loadData();
        }
    }, [isAdminUnlocked, salesHistory, medicines.length, loadData, triggerNotif]);


    const addToCart = useCallback((m: Medicine, isWholePkg: boolean = false) => {
        if ((m.stock || 0) <= 0) { triggerNotif(`نفد مخزون ${m.name}`, "error"); return; }

        const qtyToAdd = (isWholePkg && m.unitsPerPkg && m.unitsPerPkg > 0) ? m.unitsPerPkg : 1;

        const newCart = new Map<string, CartItem>(cart);
        const item: CartItem = newCart.get(m.id!) || { medicine: m, quantity: 0 };

        if (item.quantity + qtyToAdd <= (m.stock || 0)) {
            // New Package Opened Notification
            if (m.unitsPerPkg && m.unitsPerPkg > 1) {
                const currentUnitsInOpenPkg = (m.stock || 0) % m.unitsPerPkg;
                if (currentUnitsInOpenPkg === 0 || (item.quantity % m.unitsPerPkg === 0 && item.quantity > 0)) {
                    // Logic for "opening" a new box
                    // This is a simplified check: if stock is exact multiple, next sale MUST break a box
                    // or if we already added a full box.
                }

                // User requirement: "📦 تم فتح عبوة جديدة من [الاسم].. المتبقي فيها: [X] حبات"
                // Only show if we are actually starting a new box from the current stock
                const remainingAfterThis = (m.stock || 0) - (item.quantity + 1);
                if ((m.stock || 0) % m.unitsPerPkg === 0 && qtyToAdd === 1) {
                    triggerNotif(`📦 تم فتح عبوة جديدة من ${m.name}.. المتبقي فيها: ${m.unitsPerPkg - 1} حبات`, "info");
                }
            }

            newCart.set(m.id!, { ...item, quantity: item.quantity + qtyToAdd });
            setCart(newCart);
        } else { triggerNotif("لا توجد كمية كافية", "warning"); }
    }, [cart, triggerNotif, setCart]);

    const removeFromCart = useCallback((id: string) => {
        const newCart = new Map(cart);
        const item = newCart.get(id);
        if (!item) return;
        if (item.quantity > 1) newCart.set(id, { ...item, quantity: item.quantity - 1 });
        else newCart.delete(id);
        setCart(newCart);
    }, [cart, setCart]);

const handleSale = useCallback(async () => {
    if (cart.size === 0) return;
    
    try {
        const cartArray = Array.from(cart.values());
        const itemsArray = cartArray.map(item => ({
            ...item,
            id: item.medicine.id,
            price: item.medicine.price || 0,
            costPrice: item.costPrice || 0,
            totalCost: (item.costPrice || 0) * item.quantity,
            profit: ((item.medicine.price || 0) - (item.costPrice || 0)) * item.quantity
        }));

        const totalCostValue = itemsArray.reduce((acc, item) => acc + item.totalCost, 0);
        const netValue = cartArray.reduce((acc, item) => acc + ((item.medicine.price || 0) * item.quantity), 0) - (Number(payData.discount) || 0);
        
        if (totalCostValue > netValue) {
            throw new Error("⚠️ خطأ في البيانات: تكلفة الصنف أعلى من سعر البيع (ربح سالب)");
        }
        
        // @ts-ignore
        await db.transaction('rw', [db.medicines, db.sales, db.customers], async () => {
            for (const item of itemsArray) {
                const medicine = await db.medicines.get(item.id);
                if (medicine) {
                    if ((medicine.stock || 0) < item.quantity) {
                        throw new Error(`⚠️ المخزون غير كافٍ لـ ${medicine.name} (${medicine.stock || 0} متاح)`);
                    }
                    await db.medicines.update(item.id, {
                        stock: (medicine.stock || 0) - item.quantity,
                        usageCount: (medicine.usageCount || 0) + item.quantity,
                        lastSold: Date.now()
                    });
                }
            }
            
            const saleId = crypto.randomUUID();
            await db.sales.add({
                id: saleId,
                timestamp: Date.now(),
                pharmacyId: currentPharmacy?.id || '',
                itemsJson: JSON.stringify(itemsArray),
                totalAmount: cartArray.reduce((acc, item) => acc + ((item.medicine.price || 0) * item.quantity), 0),
                discount: Number(payData.discount) || 0,
                netAmount: netValue,
                cashAmount: Number(payData.cash) || 0,
                bankAmount: Number(payData.bank) || 0,
                debtAmount: Number(payData.debt) || 0,
                bankTrxId: payData.trx || '',
                customerName: payData.cust || '',
                totalCost: totalCostValue,
                profit: netValue - totalCostValue,
                isReturned: false
            });
            
            if (payData.cust) {
                await db.customers.put({
                    id: crypto.randomUUID(),
                    pharmacyId: currentPharmacy?.id || '',
                    name: payData.cust,
                    createdAt: Date.now(),
                    totalPurchases: netValue
                });
            }
        });
        
        setCart(new Map());
        setPayData({ discount: '', cash: '', bank: '', debt: '', trx: '', cust: '' });
        triggerNotif("تمت عملية البيع بنجاح", "info");
        loadData();
    } catch (error: any) {
        console.error('❌ Sale error:', error);
        triggerNotif(error.message || "فشلت عملية البيع", "error");
    }
}, [cart, payData, loadData, triggerNotif]);

    // Helper: Parse items_json for sales transparency
    const parseItemsJson = useCallback((itemsJson: string): string[] => {
        try {
            const items = JSON.parse(itemsJson);
            return items.map((item: any) => item.medicine.name || 'صنف غير معروف');
        } catch {
            return [];
        }
    }, []);

    // Helper function for safe database operations
    const safeDatabaseOperation = async (operation: () => Promise<any>, errorMessage: string) => {
        try {
            return await operation();
        } catch (error) {
            console.error(`❌ ${errorMessage}:`, error);
            triggerNotif(errorMessage, "error");
            return null;
        }
    };

    // Retry mechanism for failed operations
    const retryOperation = async (operation: () => Promise<any>, maxRetries = 3) => {
        let lastError: any;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Operation failed, retry ${i + 1}/${maxRetries}:`, error);
                
                if (i < maxRetries - 1) {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                    
                    // Try to restore connection
                    await db.retryFailedSync();
                }
            }
        }
        
        throw lastError;
    };

    // Add connection status monitoring
    useEffect(() => {
        const checkConnection = async () => {
            const status = await db.getConnectionStatus();
            console.log('🔌 Connection status:', status);
            if (!status.connected) {
                console.warn('⚠️ Cloud connection issue detected');
            }
        };
        
        // Check connection every 30 seconds
        const interval = setInterval(checkConnection, 30000);
        checkConnection(); // Initial check
        
        return () => clearInterval(interval);
    }, []);

    const handleNoteSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingNote) {
                await db.notes.update(editingNote.id, {
                    title: noteData.title,
                    content: noteData.content,
                    type: noteData.type,
                    updatedAt: Date.now()
                });
                triggerNotif("تم تحديث الملاحظة بنجاح", "success");
            } else {
                await db.notes.add({
                    id: crypto.randomUUID(),
                    pharmacyId: currentPharmacy?.id || '',
                    title: noteData.title,
                    content: noteData.content,
                    type: noteData.type,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    createdBy: 'user'
                });
                triggerNotif("تم إضافة الملاحظة بنجاح", "success");
            }
            setIsNoteModalOpen(false);
            setNoteData({ title: '', content: '', type: 'private' });
            setEditingNote(null);
            loadData();
        } catch (error) {
            triggerNotif("فشل حفظ الملاحظة", "error");
        }
    }, [editingNote, noteData, currentPharmacy, triggerNotif, loadData]);

    const filteredNotes = useMemo(() => {
        return notes.filter(note => {
            const matchesType = notesFilter === 'all' || note.type === notesFilter;
            const matchesDate = !notesDateFilter || new Date(note.createdAt).toISOString().split('T')[0] === notesDateFilter;
            return matchesType && matchesDate && !note.isDeleted;
        });
    }, [notes, notesFilter, notesDateFilter]);

    const handleWantedAdd = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await safeDatabaseOperation(
                () => db.smartAddWantedItem({
                    pharmacyId: currentPharmacy?.id!,
                    itemName: wantedData.name,
                    notes: wantedData.note,
                    requestCount: 1,
                    status: 'pending'
                }, currentPharmacy?.id!),
                "فشل إضافة الناقص"
            );

            triggerNotif("تمت المزامنة الذكية مع قائمة النواقص", "info");
            setIsWantedOpen(false);
            setWantedData({ name: '', note: '', reminder: '' });
            loadData();
        } catch (err) {
            triggerNotif("خطأ في إضافة الناقص", "error");
        }
    }, [wantedData, currentPharmacy, loadData, triggerNotif]);

const handlePharmacyVerify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const { key, password } = activationData;
    if (!key || !password) return;

    // منطق الدخول الخاص (الرمز المزدوج للاختبار)
    if (key === 'raha0909' && password === 'raha0909') {
        const trialPharmacy: Pharmacy = {
            id: '00000000-0000-0000-0000-000000000001', // UUID صالح
            pharmacyKey: 'TRIAL',
            name: 'نسخة التجربة والاختبار',
            masterPassword: 'raha0909',
            status: 'active',
            createdAt: Date.now()
        };
        setCurrentPharmacy(trialPharmacy);
        setIsAuthenticated(true);
        localStorage.setItem('raha_pro_activated', 'true');
        triggerNotif("مرحباً بك في نسخة الاختبار الخاصة", "info");
        await db.purgeAllLocalData(); // تصفير البيانات المحلية لضمان نسخة نظيفة
        
        const existingPharmacy = await db.pharmacies.where('id').equals(trialPharmacy.id).first();
        if (!existingPharmacy) {
            await db.pharmacies.add({
                id: trialPharmacy.id,
                pharmacyKey: trialPharmacy.pharmacyKey,
                name: trialPharmacy.name,
                masterPassword: trialPharmacy.masterPassword,
                status: trialPharmacy.status,
                lastActive: Date.now()
            });
        } else {
            // تحديث الصيدلية الموجودة
            await db.pharmacies.update(trialPharmacy.id, {
                pharmacyKey: trialPharmacy.pharmacyKey,
                name: trialPharmacy.name,
                masterPassword: trialPharmacy.masterPassword,
                status: trialPharmacy.status,
                lastActive: Date.now()
            });
        }
        loadData();
    } else {
        // منطق الدخول للصيدليات المسجلة في السحابة
        setIsSyncing(true);
        try {
            const pharmacy = await safeDatabaseOperation(
                () => db.verifyPharmacy(key),
                "فشل التحقق من الصيدلية"
            );
            
            if (!pharmacy) {
                triggerNotif("رمز الصيدلية غير صحيح أو غير موجود", "error");
                return;
            }
            
            // التحقق من كلمة المرور الرئيسية
            console.log('🔍 Checking password:', password);
            console.log('🔍 Stored password:', pharmacy.masterPassword);
            
            if (pharmacy.masterPassword !== password) {
                triggerNotif("كلمة المرور الرئيسية غير صحيحة", "error");
                console.log('❌ Password mismatch!');
                return;
            }

            if (pharmacy.status === 'suspended') {
                setIsSuspended(true);
                triggerNotif("هذا الحساب معطل حالياً", "error");
                return;
            }
            
            // التحقق من المزامنة - إذا فشلت، لا ندخل المستخدم
            try {
                console.log('🔄 Starting critical sync...');
                
                // حذف البيانات المحلية أولاً
                await safeDatabaseOperation(
                    () => db.purgeAllLocalData(),
                    "فشل حذف البيانات المحلية"
                );
                
                // محاولة المزامنة من السحابة مباشرة
                const syncResult = await db.fullSyncFromCloud(pharmacy.id!);
                
                if (!syncResult) {
                    triggerNotif("فشل المزامنة من السحابة", "error");
                    return; // عدم الدخول إذا فشلت المزامنة
                }
                
                // تسجيل الجهاز
                await safeDatabaseOperation(
                    () => db.registerDevice(pharmacy.id!),
                    "فشل تسجيل الجهاز"
                );
                
                console.log('✅ All sync operations successful');
                
                // حفظ بيانات الصيدلية محلياً للدخول التلقائي
                const existingPharmacy = await db.pharmacies.where('id').equals(pharmacy.id).first();
                if (!existingPharmacy) {
                    await db.pharmacies.add({
                        id: pharmacy.id,
                        pharmacyKey: pharmacy.pharmacyKey,
                        name: pharmacy.name,
                        masterPassword: pharmacy.masterPassword,
                        status: pharmacy.status,
                        lastActive: Date.now()
                    });
                } else {
                    // تحديث الصيدلية الموجودة
                    await db.pharmacies.update(pharmacy.id, {
                        pharmacyKey: pharmacy.pharmacyKey,
                        name: pharmacy.name,
                        masterPassword: pharmacy.masterPassword,
                        status: pharmacy.status,
                        lastActive: Date.now()
                    });
                }
                
                // تحديث الحالة وتحميل البيانات
                setCurrentPharmacy(pharmacy);
                setIsAuthenticated(true);
                localStorage.setItem('raha_pro_activated', 'true');
                triggerNotif(`تم تسجيل الدخول بنجاح - ${pharmacy.name}`, "success");
                loadData();
                
            } catch (syncError) {
                console.error('❌ Critical sync failed:', syncError);
                triggerNotif("فشل المزامنة الحرجة - يرجى المحاولة مرة أخرى", "error");
                return;
            }
        } catch (err) {
            console.error('❌ Pharmacy verification error:', err);
            triggerNotif("خطأ في التحقق من الصيدلية", "error");
        } finally {
            setIsSyncing(false);
        }
    }
}, [activationData, triggerNotif, loadData]);

const handleLogout = useCallback(async () => {
    if (confirm("هل أنت متأكد من تسجيل الخروج؟ سيتم مسح البيانات المحلية.")) {
        try {
            await db.sales.clear();
            await db.expenses.clear();
            await db.customers.clear();
            await db.notifications.clear();
            await db.wantedItems.clear();
            setCurrentPharmacy(null);
            setIsAuthenticated(false);
            window.location.reload();
        } catch (error) {
            console.error('❌ Error during logout:', error);
            triggerNotif("حدث خطأ أثناء تسجيل الخروج", "error");
        }
    }
}, []);

    if (!isAuthenticated || !currentPharmacy) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-[9999] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 to-slate-900"></div>
                <div className="bg-white p-12 rounded-[50px] shadow-2xl max-w-md w-full mx-4 relative z-10 animate-in zoom-in-95">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-emerald-600 rounded-[30px] flex items-center justify-center text-white shadow-2xl mx-auto mb-6 rotate-3">
                            <Layers size={40} />
                        </div>
                        <h1 className="text-4xl font-black text-slate-800 mb-2">راحة <span className="text-emerald-600 font-black">PRO</span></h1>
                        <p className="text-sm font-bold text-slate-400">نظام إدارة الصيدليات الذكي - تفعيل المزامنة السحابية</p>
                    </div>
                    <form onSubmit={handlePharmacyVerify} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 mr-4">رمز الصيدلية (Pharmacy Key)</label>
                            <input
                                type="text"
                                placeholder="مثال: KRT-001"
                                className="w-full bg-slate-50 p-5 rounded-[25px] font-black text-lg text-center outline-none border-4 border-transparent focus:border-emerald-500/30 focus:bg-white transition-all"
                                value={activationData.key}
                                onChange={e => setActivationData({ ...activationData, key: e.target.value })}
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 mr-4">كلمة المرور الرئيسية (Master Password)</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="w-full bg-slate-50 p-5 rounded-[25px] font-black text-lg text-center outline-none border-4 border-transparent focus:border-emerald-500/30 focus:bg-white transition-all"
                                value={activationData.password}
                                onChange={e => setActivationData({ ...activationData, password: e.target.value })}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSyncing}
                            className={`w-full bg-slate-900 text-white py-6 rounded-[30px] font-black text-xl shadow-2xl hover:bg-emerald-600 transition-all active:scale-95 mt-4 ${isSyncing ? 'opacity-50 animate-pulse cursor-wait' : ''}`}
                        >
                            {isSyncing ? 'جاري التحقق...' : 'تفعيل النظام الآن'}
                        </button>
                    </form>
                    <div className="mt-10 text-center">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">SaaS Cloud Architecture © 2026</p>
                        <p className="text-[8px] font-bold text-slate-200 mt-1">Refactored by Antigravity v5.0</p>
                    </div>
                </div>
            </div>
        );
    }

    if (isSuspended) {
        return (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center z-[10000]">
                <div className="bg-white p-12 rounded-[50px] shadow-2xl max-w-sm w-full mx-4 text-center space-y-8 animate-in zoom-in-95">
                    <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <ShieldAlert size={48} />
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-3xl font-black text-slate-800">الحساب معطل</h2>
                        <p className="text-slate-500 font-bold leading-relaxed">
                            تم تعليق وصول هذه الصيدلية إلى النظام. يرجى التواصل مع الإدارة الفنية لإعادة التفعيل.
                        </p>
                    </div>
                    <div className="pt-4 border-t border-slate-100 text-[10px] font-black text-slate-300 uppercase letter-spacing-widest">
                        Account Suspended - Contact Administrator
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-medium">
            {/* Loading State */}
            {isSyncing && (
                <div className="fixed top-4 left-4 z-50 bg-white p-3 rounded-xl shadow-lg border border-slate-200 flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
                    <span className="text-sm font-bold text-slate-700">جاري المزامنة...</span>
                </div>
            )}
            
            {/* Connection Status */}
            <div className="fixed top-4 right-4 z-50 bg-white p-2 rounded-xl shadow-lg border border-slate-200">
                <div className={`w-3 h-3 rounded-full ${navigator.onLine ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            </div>
            
            {/* Undo Toast */}
            {showUndoToast && lastAction && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom duration-300">
                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                            <RotateCcw size={16} />
                        </div>
                        <div className="flex-grow">
                            <p className="text-sm font-bold">تم {lastAction.description}</p>
                            <p className="text-xs opacity-75">انقر للتراجع</p>
                        </div>
                        <button 
                            onClick={handleUndo}
                            className="px-3 py-1 bg-emerald-600 rounded-lg text-xs font-black hover:bg-emerald-700 transition-all"
                        >
                            تراجع
                        </button>
                    </div>
                </div>
            )}
            
            {activeNotif && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-xs animate-in slide-in-from-top-full duration-300">
                    <div className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-3 ${activeNotif.type === 'error' ? 'bg-rose-600 text-white' : activeNotif.type === 'warning' ? 'bg-amber-500 text-white' : activeNotif.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}>
                        <ShieldAlert size={20} />
                        <span className="text-xs font-black">{activeNotif.message}</span>
                    </div>
                </div>
            )}
            <header className="bg-white px-6 pt-10 pb-4 shadow-sm z-30 border-b border-slate-100 shrink-0">
                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={() => setShowSupportDialog(true)}
                        className="flex items-center gap-3 p-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 rounded-xl transition-all active:scale-95"
                    >
                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Layers size={20} /></div>
                        <h1 className="text-xl font-black text-slate-800">راحة <span className="text-emerald-600">PRO</span></h1>
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => setView('notifications')} className="relative p-2.5 bg-slate-50 text-slate-400 rounded-xl">
                            <Bell size={20} />
                            {alerts.total > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full font-black">{alerts.total}</span>}
                        </button>
                        <button onClick={backupData} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl"><Download size={20} /></button>
                        <button
                            disabled={isSyncing}
                            onClick={async () => {
                                if (confirm('هل أنت متأكد من بدء المزامنة؟ سيتم إرسال بياناتك ثم جلب التحديثات.')) {
                                    setIsSyncing(true);
                                    triggerNotif("جاري رفع البيانات المحلية...", "info");
                                    // 1. Force Push Local Data first to protect new items
                                    await db.fullUploadToCloud();

                                    // 2. Then Pull (Mirror)
                                    triggerNotif("جاري جلب التحديثات...", "info");
                                    if (!currentPharmacy?.id) return;
                                    const res = await db.fullSyncFromCloud(currentPharmacy.id);

                                    if (res.success) {
                                        triggerNotif(`تمت المزامنة بنجاح`, "info");
                                        await loadData();
                                    } else {
                                        triggerNotif(res.message || "فشل في المزامنة السحابية", "error");
                                    }
                                    setIsSyncing(false);
                                }
                            }}
                            className={`p-2.5 rounded-xl transition-all ${isSyncing ? 'bg-blue-100 text-blue-400 animate-pulse' : 'bg-blue-50 text-blue-400'}`}
                            title="مزامنة سحابية كاملة"
                        >
                            <CloudDownload size={20} className={isSyncing ? 'animate-bounce' : ''} />
                        </button>
                        <button onClick={resetApp} className="p-2.5 bg-rose-50 text-rose-400 rounded-xl"><RotateCcw size={20} /></button>
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {['pos', 'inventory', 'accounting', 'expenses', 'notes'].map((v) => (
                        <button key={v} onClick={() => setView(v as ViewType)} className={`px-6 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${view === v ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>
                            {v === 'pos' ? 'البيع' : v === 'inventory' ? 'المخزن' : v === 'accounting' ? 'التقارير' : v === 'expenses' ? 'المنصرفات' : 'الملاحظات'}
                        </button>
                    ))}
                </div>
            </header>
            <main className="flex-grow overflow-y-auto p-4 pb-48 no-scrollbar">
                {view === 'pos' && (
                    <div className="animate-in fade-in duration-300">
                        <div className="flex gap-2 items-center mb-4">
                            <div className="relative flex-grow">
                                <input type="text" placeholder="بحث سريع باسم المنتج أو الباركود..." className="w-full bg-white rounded-3xl py-4 pr-12 pl-4 text-lg font-bold shadow-sm border-2 border-transparent focus:border-emerald-500 outline-none transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                            </div>
                            <button onClick={() => setIsWantedOpen(true)} className="p-4 bg-white rounded-3xl shadow-sm border-2 border-transparent text-slate-400 hover:text-emerald-600 transition-all active:scale-95">
                                <NotebookPen size={24} />
                            </button>
                            <button onClick={() => setIsWantedListOpen(true)} className="p-4 bg-white rounded-3xl shadow-sm border-2 border-transparent text-slate-400 hover:text-emerald-600 transition-all active:scale-95 group relative">
                                <ClipboardList size={24} />
                                {wantedItems.filter((i: WantedItem) => i.status === 'pending').length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full font-black">
                                        {wantedItems.filter((i: WantedItem) => i.status === 'pending').length}
                                    </span>
                                )}
                            </button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-6">
                            {categories.map((c: string) => (
                                <button key={c} onClick={() => setActiveCategory(c)} className={`px-6 py-3 rounded-2xl font-black text-xs whitespace-nowrap transition-all ${activeCategory === c ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                    {c}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {posItems.map((m: Medicine) => (
                                <div key={m.id} onClick={() => addToCart(m)} className={`p-5 rounded-[35px] bg-white border-2 flex justify-between items-center transition-all active:scale-95 ${cart.has(m.id!) ? 'border-emerald-500 bg-emerald-50/20' : 'border-transparent shadow-sm'}`}>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg">{m.name}</h3>
                                        <div className="text-[10px] font-black flex items-center gap-2 mt-1">
                                            <span className={`${m.stock <= 5 ? 'text-rose-500' : 'text-emerald-600'}`}>متاح: {m.stock}</span>
                                            <span className="text-slate-200">|</span>
                                            <span className="text-slate-400">{m.category}</span>
                                        </div>
                                    </div>
                                    <div className="text-left shrink-0">
                                        <div className="text-xl font-black text-emerald-700">{(m.price || 0).toFixed(2)}</div>
                                        {cart.has(m.id!) && (
                                            <div className="flex items-center gap-2 mt-2" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                <button onClick={() => removeFromCart(m.id!)} className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><Minus size={14} /></button>
                                                <span className="text-sm font-black text-slate-700">{cart.get(m.id!)?.quantity}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => addToCart(m)} onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); addToCart(m, true); }} className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center relative shadow-sm active:scale-95 transition-all">
                                                        <Plus size={14} />
                                                        {m.unitsPerPkg && m.unitsPerPkg > 0 && <span className="absolute -top-1 -right-1 text-[8px]">📦</span>}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {view === 'inventory' && (
                    <div className="space-y-4 animate-in slide-in-from-left duration-300">
                        {/* Inventory Search Bar */}
                        <div className="relative">
                            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="ابحث في المخزن (اسم أو باركود)..."
                                className="w-full bg-slate-50 p-6 pr-14 rounded-[35px] font-bold outline-none border-2 border-transparent focus:border-emerald-500 transition-all"
                                value={invSearchQuery}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div className="bg-slate-900 p-6 rounded-[40px] text-white shadow-2xl col-span-4 relative overflow-hidden">
                                <div className="relative z-10 flex justify-between items-center">
                                    <div className="space-y-4">
                                        <div>
                                            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">القيمة الإجمالية للمخزن</div>
                                            <div className={`text-3xl font-black tabular-nums transition-all ${!isAdminUnlocked ? 'blur-md select-none' : ''}`}>
                                                {isAdminUnlocked ? inventoryValue.sell.toLocaleString() : '---'}
                                                <span className="text-xs font-normal opacity-50 ml-1">ج.م</span>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-white/10">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">رأس المال (التكلفة)</div>
                                            <div className={`text-xl font-bold tabular-nums text-slate-300 transition-all ${!isAdminUnlocked ? 'blur-md select-none' : ''}`}>
                                                {isAdminUnlocked ? inventoryValue.cost.toLocaleString() : '---'}
                                                <span className="text-xs font-normal opacity-50 ml-1">ج.م</span>
                                            </div>
                                        </div>
                                    </div>
                                    {!isAdminUnlocked ? (
                                        <button onClick={() => setIsUnlockSheetOpen(true)} className="w-14 h-14 bg-emerald-500 text-white rounded-3xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
                                            <ShieldAlert size={28} />
                                        </button>
                                    ) : (
                                        <div className="w-14 h-14 bg-white/5 rounded-3xl flex items-center justify-center text-emerald-400 border border-white/10">
                                            <Layers size={28} />
                                        </div>
                                    )}
                                </div>
                                {!isAdminUnlocked && (
                                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-0 flex items-center justify-center">
                                        <div className="text-[10px] font-black text-white/40 uppercase tracking-tighter">قفل إداري نشط</div>
                                    </div>
                                )}
                                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full"></div>
                            </div>
                            <div className="bg-amber-50 p-4 rounded-[30px] border border-amber-100 col-span-2">
                                <div className="text-[8px] font-black text-amber-600 uppercase mb-1">نسبة التداول</div>
                                <div className="text-lg font-black text-amber-900">{inventoryAnalytics.salesRate.toFixed(1)}%</div>
                            </div>
                            <div className="bg-rose-50 p-4 rounded-[30px] border border-rose-100 col-span-2">
                                <div className="text-[8px] font-black text-rose-600 uppercase mb-1">أصناف راكدة</div>
                                <div className="text-lg font-black text-rose-900">{inventoryAnalytics.stagnantCount}</div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-[35px] shadow-sm border border-slate-100 space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <select className="bg-slate-50 p-3 rounded-2xl text-[10px] font-black border-none outline-none" value={invStockFilter} onChange={e => setInvStockFilter(e.target.value as any)}>
                                    <option value="all">كل المخزون</option>
                                    <option value="low">النواقص (10 فأقل)</option>
                                    <option value="out">نفد المخزون</option>
                                    <option value="unsold">ما لم يُبع</option>
                                    <option value="stagnant">منتجات راكدة</option>
                                    <option value="fragmented">عبوات مفتوحة</option>
                                </select>
                                <select className="bg-slate-50 p-3 rounded-2xl text-[10px] font-black border-none outline-none" value={invExpiryFilter} onChange={e => setInvExpiryFilter(e.target.value as any)}>
                                    <option value="all">كل التواريخ</option>
                                    <option value="expired">منتهي الصلاحية</option>
                                    <option value="near">قريب الانتهاء</option>
                                </select>
                                <select className="bg-slate-50 p-3 rounded-2xl text-[10px] font-black border-none outline-none" value={invSupplierFilter} onChange={e => setInvSupplierFilter(e.target.value)}>
                                    {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <select className="bg-slate-50 p-3 rounded-2xl text-[10px] font-black border-none outline-none" value={invCategoryFilter} onChange={e => setInvCategoryFilter(e.target.value)}>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-2xl border border-transparent focus-within:border-emerald-500 transition-all">
                                    <Calendar size={14} className="text-slate-400" />
                                    <input type="date" className="bg-transparent text-[10px] font-black outline-none" value={invDateFilter} onChange={e => setInvDateFilter(e.target.value)} />
                                    {invDateFilter && <button onClick={() => setInvDateFilter('')} className="text-rose-500"><X size={12} /></button>}
                                </div>
                            </div>

                            <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="p-4">الصنف</th>
                                            <th className="p-4">الكمية</th>
                                            <th className="p-4">الأسعار</th>
                                            <th className="p-4">تاريخ الشراء</th>
                                            <th className="p-4">الانتهاء</th>
                                            <th className="p-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 font-bold">
                                        {filteredInventory.map(m => (
                                            <tr
                                                key={m.id}
                                                className={`transition-colors cursor-pointer select-none ${selectedIds.has(m.id) ? 'bg-emerald-100/50' : 'hover:bg-slate-50'}`}
                                                onMouseDown={() => startSelect(m.id!)}
                                                onMouseUp={stopSelect}
                                                onMouseLeave={stopSelect}
                                                onTouchStart={() => startSelect(m.id!)}
                                                onTouchEnd={stopSelect}
                                                onClick={() => selectedIds.size > 0 && toggleSelect(m.id!)}
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        {selectedIds.size > 0 && (
                                                            <div className={`w-4 h-4 rounded-full border-2 transition-all ${selectedIds.has(m.id) ? 'bg-emerald-500 border-emerald-500 scale-110' : 'border-slate-300'}`} />
                                                        )}
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-slate-800 text-sm font-black">{m.name}</div>
                                                                {!m.lastSold && <span className="text-[7px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-full font-black animate-pulse">جديد</span>}
                                                                {m.lastSold && (now - (typeof m.lastSold === 'number' ? m.lastSold : 0) > 60 * 24 * 60 * 60 * 1000) && <span className="text-[7px] px-1.5 py-0.5 bg-amber-50 text-amber-500 rounded-full font-black">راكد</span>}
                                                            </div>
                                                            <div className="text-[9px] text-slate-300">{m.supplier || 'بدون مورد'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className={`px-2 py-1 rounded-lg ${m.stock <= 10 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                                            {m.unitsPerPkg && m.unitsPerPkg > 1
                                                                ? `${Math.floor(m.stock / m.unitsPerPkg)} عبوة + ${m.stock % m.unitsPerPkg} حبة`
                                                                : `${m.stock}`}
                                                        </span>
                                                        {m.unitsPerPkg && m.unitsPerPkg > 1 && (m.stock % m.unitsPerPkg !== 0) && (
                                                            <span className="text-[8px] font-black text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full">📦 عبوة مكسورة</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="text-emerald-700 font-black">{(m.price || 0).toFixed(2)}</div>
                                                        <div className="text-slate-400 text-[10px]">{(m.costPrice || 0).toFixed(2)}</div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-400 whitespace-nowrap text-[10px]">{m.addedDate || 'غير محدد'}</td>
                                                <td className="p-4 text-slate-400 whitespace-nowrap">{m.expiryDate}</td>
                                                <td className="p-4 text-left">
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingMed(m); setIsEditOpen(true); }} className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"><Edit3 size={16} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'accounting' && (
                    <div className="space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="bg-slate-900 p-8 rounded-[45px] text-white shadow-2xl relative overflow-hidden">
                            <div className="relative z-10 space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">صافي الربح المالي</span>
                                        <h2 className={`text-4xl font-black tabular-nums mt-1 transition-all ${!isAdminUnlocked ? 'blur-lg select-none' : ''}`}>
                                            {isAdminUnlocked ? (financeStats.profit || 0).toFixed(2) : '00.00'}
                                            <span className="text-xs font-normal opacity-50 ml-1">ج.م</span>
                                        </h2>
                                    </div>
                                    {!isAdminUnlocked ? (
                                        <button onClick={() => setIsUnlockSheetOpen(true)} className="p-3 bg-rose-500 text-white rounded-2xl animate-pulse"><ShieldAlert size={28} /></button>
                                    ) : (
                                        <div className="p-3 bg-white/10 rounded-2xl text-emerald-400"><TrendingUp size={28} /></div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-6">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">البيع الكلي</span>
                                        <div className={`text-xl font-black transition-all ${!isAdminUnlocked ? 'blur-md select-none' : ''}`}>
                                            {isAdminUnlocked ? (financeStats.sales || 0).toFixed(2) : '---'}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">التكلفة</span>
                                        <div className={`text-xl font-black text-slate-500 transition-all ${!isAdminUnlocked ? 'blur-md select-none' : ''}`}>
                                            {isAdminUnlocked ? (financeStats.costs || 0).toFixed(2) : '---'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {!isAdminUnlocked && (
                                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-20 flex items-center justify-center p-8 text-center">
                                    <div className="space-y-2">
                                        <div className="text-xs font-black text-white/50 uppercase">البيانات المالية مقفلة</div>
                                        <button onClick={() => setIsUnlockSheetOpen(true)} className="text-xs font-black bg-white text-slate-900 px-6 py-2 rounded-full">إظهار الأرقام</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            {/* Enhanced Filter Bar */}
                            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                                {/* Status Indicator */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full animate-pulse ${
                                            salesHistory.some(s => s.isReturned) ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`} title={
                                            salesHistory.some(s => s.isReturned) ? 'يوجد مرجعات' : 'التقارير نظيفة'
                                        }></div>
                                        <span className="text-xs font-black text-slate-400 uppercase">
                                            {salesHistory.some(s => s.isReturned) ? 'يوجد مرجعات' : 'التقارير نظيفة'}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Filter Controls */}
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl">
                                        <Calendar className="text-emerald-600" size={16} />
                                        <input type="date" className="bg-transparent font-black outline-none text-sm" value={accDateFilter} onChange={e => setAccDateFilter(e.target.value)} />
                                    </div>
                                    
                                    <div className="w-px h-6 bg-slate-200"></div>
                                    
                                    <select className="bg-slate-50 px-3 py-2 rounded-xl font-black outline-none text-sm" value={accPaymentFilter} onChange={e => { setAccPaymentFilter(e.target.value as any); setDebtorDetailName(null); }}>
                                        <option value="all">كل العمليات</option>
                                        <option value="cash">كاش</option>
                                        <option value="bank">بنكك</option>
                                        <option value="debt">مديونيات</option>
                                    </select>
                                    
                                    <div className="w-px h-6 bg-slate-200"></div>
                                    
                                    {/* Returns Filter */}
                                    <button
                                        onClick={() => setShowReturns(!showReturns)}
                                        className={`px-3 py-2 rounded-xl font-black text-sm transition-all ${
                                            showReturns ? 'bg-amber-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-amber-50'
                                        }`}
                                    >
                                        المرجعات {showReturns && '✓'}
                                    </button>
                                    
                                    {/* Deleted Filter */}
                                    <button
                                        onClick={() => setShowDeleted(!showDeleted)}
                                        className={`px-3 py-2 rounded-xl font-black text-sm transition-all ${
                                            showDeleted ? 'bg-rose-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-rose-50'
                                        }`}
                                    >
                                        المحذوفات {showDeleted && '✓'}
                                    </button>
                                    
                                    <div className="w-px h-6 bg-slate-200"></div>
                                    
                                    {/* Reset History Button */}
                                    <button
                                        onClick={() => setShowResetHistory(!showResetHistory)}
                                        className="px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-sm hover:bg-emerald-100 transition-all"
                                    >
                                        سجل التصفير
                                    </button>
                                </div>
                            </div>

                            {accPaymentFilter === 'debt' && (
                                <div className="relative">
                                    <input type="text" placeholder="بحث باسم المديون..." className="w-full bg-white rounded-2xl py-3 pr-10 pl-4 text-xs font-bold border border-slate-100 outline-none focus:border-amber-400" value={accSearchQuery} onChange={e => setAccSearchQuery(e.target.value)} />
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            {accPaymentFilter === 'debt' && !debtorDetailName ? (
                                Array.from(debtorsMap.entries()).map(([name, data]) => (
                                    <div key={name} onClick={() => setDebtorDetailName(name)} className="p-6 rounded-[35px] bg-white border-2 border-amber-50 shadow-sm flex justify-between items-center cursor-pointer hover:border-amber-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 font-black">{name[0]}</div>
                                            <div>
                                                <div className="font-black text-slate-800">{name}</div>
                                                <div className="text-[10px] font-bold text-slate-400">{data.transactions.length} مديونية مسجلة</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-amber-700">{(data.total || 0).toFixed(2)} <span className="text-[8px]">ج.م</span></div>
                                            <div className="text-[9px] font-bold text-slate-300 flex items-center gap-1">التفاصيل <ChevronLeft size={10} /></div>
                                        </div>
                                    </div>
                                ))
                            ) : accPaymentFilter === 'debt' && debtorDetailName ? (
                                <div className="space-y-4">
                                    <button onClick={() => setDebtorDetailName(null)} className="flex items-center gap-2 text-slate-400 font-black text-xs hover:text-slate-600"><ChevronRight size={16} /> العودة لقائمة المديونيات</button>
                                    <div className="bg-amber-600 p-6 rounded-[35px] text-white shadow-xl mb-4">
                                        <div className="text-[9px] font-black opacity-70">إجمالي دين {debtorDetailName}</div>
                                        <div className="text-3xl font-black">{(debtorsMap.get(debtorDetailName)?.total || 0).toFixed(2)} ج.م</div>
                                    </div>
                                    {debtorsMap.get(debtorDetailName)?.transactions.map((t: any) => (
                                        <div key={t.id}
                                            className={`p-5 rounded-[30px] bg-white border transition-all ${selectedIds.has(t.id) ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-100'}`}
                                            onMouseDown={() => startSelect(t.id)}
                                            onMouseUp={stopSelect}
                                            onMouseLeave={stopSelect}
                                            onTouchStart={() => startSelect(t.id)}
                                            onTouchEnd={stopSelect}
                                            onClick={() => selectedIds.size > 0 && toggleSelect(t.id)}
                                        >
                                            <div className="flex justify-between mb-3 border-b border-slate-50 pb-2">
                                                <span className="text-[10px] font-black text-slate-400">{t.date}</span>
                                                <span className="text-sm font-black text-amber-600">{(t.amount || 0).toFixed(2)} ج.م</span>
                                            </div>
                                            <div className="space-y-1">
                                                {t.items.map((it: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between text-[10px] font-bold text-slate-500">
                                                        <span>{it.medicine.name} × {it.quantity}</span>
                                                        <span>{((it.price || 0) * (it.quantity || 0)).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                filteredSales.filtered.map(s => (
                                    <div key={s.id}
                                        className={`p-6 rounded-[35px] bg-white border transition-all shadow-sm flex flex-col gap-4 ${s.isReturned ? 'opacity-40 grayscale' : ''} ${selectedIds.has(s.id) ? 'border-emerald-500 bg-emerald-100/30' : 'border-slate-100'}`}
                                        onMouseDown={() => startSelect(s.id!)}
                                        onMouseUp={stopSelect}
                                        onMouseLeave={stopSelect}
                                        onTouchStart={() => startSelect(s.id!)}
                                        onTouchEnd={stopSelect}
                                        onClick={() => selectedIds.size > 0 && toggleSelect(s.id!)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                {selectedIds.size > 0 && (
                                                    <div className={`w-4 h-4 rounded-full border-2 transition-all ${selectedIds.has(s.id) ? 'bg-emerald-500 border-emerald-500 scale-110' : 'border-slate-300'}`} />
                                                )}
                                                <div>
                                                    <div className="text-xl font-black text-slate-800">{(s.netAmount || 0).toFixed(2)} ج.م</div>
                                                    <div className="text-[9px] font-bold text-slate-400">{new Date(s.timestamp).toLocaleString('ar-EG')}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {(s.cashAmount || 0) > 0 && <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Wallet size={16} /></div>}
                                                {(s.bankAmount || 0) > 0 && <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><CreditCard size={16} /></div>}
                                                {(s.debtAmount || 0) > 0 && <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><UserMinus size={16} /></div>}
                                            </div>
                                        </div>



                                        {!s.isReturned && (
                                            <div className="border-t border-slate-50 pt-2.5 space-y-1.5">
                                                {/* Compact Items Display */}
                                                {s.itemsJson && (() => {
                                                    const items = parseItemsJson(s.itemsJson);
                                                    if (items.length === 0) return null;
                                                    const displayItems = items.slice(0, 2);
                                                    const remaining = items.length - displayItems.length;
                                                    return (
                                                        <div className="flex flex-wrap gap-1">
                                                            {displayItems.map((itemName: string, idx: number) => (
                                                                <span key={idx} className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded text-[9px] font-medium">
                                                                    {itemName}
                                                                </span>
                                                            ))}
                                                            {remaining > 0 && (
                                                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold">
                                                                    +{remaining}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-slate-400">{s.customerName || 'زبون عام'}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); handleReturn(s.id); }} className="text-rose-500 font-black text-[10px] px-4 py-2 hover:bg-rose-50 rounded-xl transition-all">إرجاع</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {view === 'expenses' && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 relative">
                            <button onClick={() => setView('pos')} className="absolute left-6 top-8 p-2 text-slate-300 hover:text-rose-500 transition-all">
                                <X size={24} />
                            </button>
                            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">إضافة منصرف</h2>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const f = e.target as any;
                                await db.expenses.add({
                                    id: crypto.randomUUID(),
                                    pharmacyId: currentPharmacy?.id,
                                    amount: parseFloat(f.amt.value),
                                    type: f.typ.value,
                                    description: f.dsc.value,
                                    timestamp: Date.now()
                                });
                                f.reset(); loadData();
                                triggerNotif("تمت إضافة المنصرف", "info");
                            }} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <input name="amt" type="number" step="0.01" placeholder="المبلغ" required className="bg-slate-50 p-4 rounded-3xl font-black outline-none border-2 border-transparent focus:border-emerald-500" />
                                    <input name="typ" list="exp-types" placeholder="النوع" required className="bg-slate-50 p-4 rounded-3xl font-black outline-none border-2 border-transparent focus:border-emerald-500" />
                                </div>
                                <input name="dsc" type="text" placeholder="ملاحظات..." className="w-full bg-slate-50 p-4 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" />
                                <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black shadow-lg active:scale-95 transition-all">حفظ المنصرف</button>
                            </form>
                            <datalist id="exp-types">{expenseTypes.map(t => <option key={t} value={t} />)}</datalist>
                        </div>

                        <div className="bg-rose-600 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
                            {!isAdminUnlocked && (
                                <div className="absolute inset-0 bg-rose-900/40 backdrop-blur-md z-20 flex items-center justify-center p-4 text-center">
                                    <button onClick={() => setIsUnlockSheetOpen(true)} className="text-[10px] font-black bg-white text-rose-600 px-4 py-2 rounded-full shadow-lg">إظهار الحسابات</button>
                                </div>
                            )}
                            <h3 className="text-[10px] font-black uppercase opacity-60">إجمالي المنصرفات (الفترة الحالية)</h3>
                            <div className="text-3xl font-black tabular-nums mt-1">{(expensesFinancials.totalExp || 0).toFixed(2)} ج.م</div>
                            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between">
                                <span className="text-xs font-bold">صافي الربح النهائي:</span>
                                <span className="text-xl font-black">{(expensesFinancials.netProfit || 0).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                            <input type="date" className="bg-white px-5 py-3 rounded-2xl font-black text-xs border border-slate-100 shadow-sm" value={expStartDate} onChange={e => setExpStartDate(e.target.value)} />
                            <input type="date" className="bg-white px-5 py-3 rounded-2xl font-black text-xs border border-slate-100 shadow-sm" value={expEndDate} onChange={e => setExpEndDate(e.target.value)} />
                        </div>

                        <div className="space-y-3">
                            {expensesFinancials.list.map(e => (
                                <div key={e.id}
                                    className={`p-6 rounded-[35px] bg-white border transition-all shadow-sm flex justify-between items-center ${selectedIds.has(e.id) ? 'border-emerald-500 bg-emerald-100/30' : 'border-slate-100 hover:border-emerald-200'}`}
                                    onMouseDown={() => startSelect(e.id!)}
                                    onMouseUp={stopSelect}
                                    onMouseLeave={stopSelect}
                                    onTouchStart={() => startSelect(e.id!)}
                                    onTouchEnd={stopSelect}
                                    onClick={() => selectedIds.size > 0 && toggleSelect(e.id!)}
                                >
                                    <div className="flex items-center gap-4">
                                        {selectedIds.size > 0 && (
                                            <div className={`w-4 h-4 rounded-full border-2 transition-all ${selectedIds.has(e.id) ? 'bg-emerald-500 border-emerald-500 scale-110' : 'border-slate-300'}`} />
                                        )}
                                        <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
                                            <Receipt size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black text-rose-500 uppercase">{e.type}</div>
                                            <div className="font-bold text-slate-800 text-sm mt-1">{e.description || 'منصرف عام'}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="text-xl font-black text-rose-600">-{e.amount.toFixed(2)}</div>
                                        <div className="text-[9px] text-slate-300 font-bold">{new Date(e.timestamp).toLocaleDateString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'calculator' && (
                    <div className="p-6 animate-in fade-in duration-500">
                        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-6">
                            {/* الشاشة */}
                            <div className="bg-slate-900 text-emerald-400 p-6 rounded-2xl text-right text-3xl font-mono mb-4">
                                {calcDisplay || '0'}
                            </div>
                            
                            {/* الأزرار */}
                            <div className="grid grid-cols-4 gap-3">
                                {/* الصف الأول */}
                                <button onClick={() => handleCalcClear()} className="bg-rose-500 text-white p-4 rounded-xl font-bold hover:bg-rose-600 transition-all">C</button>
                                <button onClick={() => handleCalcOperator('/')} className="bg-slate-200 p-4 rounded-xl font-bold hover:bg-slate-300 transition-all">÷</button>
                                <button onClick={() => handleCalcOperator('*')} className="bg-slate-200 p-4 rounded-xl font-bold hover:bg-slate-300 transition-all">×</button>
                                <button onClick={() => handleCalcDelete()} className="bg-amber-500 text-white p-4 rounded-xl font-bold hover:bg-amber-600 transition-all">←</button>
                                
                                {/* الصف الثاني */}
                                <button onClick={() => handleCalcNumber('7')} className="bg-slate-50 p-4 rounded-xl font-bold hover:bg-slate-100 transition-all">7</button>
                                <button onClick={() => handleCalcNumber('8')} className="bg-slate-50 p-4 rounded-xl font-bold hover:bg-slate-100 transition-all">8</button>
                                <button onClick={() => handleCalcNumber('9')} className="bg-slate-50 p-4 rounded-xl font-bold hover:bg-slate-100 transition-all">9</button>
                                <button onClick={() => handleCalcOperator('-')} className="bg-amber-500 text-white p-4 rounded-xl font-bold hover:bg-amber-600 transition-all">-</button>
                                
                                {/* الصف الثالث */}
                                <button onClick={() => handleCalcNumber('4')} className="bg-slate-50 p-4 rounded-xl font-bold hover:bg-slate-100 transition-all">4</button>
                                <button onClick={() => handleCalcNumber('5')} className="bg-slate-50 p-4 rounded-xl font-bold hover:bg-slate-100 transition-all">5</button>
                                <button onClick={() => handleCalcNumber('6')} className="bg-slate-50 p-4 rounded-xl font-bold hover:bg-slate-100 transition-all">6</button>
                                <button onClick={() => handleCalcOperator('+')} className="bg-emerald-500 text-white p-4 rounded-xl font-bold hover:bg-emerald-600 transition-all">+</button>
                                
                                {/* الصف الرابع */}
                                <button onClick={() => handleCalcNumber('1')} className="bg-slate-50 p-4 rounded-xl font-bold hover:bg-slate-100 transition-all">1</button>
                                <button onClick={() => handleCalcNumber('2')} className="bg-slate-50 p-4 rounded-xl font-bold hover:bg-slate-100 transition-all">2</button>
                                <button onClick={() => handleCalcNumber('3')} className="bg-slate-50 p-4 rounded-xl font-bold hover:bg-slate-100 transition-all">3</button>
                                <button onClick={() => handleCalcEquals()} className="bg-emerald-600 text-white p-4 rounded-xl font-bold hover:bg-emerald-700 transition-all">=</button>
                                
                                {/* الصف الخامس */}
                                <button onClick={() => handleCalcNumber('0')} className="bg-slate-50 p-4 rounded-xl font-bold hover:bg-slate-100 transition-all col-span-2">0</button>
                                <button onClick={() => handleCalcDecimal()} className="bg-slate-50 p-4 rounded-xl font-bold hover:bg-slate-100 transition-all">.</button>
                                <button onClick={() => handleCalcDelete()} className="bg-amber-500 text-white p-4 rounded-xl font-bold hover:bg-amber-600 transition-all">←</button>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'scanner' && (
                    <div className="p-6 animate-in fade-in duration-500">
                        <div className="max-w-md mx-auto">
                            {/* Scanner Mode Selector */}
                            <div className="bg-white rounded-3xl shadow-2xl p-6 mb-4">
                                <h2 className="text-2xl font-black text-slate-800 mb-6 text-center">ماسح الباركود</h2>
                                
                                {/* Mode Selection */}
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <button
                                        onClick={() => setScannerMode('sell')}
                                        className={`p-4 rounded-2xl font-black transition-all ${
                                            scannerMode === 'sell' 
                                                ? 'bg-emerald-600 text-white shadow-lg' 
                                                : 'bg-slate-50 text-slate-600 hover:bg-emerald-50'
                                        }`}
                                    >
                                        <ShoppingCart className="mx-auto mb-2" size={24} />
                                        <div className="text-sm">بيع</div>
                                        <div className="text-xs opacity-75">إضافة للسلة</div>
                                    </button>
                                    <button
                                        onClick={() => setScannerMode('add')}
                                        className={`p-4 rounded-2xl font-black transition-all ${
                                            scannerMode === 'add' 
                                                ? 'bg-blue-600 text-white shadow-lg' 
                                                : 'bg-slate-50 text-slate-600 hover:bg-blue-50'
                                        }`}
                                    >
                                        <Package className="mx-auto mb-2" size={24} />
                                        <div className="text-sm">إضافة</div>
                                        <div className="text-xs opacity-75">تعديل دواء</div>
                                    </button>
                                </div>
                                
                                {/* Scanner Controls */}
                                {!isScannerActive ? (
                                    <div className="space-y-3">
                                        <button
                                            onClick={handleStartScanner}
                                            className="w-full bg-emerald-600 text-white p-6 rounded-3xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                                        >
                                            <Camera size={32} />
                                            بدء المسح
                                        </button>
                                        <button
                                            onClick={handleManualBarcodeInput}
                                            className="w-full bg-slate-200 text-slate-700 p-4 rounded-2xl font-black hover:bg-slate-300 transition-all"
                                        >
                                            إدخال الباركود يدوياً
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Active Scanner View */}
                                        <div className="bg-slate-900 rounded-2xl p-8 relative overflow-hidden">
                                            <div className="absolute inset-0 border-2 border-emerald-500 rounded-2xl animate-pulse"></div>
                                            <div className="relative z-10 text-center">
                                                <ScanLine className="mx-auto mb-4 text-emerald-400" size={64} />
                                                <p className="text-emerald-400 font-bold">وجه الكاميرا نحو الباركود</p>
                                                <p className="text-slate-400 text-sm mt-2">سيتم التعرف تلقائياً...</p>
                                            </div>
                                        </div>
                                        
                                        <button
                                            onClick={handleStopScanner}
                                            className="w-full bg-rose-500 text-white p-4 rounded-2xl font-black hover:bg-rose-600 transition-all"
                                        >
                                            إلغاء المسح
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {/* Scanner Result Modal */}
                            {showScannerResult && (
                                <div className="bg-white rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-300">
                                    <h3 className="text-lg font-black text-slate-800 mb-4">نتيجة المسح</h3>
                                    
                                    {scannedBarcode && (
                                        <div className="bg-slate-50 p-4 rounded-xl mb-4">
                                            <p className="text-sm font-bold text-slate-600">الباركود:</p>
                                            <p className="text-lg font-mono font-black">{scannedBarcode}</p>
                                        </div>
                                    )}
                                    
                                    {foundMedicine ? (
                                        <div className="bg-emerald-50 p-4 rounded-xl mb-4">
                                            <p className="text-sm font-bold text-emerald-600">الدواء:</p>
                                            <p className="text-lg font-black">{foundMedicine.name}</p>
                                            <p className="text-sm text-emerald-700">السعر: {foundMedicine.price} ج.م</p>
                                            <p className="text-sm text-emerald-700">المخزون: {foundMedicine.stock}</p>
                                        </div>
                                    ) : (
                                        <div className="bg-rose-50 p-4 rounded-xl mb-4">
                                            <p className="text-sm font-bold text-rose-600">النتيجة:</p>
                                            <p className="text-lg font-black text-rose-700">الدواء غير موجود</p>
                                        </div>
                                    )}
                                    
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowScannerResult(false)}
                                            className="flex-1 bg-slate-200 text-slate-700 p-3 rounded-xl font-black hover:bg-slate-300 transition-all"
                                        >
                                            إغلاق
                                        </button>
                                        {foundMedicine && scannerMode === 'sell' && (
                                            <button
                                                onClick={() => {
                                                    setView('pos');
                                                    setShowScannerResult(false);
                                                }}
                                                className="flex-1 bg-emerald-600 text-white p-3 rounded-xl font-black hover:bg-emerald-700 transition-all"
                                            >
                                                عرض السلة
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {view === 'notifications' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        <div className="flex justify-between items-center px-2 mb-6">
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">الإشعارات {notifs.length > 0 && <span className="text-sm bg-rose-100 text-rose-600 px-3 py-1 rounded-full">{notifs.length}</span>}</h2>
                            <button onClick={async () => { if (confirm('مسح كل الإشعارات؟')) { await db.notifications.clear(); loadData(); } }} className="text-xs font-black text-rose-500 bg-rose-50 px-5 py-2.5 rounded-2xl">تفريغ</button>
                        </div>
                        <div className="space-y-3">
                            {notifs.map(n => (
                                <div key={n.id} className={`p-6 rounded-[35px] border-l-8 bg-white shadow-sm flex items-start gap-4 transition-all hover:scale-[1.02] ${n.type === 'error' ? 'border-rose-500' : n.type === 'warning' ? 'border-amber-500' : 'border-emerald-500'}`}>
                                    <div className={`mt-1 p-2 rounded-xl ${n.type === 'error' ? 'bg-rose-50 text-rose-500' : n.type === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                        <ShieldAlert size={20} />
                                    </div>
                                    <div className="flex-grow">
                                        <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{new Date(n.timestamp).toLocaleString('ar-EG')}</div>
                                        <p className="text-slate-800 font-bold text-sm leading-relaxed mt-1">{n.message}</p>
                                    </div>
                                    <button onClick={async () => { await db.notifications.delete(n.id!); loadData(); }} className="text-slate-200 hover:text-rose-500"><X size={16} /></button>
                                </div>
                            ))}
                            {notifs.length === 0 && (
                                <div className="text-center py-20 opacity-20"><Bell size={64} className="mx-auto mb-4" /><p className="font-black">لا توجد إشعارات جديدة</p></div>
                            )}
                        </div>
                    </div>
                )}

                {view === 'notes' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        <div className="flex justify-between items-center px-2 mb-6">
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">الملاحظات {notes.length > 0 && <span className="text-sm bg-blue-100 text-blue-600 px-3 py-1 rounded-full">{notes.length}</span>}</h2>
                            <button onClick={() => { setEditingNote(null); setNoteData({ title: '', content: '', type: 'private' }); setIsNoteModalOpen(true); }} className="text-xs font-black text-blue-600 bg-blue-50 px-5 py-2.5 rounded-2xl">إضافة ملاحظة</button>
                        </div>
                        
                        {/* Filters */}
                        <div className="flex gap-2 mb-4">
                            <select value={notesFilter} onChange={(e) => setNotesFilter(e.target.value as 'all' | 'private' | 'public')} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold">
                                <option value="all">الكل</option>
                                <option value="private">خاصة</option>
                                <option value="public">عامة</option>
                            </select>
                            <input type="date" value={notesDateFilter} onChange={(e) => setNotesDateFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold" />
                        </div>
                        
                        <div className="space-y-3">
                            {filteredNotes.map(note => (
                                <div key={note.id} className={`p-6 rounded-[35px] bg-white shadow-sm border transition-all hover:scale-[1.02] ${note.type === 'private' ? 'border-amber-200' : 'border-blue-200'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-2 rounded-xl ${note.type === 'private' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'}`}>
                                                <NotebookPen size={16} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800">{note.title}</h3>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {new Date(note.createdAt).toLocaleString('ar-EG')} • {note.type === 'private' ? 'خاصة' : 'عامة'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingNote(note); setNoteData({ title: note.title, content: note.content, type: note.type }); setIsNoteModalOpen(true); }} className="text-slate-300 hover:text-blue-500"><Edit3 size={16} /></button>
                                            <button onClick={async () => { if (confirm('حذف هذه الملاحظة؟')) { await db.notes.update(note.id, { isDeleted: true }); loadData(); } }} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <p className="text-slate-700 text-sm leading-relaxed">{note.content}</p>
                                </div>
                            ))}
                            {filteredNotes.length === 0 && (
                                <div className="text-center py-20 opacity-20"><NotebookPen size={64} className="mx-auto mb-4" /><p className="font-black">لا توجد ملاحظات</p></div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Cart Summary Bar */}
            {view === 'pos' && cart.size > 0 && (
                <div className="fixed bottom-28 left-0 right-0 px-6 z-40 animate-in slide-in-from-bottom duration-500">
                    <div className="max-w-xl mx-auto bg-slate-900 text-white p-6 rounded-[40px] shadow-2xl flex items-center justify-between border border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-3xl bg-emerald-600 flex items-center justify-center text-white font-black text-xl shadow-lg">{Array.from(cart.values()).reduce((s, i) => s + i.quantity, 0)}</div>
                            <div>
                                <div className="text-2xl font-black tabular-nums">{Array.from(cart.values()).reduce((s, i) => s + (i.medicine.price * i.quantity), 0).toFixed(2)} <span className="text-[10px] opacity-50">ج.م</span></div>
                                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">إجمالي الطلبية</div>
                            </div>
                        </div>
                        <button onClick={() => {
                            const total = Array.from(cart.values()).reduce((s, i) => s + (i.medicine.price * i.quantity), 0);
                            setPayData({ discount: '', cash: total.toString(), bank: '', debt: '', trx: '', cust: '' });
                            setIsCheckoutOpen(true);
                        }} className="bg-white text-slate-900 px-8 py-4 rounded-3xl font-black flex items-center gap-2 active:scale-95 transition-all shadow-xl">إتمام <ArrowRight size={20} /></button>
                    </div>
                </div>
            )}

            {/* Nav */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center px-4 pt-4 pb-12 z-30 shrink-0">
                <button onClick={() => setView('calculator')} className={`flex flex-col items-center gap-1 transition-all ${view === 'calculator' ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}>
                    <Calculator size={24} strokeWidth={view === 'calculator' ? 3 : 2} /> <span className="text-[10px] font-black uppercase">حاسبة</span>
                </button>
                <div className="relative -top-6">
                    <button
                        onClick={() => { setEditingMed(null); setIsEditOpen(true); }}
                        className="w-14 h-14 bg-emerald-600 rounded-[20px] shadow-2xl shadow-emerald-200 flex items-center justify-center text-white active:scale-95 transition-all rotate-45 group hover:rotate-[135deg]"
                    >
                        <Plus size={32} className="-rotate-45" />
                    </button>
                </div>
                <button onClick={() => setView('scanner')} className={`flex flex-col items-center gap-1 transition-all ${view === 'scanner' ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}>
                    <ScanLine size={24} strokeWidth={view === 'scanner' ? 3 : 2} /> <span className="text-[10px] font-black uppercase">مسح</span>
                </button>
            </nav>

            {/* Modals */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white w-full max-w-lg rounded-t-[45px] sm:rounded-[50px] shadow-2xl flex flex-col max-h-[95vh] animate-in slide-in-from-bottom">
                        <div className="p-10 pb-4 flex justify-between items-center">
                            <h2 className="text-3xl font-black text-slate-800">إتمام البيع</h2>
                            <button onClick={() => setIsCheckoutOpen(false)} className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all"><X /></button>
                        </div>
                        <div className="p-10 pt-4 space-y-6 overflow-y-auto no-scrollbar pb-16">
                            <div className="bg-emerald-50 p-8 rounded-[40px] border border-emerald-100 flex justify-between items-center shadow-inner">
                                <div>
                                    <div className="text-[10px] font-black text-emerald-600 opacity-60 uppercase tracking-widest">المبلغ المطلوب سداده</div>
                                    <div className="text-4xl font-black text-emerald-700 tabular-nums">
                                        {(Array.from(cart.values()).reduce((s, i) => s + (i.medicine.price * i.quantity), 0) - (parseFloat(payData.discount) || 0)).toFixed(2)}
                                    </div>
                                </div>
                                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-emerald-600 shadow-sm"><Receipt size={32} /></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-tighter">الخصم</label>
                                    <input type="number" onFocus={e => e.target.select()} className="w-full bg-slate-50 p-4 rounded-3xl font-black text-lg outline-none border-2 border-transparent focus:border-emerald-500 transition-all" value={payData.discount} onChange={e => setPayData({ ...payData, discount: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-emerald-500 mr-2 uppercase tracking-tighter">نقداً (كاش)</label>
                                    <input type="number" onFocus={e => e.target.select()} className="w-full bg-emerald-50/30 p-4 rounded-3xl font-black text-lg outline-none border-2 border-emerald-100 focus:border-emerald-500 transition-all" value={payData.cash} onChange={e => setPayData({ ...payData, cash: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-blue-500 mr-2 uppercase tracking-tighter">بنكك</label>
                                    <input type="number" onFocus={e => e.target.select()} className="w-full bg-blue-50/30 p-4 rounded-3xl font-black text-lg outline-none border-2 border-blue-100 focus:border-blue-500 transition-all" value={payData.bank} onChange={e => setPayData({ ...payData, bank: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-amber-600 mr-2 uppercase tracking-tighter">آجل (مديونية)</label>
                                    <input type="number" onFocus={e => e.target.select()} className="w-full bg-amber-50/30 p-4 rounded-3xl font-black text-lg outline-none border-2 border-amber-100 focus:border-amber-500 transition-all" value={payData.debt} onChange={e => setPayData({ ...payData, debt: e.target.value })} />
                                </div>
                            </div>

                            {(parseFloat(payData.bank) > 0) && (
                                <div className="animate-in zoom-in duration-300">
                                    <label className="text-[10px] font-black text-blue-400 mr-2">رقم العملية البنكية</label>
                                    <input type="text" placeholder="أدخل رقم العملية..." className="w-full bg-blue-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-blue-100 focus:border-blue-500" value={payData.trx} onChange={e => setPayData({ ...payData, trx: e.target.value })} />
                                </div>
                            )}

                            {(parseFloat(payData.debt) > 0) && (
                                <div className="animate-in slide-in-from-top duration-300">
                                    <label className="text-[10px] font-black text-amber-500 mr-2">اسم صاحب الدين</label>
                                    <input list="cust-list" type="text" placeholder="اختر من القائمة..." className="w-full bg-amber-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-amber-100 focus:border-amber-500" value={payData.cust} onChange={e => setPayData({ ...payData, cust: e.target.value })} />
                                    <datalist id="cust-list">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
                                </div>
                            )}

                            <button onClick={handleSale} className="w-full bg-slate-900 text-white py-6 rounded-[35px] font-black text-xl shadow-2xl active:scale-95 transition-all mt-6 flex items-center justify-center gap-3">
                                <CheckCircle2 size={24} /> تثبيت البيع النهائى
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isEditOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white w-full max-w-lg rounded-t-[45px] sm:rounded-[50px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom">
                        <div className="p-10 pb-4 flex justify-between items-center">
                            <h2 className="text-2xl font-black text-slate-800">{editingMed ? 'تعديل الصنف' : 'إضافة صنف لـ راحة'}</h2>
                            <button onClick={() => setIsEditOpen(false)} className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all"><X /></button>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const f = e.target as any;
                            const data: Medicine = {
                                id: editingMed?.id || crypto.randomUUID(),
                                pharmacyId: currentPharmacy?.id,
                                name: f.nm.value, barcode: f.bc.value, price: parseFloat(f.pr.value) || 0,
                                costPrice: parseFloat(f.cp.value) || 0, stock: parseInt(f.st.value) || 0,
                                category: f.ct.value, expiryDate: f.ex.value, supplier: f.sp.value,
                                supplierPhone: f.spp.value,
                                minStockAlert: parseInt(f.msa.value) || 0,
                                unitsPerPkg: f.up.value ? parseInt(f.up.value) : undefined,
                                addedDate: f.ad.value || new Date().toISOString().split('T')[0],
                                usageCount: editingMed?.usageCount || 0
                            };
                            if (editingMed?.id) await db.medicines.update(editingMed.id, data);
                            else await db.medicines.add(data);
                            setIsEditOpen(false); loadData();
                            triggerNotif("تم حفظ بيانات الصنف", "info");
                        }} className="p-10 pt-4 space-y-5 overflow-y-auto no-scrollbar pb-16">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2 flex items-center gap-1"><Info size={12} /> اسم المنتج</label>
                                <input name="nm" type="text" defaultValue={editingMed?.name} required className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500 transition-all" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-emerald-600 mr-2">سعر البيع</label>
                                    <input name="pr" type="number" step="0.01" onFocus={e => e.target.select()} defaultValue={editingMed?.price} required className="w-full bg-emerald-50/30 p-5 rounded-3xl font-black text-lg outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2">التكلفة</label>
                                    <input name="cp" type="number" step="0.01" onFocus={e => e.target.select()} defaultValue={editingMed?.costPrice} required className="w-full bg-slate-50 p-5 rounded-3xl font-black text-lg outline-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2">الكمية (بالوحدات/الحبات)</label>
                                    <input name="st" type="number" onFocus={e => e.target.select()} defaultValue={editingMed?.stock} required className="w-full bg-slate-50 p-5 rounded-3xl font-black text-lg outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black mr-2 text-blue-600 flex items-center gap-1">
                                        📦 سعة العبوة
                                        {editingMed && (editingMed.usageCount || 0) > 0 && <span className="text-[8px] text-rose-500">(مقفل - تمت مبيعات)</span>}
                                    </label>
                                    <input
                                        name="up"
                                        type="number"
                                        onFocus={e => e.target.select()}
                                        defaultValue={editingMed?.unitsPerPkg}
                                        disabled={editingMed && (editingMed.usageCount || 0) > 0}
                                        placeholder="لوحدات منفردة، اترك فارغاً"
                                        className={`w-full p-5 rounded-3xl font-black text-lg outline-none transition-all ${editingMed && (editingMed.usageCount || 0) > 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50' : 'bg-blue-50/20 focus:border-blue-400 border-2 border-transparent'}`}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2">التصنيف</label>
                                <input name="ct" list="cat-list-edit" defaultValue={editingMed?.category} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none" />
                                <datalist id="cat-list-edit">{categories.map(c => <option key={c} value={c} />)}</datalist>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2">المورد</label>
                                    <input name="sp" list="sup-list-edit" defaultValue={editingMed?.supplier} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none" />
                                    <datalist id="sup-list-edit">{suppliers.map(s => <option key={s} value={s}>{s}</option>)}</datalist>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2">هاتف المورد</label>
                                    <input name="spp" type="tel" defaultValue={editingMed?.supplierPhone} placeholder="09..." className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-rose-500 mr-2 flex items-center gap-1">⚠️ حد التنبيه</label>
                                    <input name="msa" type="number" defaultValue={editingMed?.minStockAlert || 5} className="w-full bg-rose-50/10 p-5 rounded-3xl font-black text-lg outline-none border-2 border-rose-50 focus:border-rose-400" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-emerald-500 mr-2 flex items-center gap-1"><Calendar size={12} /> تاريخ الإضافة</label>
                                    <input name="ad" type="date" defaultValue={editingMed?.addedDate || new Date().toISOString().split('T')[0]} required className="w-full bg-emerald-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-emerald-50 focus:border-emerald-400 transition-all appearance-none" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-rose-500 mr-2 flex items-center gap-1"><Calendar size={12} /> تاريخ الصلاحية</label>
                                <input name="ex" type="date" defaultValue={editingMed?.expiryDate || '2026-01-01'} required className="w-full bg-rose-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-rose-50 focus:border-rose-400 transition-all appearance-none text-rose-700" />
                            </div>

                            <input name="bc" type="text" placeholder="الباركود (إن وجد)" defaultValue={editingMed?.barcode} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" />

                            <div className="flex gap-3 pt-6">
                                <button type="submit" className="flex-grow bg-emerald-600 text-white py-6 rounded-[35px] font-black text-xl shadow-xl active:scale-95 transition-all">حفظ البيانات</button>
                                {editingMed?.id && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!isAdminUnlocked) { setIsUnlockSheetOpen(true); return; }
                                            if (confirm('حذف هذا الصنف نهائياً من راحة؟\n(هذا الإجراء سيؤثر على دقة التقارير السابقة)')) {
                                                await db.medicines.delete(editingMed.id!);
                                                setIsEditOpen(false);
                                                loadData();
                                                triggerNotif("تم حذف المنتج وتحديث المخزن", "warning");
                                            }
                                        }}
                                        className="bg-rose-50 text-rose-500 px-8 rounded-[35px] hover:bg-rose-100 transition-all shadow-sm flex items-center justify-center relative"
                                    >
                                        <Trash2 size={24} />
                                        {!isAdminUnlocked && <ShieldAlert size={10} className="absolute top-2 right-2 text-rose-400" />}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Wanted List Modals */}
            {isWantedOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[45px] shadow-2xl animate-in slide-in-from-bottom">
                        <div className="p-8 pb-4 flex justify-between items-center">
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><NotebookPen className="text-emerald-600" /> إضافة للنواقص</h2>
                            <button onClick={() => setIsWantedOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X /></button>
                        </div>
                        <form onSubmit={handleWantedAdd} className="p-8 pt-4 space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم الصنف</label>
                                <input type="text" required placeholder="مثلاً: بنادول إكسترا..." className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500 transition-all" value={wantedData.name} onChange={e => setWantedData({ ...wantedData, name: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">ملاحظات إضافية</label>
                                <input type="text" placeholder="مثلاً: بانتظار المورد أو الكمية..." className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500 transition-all" value={wantedData.note} onChange={e => setWantedData({ ...wantedData, note: e.target.value })} />
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-[30px] font-black text-lg shadow-xl active:scale-95 transition-all mt-4">حفظ في القائمة</button>
                        </form>
                    </div>
                </div>
            )}

            {isWantedListOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-[#F8FAFC] w-full max-w-xl rounded-t-[45px] sm:rounded-[50px] shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom">
                        <div className="p-10 pb-4 flex justify-between items-center bg-white rounded-t-[45px] sm:rounded-t-[50px] shadow-sm">
                            <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3"><ClipboardList className="text-emerald-600" /> قائمة النواقص</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsOrderAggregatorOpen(true)}
                                    className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[10px] flex items-center gap-2 hover:bg-emerald-600 hover:text-white transition-all"
                                >
                                    <Share2 size={14} /> تجميع الطلبية
                                </button>
                                <button onClick={() => setIsWantedListOpen(false)} className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all"><X /></button>
                            </div>
                        </div>
                        <div className="p-8 overflow-y-auto no-scrollbar space-y-6">
                            {/* Intelligent Suggestions Section */}
                            {inventoryAnalytics.suggestions.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 px-2">
                                        <Sparkles size={16} className="text-amber-500" />
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">مقترحات ذكية (أصناف مطلوبة نفدت)</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {inventoryAnalytics.suggestions.map((m: Medicine) => (
                                            <div key={`sug-${m.id}`} className="bg-amber-50/50 p-4 rounded-3xl border border-amber-100 flex justify-between items-center animate-in slide-in-from-right duration-500">
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{m.name}</div>
                                                    <div className="text-[9px] font-black text-amber-600 uppercase mt-0.5">مباع مؤخراً ونفد مخزونه</div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        await db.wantedItems.add({
                                                            id: crypto.randomUUID(),
                                                            itemName: m.name,
                                                            notes: "تمت إضافته تلقائياً (نفد من المخزن)",
                                                            requestCount: 1,
                                                            status: 'pending',
                                                            createdAt: Date.now()
                                                        });
                                                        triggerNotif(`تمت إضافة ${m.name} للنواقص`, "info");
                                                        loadData();
                                                    }}
                                                    className="p-2 bg-white text-amber-600 rounded-xl border border-amber-100 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                                                >
                                                    <Plus size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-2">
                                    <ListOrdered size={16} className="text-slate-400" />
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">طلبات مسجلة ({wantedItems.filter((i: WantedItem) => i.status === 'pending' || i.status === 'ordered').length})</h3>
                                </div>
                                {wantedItems.filter((i: WantedItem) => i.status === 'pending' || i.status === 'ordered').map((item: WantedItem) => (
                                    <div key={item.id} className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100 flex justify-between items-center group animate-in zoom-in-95">
                                        <div className="flex-grow">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xl font-bold text-slate-800">{item.itemName}</h3>
                                                <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded-full">طلب {item.requestCount} مرات</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                {item.notes && <span className="text-sm font-bold text-slate-400">{item.notes}</span>}
                                                <button
                                                    onClick={() => {
                                                        setSelectedWantedItem(item);
                                                        setIsReminderModalOpen(true);
                                                    }}
                                                    className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 transition-all active:scale-95 ${item.status === 'ordered' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}
                                                >
                                                    <Clock size={10} />
                                                    {item.reminderAt ? `تذكير: ${new Date(item.reminderAt).toLocaleDateString('ar-EG')}` : (item.status === 'ordered' ? 'بانتظار التوريد' : 'بالانتظار')}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    await db.wantedItems.update(item.id!, { status: 'received' });
                                                    triggerNotif(`تم استلام ${item.itemName} (يمكنك الآن إضافته للمخزن)`, 'info');
                                                    loadData();
                                                }}
                                                className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl font-black text-xs hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                                            >
                                                تم الاستلام
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!isAdminUnlocked) { setIsUnlockSheetOpen(true); return; }
                                                    if (confirm('حذف من القائمة؟')) {
                                                        await db.wantedItems.delete(item.id!);
                                                        loadData();
                                                    }
                                                }}
                                                className="p-3 text-rose-300 hover:text-rose-500 transition-all"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {wantedItems.filter((i: WantedItem) => i.status === 'received').length > 0 && (
                                    <div className="space-y-4 pt-8 border-t border-slate-100">
                                        <div className="flex items-center gap-2 px-2">
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                            <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest">تم استلامها (جاهزة للإضافة للمخزن)</h3>
                                        </div>
                                        {wantedItems.filter((i: WantedItem) => i.status === 'received').map((item: WantedItem) => (
                                            <div key={item.id} className="bg-emerald-50/20 p-6 rounded-[35px] border border-emerald-100 flex justify-between items-center animate-in fade-in">
                                                <div>
                                                    <h3 className="text-xl font-bold text-slate-800">{item.itemName}</h3>
                                                    <p className="text-[10px] font-black text-emerald-600 uppercase">التوريد مكتمل</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingMed({ name: item.itemName } as Medicine);
                                                            setIsEditOpen(true);
                                                            setIsWantedListOpen(false);
                                                        }}
                                                        className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                                                    >
                                                        إضافة للمخزن
                                                    </button>
                                                    <button onClick={async () => { if (confirm('حذف من القائمة؟')) { await db.wantedItems.delete(item.id!); loadData(); } }} className="p-3 text-rose-300 hover:text-rose-500 transition-all">
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {wantedItems.filter((i: WantedItem) => i.status !== 'received' && i.status !== 'completed').length === 0 && wantedItems.filter((i: WantedItem) => i.status === 'received').length === 0 && (
                                <div className="text-center py-20 opacity-20">
                                    <ClipboardList size={64} className="mx-auto mb-4" />
                                    <p className="font-black">لا توجد نواقص حالياً</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reset History Modal */}
            {showResetHistory && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-6">
                    <div className="bg-white rounded-[35px] max-w-2xl w-full p-8 shadow-2xl max-h-[80vh] overflow-y-auto animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                <RotateCcw className="text-emerald-600" size={24} />
                                سجل عمليات التصفير
                            </h2>
                            <button onClick={() => setShowResetHistory(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={24} /></button>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Mock reset history data */}
                            {[
                                { operation: 'تصفير المبيعات', description: 'تم تصفير جميع سجلات المبيعات', timestamp: Date.now() - 86400000, status: 'success' },
                                { operation: 'تصفير المصاريف', description: 'تم تصفير سجلات المصاريف', timestamp: Date.now() - 172800000, status: 'success' },
                                { operation: 'تصفير المخزون', description: 'فشل عملية تصفير المخزون', timestamp: Date.now() - 259200000, status: 'failed' },
                                { operation: 'تصفير العملاء', description: 'تم تصفير سجلات العملاء', timestamp: Date.now() - 345600000, status: 'success' },
                            ].map((reset, index) => (
                                <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-grow">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-slate-800">{reset.operation}</p>
                                                <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    reset.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                                }`}>
                                                    {reset.status === 'success' ? 'نجح' : 'فشل'}
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-600 mb-2">{reset.description}</p>
                                            <p className="text-xs text-slate-400 font-mono">
                                                {new Date(reset.timestamp).toLocaleString('ar-EG', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {reset.status === 'success' ? (
                                                <CheckCircle2 className="text-emerald-500" size={20} />
                                            ) : (
                                                <X className="text-rose-500" size={20} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex gap-3 mt-6">
                            <button 
                                onClick={() => setShowResetHistory(false)}
                                className="flex-1 bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 transition-all"
                            >
                                إغلاق
                            </button>
                            <button 
                                onClick={() => {
                                    if (confirm('هل أنت متأكد من تصدير سجل التصفير؟')) {
                                        triggerNotif('تم تصدير سجل التصفير بنجاح', 'success');
                                        setShowResetHistory(false);
                                    }
                                }}
                                className="flex-1 bg-emerald-600 text-white p-4 rounded-xl font-bold hover:bg-emerald-700 transition-all"
                            >
                                تصدير السجل
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes Modal */}
            {isNoteModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[45px] shadow-2xl animate-in slide-in-from-bottom">
                        <div className="p-8 pb-4 flex justify-between items-center">
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                <NotebookPen className="text-blue-600" /> {editingNote ? 'تعديل ملاحظة' : 'إضافة ملاحظة'}
                            </h2>
                            <button onClick={() => setIsNoteModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X /></button>
                        </div>
                        <form onSubmit={handleNoteSubmit} className="p-8 pt-4 space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">عنوان الملاحظة</label>
                                <input type="text" required placeholder="أدخل عنوان الملاحظة..." className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all" value={noteData.title} onChange={e => setNoteData({ ...noteData, title: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المحتوى</label>
                                <textarea required placeholder="أدخل محتوى الملاحظة..." rows={4} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all resize-none" value={noteData.content} onChange={e => setNoteData({ ...noteData, content: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">نوع الملاحظة</label>
                                <select value={noteData.type} onChange={e => setNoteData({ ...noteData, type: e.target.value as 'private' | 'public' })} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all">
                                    <option value="private">خاصة (محلية فقط)</option>
                                    <option value="public">عامة (في السحاب)</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-[30px] font-black text-lg shadow-xl active:scale-95 transition-all mt-4">
                                {editingNote ? 'تحديث الملاحظة' : 'حفظ الملاحظة'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Support Dialog */}
            {showSupportDialog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-6" onClick={() => setShowSupportDialog(false)}>
                    <div className="bg-white rounded-[35px] max-w-md w-full p-8 shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-slate-800">الدعم والتواصل</h2>
                            <button onClick={() => setShowSupportDialog(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={24} /></button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-emerald-50 p-6 rounded-3xl border-2 border-emerald-100">
                                <h3 className="font-black text-emerald-800 mb-2">رسائل الدعم الفني</h3>
                                <p className="text-sm text-emerald-700 leading-relaxed">نحن هنا لمساعدتك! تواصل معنا للحصول على الدعم الفني، الإبلاغ عن المشاكل، أو الحصول على آخر التحديثات.</p>
                            </div>

                            <a
                                href="https://wa.me/966116856217"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-4 bg-[#25D366] text-white p-5 rounded-3xl shadow-lg hover:shadow-xl transition-all active:scale-95"
                            >
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-bold opacity-80">تواصل عبر واتساب</div>
                                    <div className="text-lg font-black direction-ltr text-left">0116856217</div>
                                </div>
                            </a>

                            <a
                                href="tel:0116856217"
                                className="flex items-center gap-4 bg-slate-800 text-white p-5 rounded-3xl shadow-lg hover:shadow-xl transition-all active:scale-95"
                            >
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-bold opacity-80">اتصال هاتفي</div>
                                    <div className="text-lg font-black direction-ltr text-left">0116856217</div>
                                </div>
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Aggregator Modal */}
            {isOrderAggregatorOpen && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[50px] p-8 shadow-2xl space-y-6 animate-in zoom-in-95" dir="rtl">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800">تجميع الطلبية للمورد</h2>
                            <button onClick={() => setIsOrderAggregatorOpen(false)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><X size={24} /></button>
                        </div>

                        <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100">
                            <h3 className="text-[10px] font-black text-emerald-600 uppercase mb-2">الأصناف المختارة ({wantedItems.filter(i => i.status === 'pending').length})</h3>
                            <div className="max-h-32 overflow-y-auto no-scrollbar space-y-1">
                                {wantedItems.filter(i => i.status === 'pending').map((i, idx) => (
                                    <div key={i.id} className="text-xs font-bold text-slate-600 flex items-center gap-2">
                                        <div className="w-1 h-1 bg-emerald-400 rounded-full" />
                                        {i.itemName}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2">اسم المورد (اختياري)</label>
                                <input
                                    list="sup-list"
                                    placeholder="اختر أو ادخل اسم المورد..."
                                    className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-emerald-500"
                                    value={aggregatorSupplier.name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAggregatorSupplier({ ...aggregatorSupplier, name: e.target.value })}
                                />
                                <datalist id="sup-list">{suppliers.filter(s => s !== 'الكل').map(s => <option key={s} value={s} />)}</datalist>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2">رقم الواتساب</label>
                                <input
                                    type="tel"
                                    placeholder="مثال: 0966..."
                                    className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-emerald-500"
                                    value={aggregatorSupplier.phone}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAggregatorSupplier({ ...aggregatorSupplier, phone: e.target.value })}
                                />
                            </div>

                            <button
                                onClick={() => {
                                    const pending = wantedItems.filter((i: WantedItem) => i.status === 'pending');
                                    const text = `*طلب شراء من صيدلية راحة :*\n` +
                                        (aggregatorSupplier.name ? `*إلى المورد:* ${aggregatorSupplier.name}\n` : '') +
                                        `--------------------------\n` +
                                        pending.map((i: WantedItem, idx: number) => `${idx + 1}- ${i.itemName}${i.notes ? ` (${i.notes})` : ''}`).join('\n') +
                                        `\n\n_تم التصدير من تطبيق راحة برو_`;

                                    if (aggregatorSupplier.phone) {
                                        window.open(`https://wa.me/${aggregatorSupplier.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                                    } else {
                                        navigator.clipboard.writeText(text);
                                        triggerNotif("تم نسخ الطلبية (لم يتم العثور على رقم)", "info");
                                    }
                                    setIsOrderAggregatorOpen(false);
                                }}
                                className="w-full bg-slate-900 text-white py-5 rounded-[30px] font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <Share2 size={20} /> إرسال عبر واتساب
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reminder Picker Modal */}
            {isReminderModalOpen && selectedWantedItem && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[50px] p-8 shadow-2xl space-y-6 animate-in zoom-in-95" dir="rtl">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800">تجديد التنبيه</h2>
                            <button onClick={() => setIsReminderModalOpen(false)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><X size={24} /></button>
                        </div>

                        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 text-center">
                            <div className="w-12 h-12 bg-white text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm"><Clock size={24} /></div>
                            <div className="text-sm font-black text-blue-900">{selectedWantedItem.itemName}</div>
                            <div className="text-[10px] font-bold text-blue-400 mt-1">سيتم إشعارك بمجرد فتح التطبيق في التاريخ المحدد</div>
                        </div>

                        <div className="space-y-4">
                            <input
                                type="date"
                                className="w-full bg-slate-50 p-5 rounded-2xl font-black text-center outline-none border-2 border-transparent focus:border-blue-500"
                                onChange={async (e) => {
                                    const date = e.target.value;
                                    if (date) {
                                        await db.wantedItems.update(selectedWantedItem.id, { reminderAt: new Date(date).getTime() });
                                        triggerNotif(`تم ضبط تنبيه لـ ${selectedWantedItem.itemName}`, "info");
                                        setIsReminderModalOpen(false);
                                        loadData();
                                    }
                                }}
                            />
                            <button onClick={async () => {
                                await db.wantedItems.update(selectedWantedItem.id, { reminderAt: undefined });
                                triggerNotif("تم إلغاء التنبيه", "info");
                                setIsReminderModalOpen(false);
                                loadData();
                            }} className="w-full text-rose-500 font-extrabold text-[10px] uppercase py-2">إلغاء التنبيه الحالي</button>
                        </div>
                    </div>
                </div>
            )}

            <footer className="bg-white border-t border-slate-50 py-4 text-center shrink-0">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Property Rights Protected © 2026</p>
            </footer>

            {/* Bulk Action Bar (Floating) */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl text-white px-8 py-5 rounded-[40px] shadow-2xl z-[1000] flex items-center gap-8 animate-in slide-in-from-bottom duration-500 border border-white/10 select-none">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">تحكم جماعي</span>
                        </div>
                        <span className="text-lg font-black tabular-nums">{selectedIds.size} <span className="text-[10px] opacity-50">عنصر</span></span>
                    </div>
                    <div className="h-10 w-px bg-white/10" />
                    <div className="flex gap-4">
                        <button onClick={handleBulkDelete} className="bg-rose-500 hover:bg-rose-600 text-white p-4 rounded-3xl transition-all shadow-lg active:scale-95 group"><Trash2 size={24} className="group-hover:rotate-12 transition-transform" /></button>
                        <button onClick={() => setSelectedIds(new Set())} className="bg-white/10 hover:bg-white/20 text-white p-4 rounded-3xl transition-all active:scale-95"><X size={24} /></button>
                    </div>
                </div>
            )}

            {isUnlockSheetOpen && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[400] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[50px] p-10 shadow-2xl text-center space-y-8 animate-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[35px] flex items-center justify-center mx-auto shadow-inner">
                            <ShieldAlert size={48} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800">تأكيد الهوية الإدارية</h2>
                            <p className="text-slate-400 text-sm font-bold mt-2">يرجى إدخال رمز "الماستر كيد" للمتابعة</p>
                        </div>

                        <div className="space-y-4">
                            <input
                                type="password"
                                autoFocus
                                value={unlockCode}
                                onChange={(e) => setUnlockCode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdminUnlock(unlockCode)}
                                placeholder="••••••••"
                                className="w-full bg-slate-50 p-6 rounded-3xl text-center text-2xl font-black tracking-[1em] outline-none border-4 border-transparent focus:border-emerald-500 transition-all"
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setIsUnlockSheetOpen(false)} className="flex-1 bg-slate-100 text-slate-400 py-5 rounded-3xl font-black text-sm">إلغاء</button>
                                <button onClick={() => handleAdminUnlock(unlockCode)} className="flex-[2] bg-emerald-600 text-white py-5 rounded-3xl font-black text-sm shadow-xl shadow-emerald-100 active:scale-95 transition-all">فك القفل</button>
                            </div>
                        </div>

                        {unlockAttempts > 0 && (
                            <div className="text-rose-500 text-[10px] font-black animate-bounce">
                                تبقى لك {3 - unlockAttempts} محاولات قبل التنبيه الأمني
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
