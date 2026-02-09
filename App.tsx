import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Search, Plus, BarChart3, ShoppingCart, X, Trash2,
    CheckCircle2, TrendingUp, CreditCard, Wallet, UserMinus,
    ArrowRight, Minus, Edit3, Receipt, Calendar,
    RotateCcw, Download, Upload, Layers, Bell, Info, ArrowUpRight, Clock, ShieldAlert, Filter, User, CloudDownload,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import { db } from './db';
import { Medicine, ViewType, Sale, CartItem, Expense, Customer, AppNotification } from './types';

// Supabase Configuration has been moved to db.ts

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('raha_pro_activated') === 'true');
    const [loginCode, setLoginCode] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    const [view, setView] = useState<ViewType>('pos');
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [notifs, setNotifs] = useState<AppNotification[]>([]);
    const [activeNotif, setActiveNotif] = useState<AppNotification | null>(null);
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
    const [cart, setCart] = useState<Map<number, CartItem>>(new Map());
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingMed, setEditingMed] = useState<Medicine | null>(null);
    const [payData, setPayData] = useState({ discount: '', cash: '', bank: '', debt: '', trx: '', cust: '' });

    // Multi-Select & Advanced Debt
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [accSearchQuery, setAccSearchQuery] = useState('');
    const [debtorDetailName, setDebtorDetailName] = useState<string | null>(null);
    const [selectionTimer, setSelectionTimer] = useState<any>(null);

    // Raha Pro Optimization: Memoized trigger for dynamic notifications
    const triggerNotif = useCallback(async (message: string, type: 'warning' | 'error' | 'info' = 'info') => {
        const n: AppNotification = { message, type, timestamp: Date.now() };
        await db.notifications.add(n);
        setActiveNotif(n);
        setTimeout(() => setActiveNotif(null), 4000);
        // Refresh notifications list locally for immediate feedback
        const allN = await db.notifications.orderBy('timestamp').reverse().toArray();
        setNotifs(allN);
    }, []);



    const loadData = useCallback(async () => {
        const [m, s, e, c, n] = await Promise.all([
            db.medicines.toArray(),
            db.sales.orderBy('timestamp').reverse().toArray(),
            db.expenses.orderBy('timestamp').reverse().toArray(),
            db.customers.toArray(),
            db.notifications.orderBy('timestamp').reverse().toArray()
        ]);
        setMedicines(m);
        setSalesHistory(s);
        setExpenses(e);
        setCustomers(c);
        setNotifs(n);
    }, []);

    const toggleSelect = useCallback((id: number) => {
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

    const startSelect = useCallback((id: number) => {
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
        if (isAuthenticated) {
            const runInitialSync = async () => {
                if (navigator.onLine) {
                    setIsSyncing(true);
                    const res = await db.fullSyncFromCloud();
                    if (res.success) triggerNotif(`تم تحديث ${res.count} صنف من السحاب`, "info");
                    setIsSyncing(false);
                }
                loadData();
            };
            runInitialSync();
        }
    }, [isAuthenticated, loadData, triggerNotif]);

    // Smart Business Health Analyzer - نظام التنبيهات الذكي
    const analyzeBusinessHealth = useCallback(async () => {
        const alerts: AppNotification[] = [];
        const today = new Date().toISOString().split('T')[0];
        const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);

        // 1. فحص المخزون المنخفض والمنتهي
        medicines.forEach(med => {
            // تنبيه المخزون المنخفض
            if (med.stock > 0 && med.stock <= 5) {
                alerts.push({
                    message: `⚠️ مخزون منخفض: ${med.name} (${med.stock} فقط)`,
                    type: 'warning',
                    timestamp: Date.now()
                });
            }

            // تنبيه نفاد المخزون
            if (med.stock <= 0) {
                alerts.push({
                    message: `🚨 نفد المخزون: ${med.name}`,
                    type: 'error',
                    timestamp: Date.now()
                });
            }

            // تنبيه انتهاء الصلاحية
            if (med.expiryDate < today) {
                alerts.push({
                    message: `❌ منتهي الصلاحية: ${med.name} (${med.expiryDate})`,
                    type: 'error',
                    timestamp: Date.now()
                });
            }
        });

        // 2. فحص الأدوية الراكدة (لم تُبع منذ 60 يوم)
        const stagnantMeds = medicines.filter(med =>
            !med.lastSold || (typeof med.lastSold === 'number' && med.lastSold < sixtyDaysAgo)
        );

        if (stagnantMeds.length > 0) {
            alerts.push({
                message: `📦 ${stagnantMeds.length} منتج راكد (لم يُبع منذ 60+ يوم)`,
                type: 'warning',
                timestamp: Date.now()
            });
        }

        // 3. الفحص المالي - مقارنة المصروفات بالأرباح
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalProfit = salesHistory
            .filter(s => !s.isReturned)
            .reduce((sum, s) => sum + s.profit, 0);

        const netProfit = totalProfit - totalExpenses;

        if (netProfit < 0) {
            alerts.push({
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

    const categories = useMemo(() => ['الكل', ...Array.from(new Set(medicines.map(m => m.category))).filter(Boolean)], [medicines]);
    const suppliers = useMemo(() => ['الكل', ...Array.from(new Set(medicines.map(m => m.supplier))).filter(Boolean)], [medicines]);

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
            acc.cost += (m.costPrice || 0) * (m.stock || 0);
            return acc;
        }, { sell: 0, cost: 0 });
    }, [medicines]);

    const alerts = useMemo(() => {
        const low = medicines.filter(m => m.stock > 0 && m.stock <= 5).length;
        const out = medicines.filter(m => m.stock <= 0).length;
        return { total: low + out };
    }, [medicines]);

    const expenseTypes = useMemo(() => {
        const defaults = ['إيجار', 'كهرباء', 'مياه', 'رواتب', 'نثريات', 'صيانة'];
        const existing = Array.from(new Set(expenses.map(e => e.type)));
        return Array.from(new Set([...defaults, ...existing]));
    }, [expenses]);


    const filteredInventory = useMemo(() => {
        const now = Date.now();
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
            if (invStockFilter === 'low') matches = m.stock > 0 && m.stock <= 5;
            else if (invStockFilter === 'out') matches = m.stock <= 0;
            else if (invStockFilter === 'stagnant') matches = !m.lastSold || (now - (typeof m.lastSold === 'number' ? m.lastSold : 0) > 60 * 24 * 60 * 60 * 1000);
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

    const financeStats = useMemo(() => {
        let filtered = salesHistory.filter(s => new Date(s.timestamp).toISOString().split('T')[0] === accDateFilter);
        if (accPaymentFilter === 'cash') filtered = filtered.filter(s => s.cashAmount > 0);
        else if (accPaymentFilter === 'bank') filtered = filtered.filter(s => s.bankAmount > 0);
        else if (accPaymentFilter === 'debt') filtered = filtered.filter(s => s.debtAmount > 0);

        const totals = filtered.reduce((acc, s) => {
            if (!s.isReturned) {
                acc.sales += s.netAmount;
                acc.costs += s.totalCost;
                acc.profit += s.profit;
            }
            return acc;
        }, { sales: 0, costs: 0, profit: 0 });

        // Advanced Debt Ledger Logic
        const debtorsMap = new Map<string, { total: number, transactions: any[] }>();
        salesHistory.forEach(s => {
            if (!s.isReturned && s.debtAmount > 0 && s.customerName) {
                // Apply search filter for debtors
                if (accSearchQuery && !s.customerName.toLowerCase().includes(accSearchQuery.toLowerCase())) return;

                const current = debtorsMap.get(s.customerName) || { total: 0, transactions: [] };
                current.total += s.debtAmount;
                current.transactions.push({
                    id: s.id,
                    date: new Date(s.timestamp).toLocaleString('ar-EG'),
                    amount: s.debtAmount,
                    items: JSON.parse(s.itemsJson)
                });
                debtorsMap.set(s.customerName, current);
            }
        });

        return {
            ...totals,
            list: filtered,
            debtors: Array.from(debtorsMap.entries()).map(([name, data]) => ({ name, ...data }))
        };
    }, [salesHistory, accDateFilter, accPaymentFilter, accSearchQuery]);

    const expensesFinancials = useMemo(() => {
        const filteredExps = expenses.filter(e => {
            const d = new Date(e.timestamp).toISOString().split('T')[0];
            return d >= expStartDate && d <= expEndDate;
        });
        const filteredSales = salesHistory.filter(s => {
            const d = new Date(s.timestamp).toISOString().split('T')[0];
            return d >= expStartDate && d <= expEndDate && !s.isReturned;
        });
        const totalExp = filteredExps.reduce((sum, e) => sum + e.amount, 0);
        const totalCost = filteredSales.reduce((sum, s) => sum + s.totalCost, 0);
        const salesProfit = filteredSales.reduce((sum, s) => sum + s.profit, 0);
        const netProfit = salesProfit - totalExp;
        return { list: filteredExps, totalExp, totalCost, salesProfit, netProfit };
    }, [expenses, salesHistory, expStartDate, expEndDate]);

    const inlineUpdate = useCallback(async (id: number, field: string, value: any) => {
        const val = (field === 'price' || field === 'costPrice' || field === 'stock') ? parseFloat(value) : value;
        await db.medicines.update(id, { [field]: val });
        loadData();
    }, [loadData]);


    const handleReturn = useCallback(async (sale: Sale) => {
        if (!confirm('هل أنت متأكد من إرجاع هذه العملية؟ سيتم استعادة المخزون.')) return;
        try {
            await db.transaction('rw', [db.medicines, db.sales], async () => {
                const items = JSON.parse(sale.itemsJson) as CartItem[];
                for (const item of items) {
                    const med = await db.medicines.get(item.medicine.id!);
                    if (med) {
                        await db.medicines.update(item.medicine.id!, {
                            stock: med.stock + item.quantity
                        });
                    }
                }
                await db.sales.update(sale.id!, { isReturned: true });
            });
            triggerNotif("تم إرجاع العملية بنجاح", "info");
            loadData();
        } catch (err) {
            triggerNotif("خطأ في إرجاع العملية", "error");
        }
    }, [loadData, triggerNotif]);

    const backupData = useCallback(async () => {
        const [medicines, sales, expenses, customers, notifications] = await Promise.all([
            db.medicines.toArray(),
            db.sales.toArray(),
            db.expenses.toArray(),
            db.customers.toArray(),
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
                if (!confirm('سيتم استبدال قاعدة البيانات الحالية بالكامل بالنسخة الاحتياطية. هل أنت متأكد؟')) return;
                await db.transaction('rw', [db.medicines, db.sales, db.expenses, db.customers, db.notifications], async () => {
                    await Promise.all([
                        db.medicines.clear(),
                        db.sales.clear(),
                        db.expenses.clear(),
                        db.customers.clear(),
                        db.notifications.clear()
                    ]);
                    await Promise.all([
                        db.medicines.bulkAdd(data.medicines || []),
                        db.sales.bulkAdd(data.sales || data.salesHistory || []),
                        db.expenses.bulkAdd(data.expenses || []),
                        db.customers.bulkAdd(data.customers || []),
                        db.notifications.bulkAdd(data.notifications || [])
                    ]);
                });

                // Sync with Cloud (Mirror Restore)
                triggerNotif("جاري مزامنة النسخة مع السحاب...", "info");
                await db.clearCloudData();
                await db.fullUploadToCloud();

                alert('تمت استعادة البيانات بنجاح! سيتم إعادة تشغيل التطبيق الآن.');
                window.location.reload();
            } catch (err) { triggerNotif("خطأ في قراءة ملف النسخة الاحتياطية", "error"); }
        };
        reader.readAsText(file);
    }, [triggerNotif]);

    const resetApp = useCallback(async () => {
        const totalSales = salesHistory.reduce((a: number, b) => a + (b.isReturned ? 0 : b.netAmount), 0);
        // تم تحديث الرسالة لتوضح أن التصفير للمنصرفات فقط
        const summary = `تقرير التصفير:\nإجمالي المبيعات: ${totalSales.toFixed(2)}\nإجمالي الأصناف: ${medicines.length}`;
        if (confirm(`${summary}\n\nهل أنت متأكد من تصفير التطبيق؟\n(سيتم حذف: المبيعات، التقارير، المنصرفات، الإشعارات)\n(لن يتم حذف: المخزون/الأصناف)`)) {
            // @ts-ignore
            await db.transaction('rw', [db.sales, db.expenses, db.notifications], async () => {
                // تصفير شامل ما عدا المخزون
                await Promise.all([
                    db.sales.clear(),
                    db.expenses.clear(),
                    db.notifications.clear()
                ]);
            });
            // تصفير السحاب أيضاً
            await db.clearCloudData();
            triggerNotif("تم تصفير التطبيق بنجاح (المبيعات والتقارير حذفت، المخزون باقٍ)", "info");
            loadData();
        }
    }, [salesHistory, medicines.length, loadData, triggerNotif]);


    const addToCart = useCallback((m: Medicine) => {
        if (m.stock <= 0) { triggerNotif(`نفد مخزون ${m.name}`, "error"); return; }
        const newCart = new Map(cart);
        const item = newCart.get(m.id!) || { medicine: m, quantity: 0 };
        if (item.quantity < m.stock) {
            newCart.set(m.id!, { ...item, quantity: item.quantity + 1 });
            setCart(newCart);
        } else { triggerNotif("لا توجد كمية كافية", "warning"); }
    }, [cart, triggerNotif, setCart]);

    const removeFromCart = useCallback((id: number) => {
        const newCart = new Map(cart);
        const item = newCart.get(id);
        if (!item) return;
        if (item.quantity > 1) newCart.set(id, { ...item, quantity: item.quantity - 1 });
        else newCart.delete(id);
        setCart(newCart);
    }, [cart, setCart]);

    const handleSale = useCallback(async () => {
        const itemsArray = Array.from(cart.values());
        const cartTotalValue = itemsArray.reduce((s: number, i) => s + (i.medicine.price * i.quantity), 0);
        const netValue = cartTotalValue - (parseFloat(payData.discount) || 0);
        const paidValue = (parseFloat(payData.cash) || 0) + (parseFloat(payData.bank) || 0) + (parseFloat(payData.debt) || 0);
        const totalCostValue = itemsArray.reduce((s: number, i) => s + (i.medicine.costPrice * i.quantity), 0);


        if (Math.abs(paidValue - netValue) > 0.1) {
            triggerNotif("توزيع المبالغ غير صحيح", "error");
            return;
        }

        try {
            // @ts-ignore
            await db.transaction('rw', [db.medicines, db.sales, db.customers], async () => {
                for (const item of itemsArray) {
                    await db.medicines.update(item.medicine.id!, {
                        stock: item.medicine.stock - item.quantity,
                        usageCount: (item.medicine.usageCount || 0) + item.quantity,
                        lastSold: Date.now()
                    });
                }
                if (payData.cust) {
                    const existing = await db.customers.where('name').equals(payData.cust).first();
                    if (!existing) await db.customers.add({ name: payData.cust });
                }
                await db.sales.add({
                    totalAmount: cartTotalValue,
                    discount: parseFloat(payData.discount) || 0,
                    netAmount: netValue,
                    cashAmount: parseFloat(payData.cash) || 0,
                    bankAmount: parseFloat(payData.bank) || 0,
                    debtAmount: parseFloat(payData.debt) || 0,
                    bankTrxId: payData.trx,
                    customerName: payData.cust,
                    totalCost: totalCostValue,
                    profit: netValue - totalCostValue as number,
                    timestamp: Date.now(),
                    itemsJson: JSON.stringify(itemsArray)
                });
            });
        } catch (error) {
            console.error('Sale Execution Error:', error);
            triggerNotif("خطأ في تنفيذ العملية", "error");
        }

        setCart(new Map());
        setIsCheckoutOpen(false);
        setPayData({ discount: '', cash: '', bank: '', debt: '', trx: '', cust: '' });
        triggerNotif("تمت عملية البيع بنجاح", "info");
        loadData();
    }, [cart, payData, loadData, triggerNotif]);

    const handleLogin = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const code = loginCode.trim().toLowerCase();
        if (['0909', 'opininit', 'raha'].includes(code)) {
            localStorage.setItem('raha_pro_activated', 'true');
            setIsAuthenticated(true);
            setLoginCode('');
            triggerNotif("تم التفعيل بنجاح", "info");
        } else {
            triggerNotif("رمز التفعيل غير صحيح", "error");
            setLoginCode('');
        }
    }, [loginCode, triggerNotif]);

    if (!isAuthenticated) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-[9999] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 to-slate-900"></div>
                <div className="bg-white p-12 rounded-[50px] shadow-2xl max-w-md w-full mx-4 relative z-10 animate-in zoom-in-95">
                    <div className="text-center mb-10">
                        <div className="w-24 h-24 bg-emerald-600 rounded-[35px] flex items-center justify-center text-white shadow-2xl mx-auto mb-6 rotate-3">
                            <Layers size={48} />
                        </div>
                        <h1 className="text-4xl font-black text-slate-800 mb-2">راحة <span className="text-emerald-600 font-black">PRO</span></h1>
                        <p className="text-sm font-bold text-slate-400">نظام إدارة الصيدليات الذكي - تفعيل النسخة</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="relative">
                            <input
                                type="password"
                                placeholder="أدخل رمز التفعيل..."
                                className="w-full bg-slate-50 p-6 rounded-[30px] font-black text-2xl text-center outline-none border-4 border-transparent focus:border-emerald-500/30 focus:bg-white transition-all tracking-[0.5em]"
                                value={loginCode}
                                onChange={e => setLoginCode(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-slate-900 text-white py-6 rounded-[30px] font-black text-xl shadow-2xl hover:bg-emerald-600 transition-all active:scale-95"
                        >
                            دخول النظام
                        </button>
                    </form>
                    <div className="mt-12 text-center">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Property Rights Protected © 2026</p>
                        <p className="text-[8px] font-bold text-slate-200 mt-1">Raha Optimization Engine v4.0</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-medium">
            {activeNotif && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-xs animate-in slide-in-from-top-full duration-300">
                    <div className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-3 ${activeNotif.type === 'error' ? 'bg-rose-600 text-white' : activeNotif.type === 'warning' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}>
                        <ShieldAlert size={20} />
                        <span className="text-xs font-black">{activeNotif.message}</span>
                    </div>
                </div>
            )}
            <header className="bg-white px-6 pt-10 pb-4 shadow-sm z-30 border-b border-slate-100 shrink-0">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Layers size={20} /></div>
                        <h1 className="text-xl font-black text-slate-800">راحة <span className="text-emerald-600">PRO</span></h1>
                    </div>
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
                                    const res = await db.fullSyncFromCloud();

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
                    {['pos', 'inventory', 'accounting', 'expenses'].map((v) => (
                        <button key={v} onClick={() => setView(v as ViewType)} className={`px-6 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${view === v ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>
                            {v === 'pos' ? 'البيع' : v === 'inventory' ? 'المخزن' : v === 'accounting' ? 'التقارير' : 'المنصرفات'}
                        </button>
                    ))}
                </div>
            </header>
            <main className="flex-grow overflow-y-auto p-4 pb-48 no-scrollbar">
                {view === 'pos' && (
                    <div className="animate-in fade-in duration-300">
                        <div className="relative mb-4">
                            <input type="text" placeholder="بحث سريع باسم المنتج أو الباركود..." className="w-full bg-white rounded-3xl py-4 pr-12 pl-4 text-lg font-bold shadow-sm border-2 border-transparent focus:border-emerald-500 outline-none transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
                            {categories.map(c => (
                                <button key={c} onClick={() => setActiveCategory(c)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all ${activeCategory === c ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-400 shadow-sm'}`}>{c}</button>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {posItems.map(m => (
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
                                            <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => removeFromCart(m.id!)} className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><Minus size={14} /></button>
                                                <span className="text-sm font-black text-slate-700">{cart.get(m.id!)?.quantity}</span>
                                                <button onClick={() => addToCart(m)} className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><Plus size={14} /></button>
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
                        <div className="relative mb-2">
                            <input type="text" placeholder="بحث في المخزن باسم الصنف أو الباركود..." className="w-full bg-white rounded-3xl py-4 pr-12 pl-4 text-lg font-bold shadow-sm border-2 border-transparent focus:border-emerald-500 outline-none transition-all" value={invSearchQuery} onChange={e => setInvSearchQuery(e.target.value)} />
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-emerald-600 p-6 rounded-[35px] text-white shadow-xl shadow-emerald-100">
                                <div className="text-[9px] font-black opacity-70 uppercase mb-1">قيمة المخزون (بيع)</div>
                                <div className="text-2xl font-black tabular-nums">{inventoryValue.sell.toLocaleString()}</div>
                            </div>
                            <div className="bg-slate-800 p-6 rounded-[35px] text-white shadow-xl">
                                <div className="text-[9px] font-black opacity-70 uppercase mb-1">رأس المال (تكلفة)</div>
                                <div className="text-2xl font-black tabular-nums">{inventoryValue.cost.toLocaleString()}</div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-[35px] shadow-sm border border-slate-100 space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <select className="bg-slate-50 p-3 rounded-2xl text-[10px] font-black border-none outline-none" value={invStockFilter} onChange={e => setInvStockFilter(e.target.value as any)}>
                                    <option value="all">كل المخزون</option>
                                    <option value="low">النواقص (5 فأقل)</option>
                                    <option value="out">نفد المخزون</option>
                                    <option value="stagnant">منتجات راكدة</option>
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
                                                            <div className="text-slate-800 text-sm font-black">{m.name}</div>
                                                            <div className="text-[9px] text-slate-300">{m.supplier || 'بدون مورد'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-lg ${m.stock <= 5 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>{m.stock}</span>
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
                                        <h2 className="text-4xl font-black tabular-nums mt-1">{(financeStats.profit || 0).toFixed(2)} <span className="text-xs font-normal opacity-50">ج.م</span></h2>
                                    </div>
                                    <div className="p-3 bg-white/10 rounded-2xl text-emerald-400"><TrendingUp size={28} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-6">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">البيع الكلي</span>
                                        <div className="text-xl font-black">{(financeStats.sales || 0).toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">التكلفة</span>
                                        <div className="text-xl font-black text-slate-500">{(financeStats.costs || 0).toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 bg-white p-4 rounded-3xl shadow-sm border border-slate-50">
                                <Calendar className="text-emerald-600" size={20} />
                                <input type="date" className="flex-grow bg-transparent font-black outline-none" value={accDateFilter} onChange={e => setAccDateFilter(e.target.value)} />
                                <div className="w-px h-8 bg-slate-100 mx-2"></div>
                                <select className="bg-transparent font-black outline-none text-xs" value={accPaymentFilter} onChange={e => { setAccPaymentFilter(e.target.value as any); setDebtorDetailName(null); }}>
                                    <option value="all">كل العمليات</option>
                                    <option value="cash">كاش</option>
                                    <option value="bank">بنكك</option>
                                    <option value="debt">مديونيات</option>
                                </select>
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
                                financeStats.debtors.map(d => (
                                    <div key={d.name} onClick={() => setDebtorDetailName(d.name)} className="p-6 rounded-[35px] bg-white border-2 border-amber-50 shadow-sm flex justify-between items-center cursor-pointer hover:border-amber-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 font-black">{d.name[0]}</div>
                                            <div>
                                                <div className="font-black text-slate-800">{d.name}</div>
                                                <div className="text-[10px] font-bold text-slate-400">{d.transactions.length} مديونية مسجلة</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-amber-700">{(d.total || 0).toFixed(2)} <span className="text-[8px]">ج.م</span></div>
                                            <div className="text-[9px] font-bold text-slate-300 flex items-center gap-1">التفاصيل <ChevronLeft size={10} /></div>
                                        </div>
                                    </div>
                                ))
                            ) : accPaymentFilter === 'debt' && debtorDetailName ? (
                                <div className="space-y-4">
                                    <button onClick={() => setDebtorDetailName(null)} className="flex items-center gap-2 text-slate-400 font-black text-xs hover:text-slate-600"><ChevronRight size={16} /> العودة لقائمة المديونيات</button>
                                    <div className="bg-amber-600 p-6 rounded-[35px] text-white shadow-xl mb-4">
                                        <div className="text-[9px] font-black opacity-70">إجمالي دين {debtorDetailName}</div>
                                        <div className="text-3xl font-black">{(financeStats.debtors.find(d => d.name === debtorDetailName)?.total || 0).toFixed(2)} ج.م</div>
                                    </div>
                                    {financeStats.debtors.find(d => d.name === debtorDetailName)?.transactions.map((t: any) => (
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
                                financeStats.list.map(s => (
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
                                                {s.cashAmount > 0 && <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Wallet size={16} /></div>}
                                                {s.bankAmount > 0 && <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><CreditCard size={16} /></div>}
                                                {s.debtAmount > 0 && <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><UserMinus size={16} /></div>}
                                            </div>
                                        </div>
                                        {!s.isReturned && (
                                            <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                                                <span className="text-[10px] font-bold text-slate-400">{s.customerName || 'زبون عام'}</span>
                                                <button onClick={(e) => { e.stopPropagation(); handleReturn(s); }} className="text-rose-500 font-black text-[10px] px-4 py-2 hover:bg-rose-50 rounded-xl transition-all">إرجاع</button>
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
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">إضافة منصرف</h2>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const f = e.target as any;
                                await db.expenses.add({
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

                        <div className="bg-rose-600 p-8 rounded-[40px] text-white shadow-xl">
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
                <button onClick={() => setView('pos')} className={`flex flex-col items-center gap-1 transition-all ${view === 'pos' ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}>
                    <ShoppingCart size={24} strokeWidth={view === 'pos' ? 3 : 2} /> <span className="text-[10px] font-black uppercase">البيع</span>
                </button>
                <div className="relative -top-6">
                    <button
                        onClick={() => { setEditingMed(null); setIsEditOpen(true); }}
                        className="w-14 h-14 bg-emerald-600 rounded-[20px] shadow-2xl shadow-emerald-200 flex items-center justify-center text-white active:scale-95 transition-all rotate-45 group hover:rotate-[135deg]"
                    >
                        <Plus size={32} className="-rotate-45" />
                    </button>
                </div>
                <button onClick={() => setView('accounting')} className={`flex flex-col items-center gap-1 transition-all ${view === 'accounting' ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}>
                    <BarChart3 size={24} strokeWidth={view === 'accounting' ? 3 : 2} /> <span className="text-[10px] font-black uppercase">التقارير</span>
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
                                name: f.nm.value, barcode: f.bc.value, price: parseFloat(f.pr.value) || 0,
                                costPrice: parseFloat(f.cp.value) || 0, stock: parseInt(f.st.value) || 0,
                                category: f.ct.value, expiryDate: f.ex.value, supplier: f.sp.value,
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
                                    <label className="text-[10px] font-black text-slate-400 mr-2">الكمية المتوفرة</label>
                                    <input name="st" type="number" onFocus={e => e.target.select()} defaultValue={editingMed?.stock} required className="w-full bg-slate-50 p-5 rounded-3xl font-black text-lg outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2">التصنيف</label>
                                    <input name="ct" list="cat-list-edit" defaultValue={editingMed?.category} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none" />
                                    <datalist id="cat-list-edit">{categories.map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2">المورد</label>
                                    <input name="sp" list="sup-list-edit" defaultValue={editingMed?.supplier} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none" />
                                    <datalist id="sup-list-edit">{suppliers.map(s => <option key={s} value={s}>{s}</option>)}</datalist>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-emerald-500 mr-2 flex items-center gap-1"><Calendar size={12} /> تاريخ الإضافة (الشراء)</label>
                                    <input name="ad" type="date" defaultValue={editingMed?.addedDate || new Date().toISOString().split('T')[0]} required className="w-full bg-emerald-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-emerald-50 focus:border-emerald-400 transition-all appearance-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-rose-500 mr-2 flex items-center gap-1"><Calendar size={12} /> تاريخ الصلاحية</label>
                                    <input name="ex" type="date" defaultValue={editingMed?.expiryDate || '2026-01-01'} required className="w-full bg-rose-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-rose-50 focus:border-rose-400 transition-all appearance-none text-rose-700" />
                                </div>
                            </div>

                            <input name="bc" type="text" placeholder="الباركود (إن وجد)" defaultValue={editingMed?.barcode} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" />

                            <div className="flex gap-3 pt-6">
                                <button type="submit" className="flex-grow bg-emerald-600 text-white py-6 rounded-[35px] font-black text-xl shadow-xl active:scale-95 transition-all">حفظ البيانات</button>
                                {editingMed?.id && (
                                    <button type="button" onClick={async () => { if (confirm('حذف هذا الصنف نهائياً من راحة؟')) { await db.medicines.delete(editingMed.id!); setIsEditOpen(false); loadData(); triggerNotif("تم حذف المنتج", "warning"); } }} className="bg-rose-50 text-rose-500 px-8 rounded-[35px] hover:bg-rose-100 transition-all shadow-sm"><Trash2 size={24} /></button>
                                )}
                            </div>
                        </form>
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
        </div>
    );
};

export default App;
