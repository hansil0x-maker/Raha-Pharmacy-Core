import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Search, Plus, BarChart3, ShoppingCart, X, Trash2,
    CheckCircle2, TrendingUp, CreditCard, Wallet, UserMinus,
    ArrowRight, Minus, Edit3, Receipt, Calendar,
    RotateCcw, Download, Upload, Layers, Bell, Info, ArrowUpRight, Clock, ShieldAlert, Filter, User
} from 'lucide-react';
import { db } from './db';
import { Medicine, ViewType, Sale, CartItem, Expense, Customer, AppNotification } from './types';
import { createClient } from '@supabase/supabase-js';

// Supabase Configuration - قناة الاتصال مع سيرفر ألمانيا
const SUPABASE_URL = 'https://cihficjizojbtnshwtfl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9Nmdm3LJUHK1fBF0ihj38g_ophBRHyD';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const App: React.FC = () => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [setupCode, setSetupCode] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('raha_initialized');
        if (saved === 'true') {
            setIsInitialized(true);
        }
    }, []);

    // قوة الغاشمة لتجاوز الكاش والخدمات القديمة
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations()
                .then(registrations => {
                    for (let registration of registrations) { registration.unregister(); }
                })
                .catch(() => { /* Ignore invalid state errors */ });
        }
    }, []);

    // Flexible Code Check (Auto-submit when correct)
    useEffect(() => {
        const code = setupCode.trim().toLowerCase();
        if (code.includes('rahaopin') || code === 'raha') {
            try {
                localStorage.setItem('raha_initialized', 'true');
                setIsInitialized(true);
            } catch (e) {
                setIsInitialized(true);
            }
        }
    }, [setupCode]);

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



    const loadData = useCallback(async () => {
        // Cloud Sync Engine - جلب البيانات من السحاب أولاً
        try {
            const { data: cloudMedicines, error: medError } = await supabase
                .from('inventory')
                .select('*');

            const { data: cloudSales, error: salesError } = await supabase
                .from('sales')
                .select('*');

            // إذا نجح الاتصال والبيانات ليست فارغة، نستخدم البيانات السحابية
            if (!medError && cloudMedicines && cloudMedicines.length > 0) {
                // تحويل بيانات السحاب إلى التنسيق المحلي
                const syncedMedicines: Medicine[] = (cloudMedicines as any[]).map(item => ({
                    id: item.id,
                    name: item.name || '',
                    barcode: item.barcode || '',
                    price: item.price || 0,
                    costPrice: item.cost_price || 0,
                    stock: item.stock || 0,
                    category: item.category || '',
                    expiryDate: item.expiry_date || '2026-01-01',
                    supplier: item.supplier || '',
                    addedDate: item.added_date || new Date().toISOString().split('T')[0],
                    usageCount: item.usage_count || 0
                }));

                // تحديث قاعدة البيانات المحلية
                await db.medicines.clear();
                await db.medicines.bulkAdd(syncedMedicines);
                console.log('✅ تم مزامنة المخزون من السحاب');
            }

            if (!salesError && cloudSales && cloudSales.length > 0) {
                // تحويل بيانات المبيعات
                const syncedSales: Sale[] = (cloudSales as any[]).map(item => ({
                    id: item.id,
                    totalAmount: item.total_amount || 0,
                    discount: item.discount || 0,
                    netAmount: item.net_amount || 0,
                    cashAmount: item.cash_amount || 0,
                    bankAmount: item.bank_amount || 0,
                    debtAmount: item.debt_amount || 0,
                    bankTrxId: item.bank_trx_id || '',
                    customerName: item.customer_name || '',
                    totalCost: item.total_cost || 0,
                    profit: item.profit || 0,
                    timestamp: new Date(item.timestamp).getTime(),
                    itemsJson: item.items_json || '[]',
                    isReturned: item.is_returned || false
                }));

                await db.sales.clear();
                await db.sales.bulkAdd(syncedSales);
                console.log('✅ تم مزامنة المبيعات من السحاب');
            }
        } catch (syncError) {
            // في حالة الفشل، نستمر في استخدام البيانات المحلية
            console.log('⚠️ فشل الاتصال بالسحاب - استخدام البيانات المحلية:', syncError);
        }

        // جلب البيانات المحلية (بعد المزامنة أو في حالة الفشل)
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

    const triggerNotif = useCallback(async (message: string, type: 'warning' | 'error' | 'info' = 'info') => {
        const n: AppNotification = { message, type, timestamp: Date.now() };
        await db.notifications.add(n);
        setActiveNotif(n);
        setTimeout(() => setActiveNotif(null), 4000);
        const allN = await db.notifications.orderBy('timestamp').reverse().toArray();
        setNotifs(allN);
    }, []);

    useEffect(() => {
        loadData().catch((err: any) => {
            console.error("Critical Load Error:", err);
            triggerNotif("فشل تحميل البيانات. تأكد من اتصالك أو المتصفح.", "error");
        });
    }, [loadData, triggerNotif]);

    // Smart Business Health Analyzer - نظام التنبيهات الذكي
    const analyzeBusinessHealth = useCallback(async () => {
        const alerts: AppNotification[] = [];
        const today = new Date().toISOString().split('T')[0];
        const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);

        // 1. فحص المخزون المنخفض والمنتهي
        medicines.forEach((med: Medicine) => {
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
        const stagnantMeds = medicines.filter((med: Medicine) =>
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
        const totalExpenses = expenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
        const totalProfit = salesHistory
            .filter((s: Sale) => !s.isReturned)
            .reduce((sum: number, s: Sale) => sum + s.profit, 0);

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



    const categories = useMemo(() => ['الكل', ...Array.from(new Set(medicines.map((m: Medicine) => m.category))).filter(Boolean)], [medicines]);
    const suppliers = useMemo(() => ['الكل', ...Array.from(new Set(medicines.map((m: Medicine) => m.supplier))).filter(Boolean)], [medicines]);

    const posItems = useMemo(() => {
        return medicines.filter((m: Medicine) => {
            const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || (m.barcode && m.barcode.includes(searchQuery));
            const matchesCat = activeCategory === 'الكل' || m.category === activeCategory;
            return matchesSearch && matchesCat;
        });
    }, [medicines, searchQuery, activeCategory]);

    const inventoryValue = useMemo(() => {
        return medicines.reduce((acc: { sell: number, cost: number }, m: Medicine) => {
            acc.sell += (m.price || 0) * (m.stock || 0);
            acc.cost += (m.costPrice || 0) * (m.stock || 0);
            return acc;
        }, { sell: 0, cost: 0 });
    }, [medicines]);

    const alerts = useMemo(() => {
        const low = medicines.filter((m: Medicine) => m.stock > 0 && m.stock <= 5).length;
        const out = medicines.filter((m: Medicine) => m.stock <= 0).length;
        return { total: low + out };
    }, [medicines]);

    const expenseTypes = useMemo(() => {
        const defaults = ['إيجار', 'كهرباء', 'مياه', 'رواتب', 'نثريات', 'صيانة'];
        const existing = Array.from(new Set(expenses.map((e: Expense) => e.type)));
        return Array.from(new Set([...defaults, ...existing]));
    }, [expenses]);

    const filteredInventory = useMemo(() => {
        const now = Date.now();
        const today = new Date().toISOString().split('T')[0];
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
        const nearDate = threeMonthsLater.toISOString().split('T')[0];
        return medicines.filter((m: Medicine) => {
            let matches = true;
            if (matches && invSearchQuery) {
                matches = m.name.toLowerCase().includes(invSearchQuery.toLowerCase()) ||
                    (m.barcode && m.barcode.includes(invSearchQuery));
            }
            if (invStockFilter === 'low') matches = m.stock > 0 && m.stock <= 5;
            else if (invStockFilter === 'out') matches = m.stock <= 0;
            else if (invStockFilter === 'stagnant') matches = !m.lastSold || (now - (typeof m.lastSold === 'number' ? m.lastSold : 0) > 60 * 24 * 60 * 60 * 1000);
            if (matches && invDateFilter) matches = m.addedDate === invDateFilter;
            if (matches && activeCategory !== 'الكل') matches = m.category === activeCategory;
            if (matches && invSupplierFilter !== 'الكل') matches = m.supplier === invSupplierFilter;
            if (matches) {
                if (invExpiryFilter === 'expired') matches = m.expiryDate < today;
                else if (invExpiryFilter === 'near') matches = m.expiryDate >= today && m.expiryDate <= nearDate;
            }
            return matches;
        });
    }, [medicines, invStockFilter, invDateFilter, activeCategory, invSupplierFilter, invExpiryFilter, invSearchQuery]);

    const financeStats = useMemo(() => {
        let filtered = salesHistory.filter((s: Sale) => new Date(s.timestamp).toISOString().split('T')[0] === accDateFilter);
        if (accPaymentFilter === 'cash') filtered = filtered.filter((s: Sale) => s.cashAmount > 0);
        else if (accPaymentFilter === 'bank') filtered = filtered.filter((s: Sale) => s.bankAmount > 0);
        else if (accPaymentFilter === 'debt') filtered = filtered.filter((s: Sale) => s.debtAmount > 0);
        const totals = filtered.reduce((acc: { sales: number, costs: number, profit: number }, s: Sale) => {
            if (!s.isReturned) {
                acc.sales += s.netAmount;
                acc.costs += s.totalCost;
                acc.profit += s.profit;
            }
            return acc;
        }, { sales: 0, costs: 0, profit: 0 });
        const debtors = new Map<string, number>();
        if (accPaymentFilter === 'debt') {
            salesHistory.forEach((s: Sale) => {
                if (!s.isReturned && s.debtAmount > 0 && s.customerName) {
                    const current = debtors.get(s.customerName) || 0;
                    debtors.set(s.customerName, current + s.debtAmount);
                }
            });
        }
        return { ...totals, list: filtered, debtors: Array.from(debtors.entries()) };
    }, [salesHistory, accDateFilter, accPaymentFilter]);

    const expensesFinancials = useMemo(() => {
        const filteredExps = expenses.filter((e: Expense) => {
            const d = new Date(e.timestamp).toISOString().split('T')[0];
            return d >= expStartDate && d <= expEndDate;
        });
        const filteredSales = salesHistory.filter((s: Sale) => {
            const d = new Date(s.timestamp).toISOString().split('T')[0];
            return d >= expStartDate && d <= expEndDate && !s.isReturned;
        });
        const totalExp = filteredExps.reduce((sum: number, e: Expense) => sum + e.amount, 0);
        const totalCost = filteredSales.reduce((sum: number, s: Sale) => sum + s.totalCost, 0);
        const salesProfit = filteredSales.reduce((sum: number, s: Sale) => sum + s.profit, 0);
        const netProfit = salesProfit - totalExp;
        return { list: filteredExps, totalExp, totalCost, salesProfit, netProfit };
    }, [expenses, salesHistory, expStartDate, expEndDate]);

    const inlineUpdate = useCallback(async (id: number, field: keyof Medicine, value: string | number) => {
        const val = (field === 'price' || field === 'costPrice' || field === 'stock') ? parseFloat(value as string) : value;
        await db.medicines.update(id, { [field]: val });
        loadData();
    }, [loadData]);

    const handleReturn = useCallback(async (sale: Sale) => {
        if (!confirm('هل أنت متأكد من إرجاع هذه العملية؟ سيتم استعادة المخزون.')) return;
        try {
            await db.transaction('rw', [db.medicines, db.sales], async () => {
                const items = JSON.parse(sale.itemsJson) as CartItem[];
                for (const item of items) {
                    if (!item.medicine.id) continue;
                    const med = await db.medicines.get(item.medicine.id);
                    if (med) {
                        await db.medicines.update(item.medicine.id, {
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
        const [medicinesData, salesData, expensesData, customersData, notificationsData] = await Promise.all([
            db.medicines.toArray(),
            db.sales.toArray(),
            db.expenses.toArray(),
            db.customers.toArray(),
            db.notifications.toArray()
        ]);
        const data = { medicines: medicinesData, salesHistory: salesData, expenses: expensesData, customers: customersData, notifications: notificationsData };
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
        reader.onload = async (event: ProgressEvent<FileReader>) => {
            try {
                const result = event.target?.result;
                if (!result) return;
                const data = JSON.parse(result as string);
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
                alert('تمت استعادة البيانات بنجاح! سيتم إعادة تشغيل التطبيق الآن.');
                window.location.reload();
            } catch (err) { triggerNotif("خطأ في قراءة ملف النسخة الاحتياطية", "error"); }
        };
        reader.readAsText(file);
    }, [triggerNotif]);

    const resetApp = useCallback(async () => {
        const summary = `تقرير التصفير:\nإجمالي المبيعات: ${salesHistory.reduce((a, b: Sale) => a + (b.isReturned ? 0 : b.netAmount), 0).toFixed(2)}\nإجمالي الأصناف: ${medicines.length}`;
        if (confirm(`${summary}\n\nهل أنت متأكد من تصفير التطبيق بالكامل؟ لا يمكن التراجع.`)) {
            await db.transaction('rw', [db.sales, db.expenses, db.notifications], async () => {
                await Promise.all([db.sales.clear(), db.expenses.clear(), db.notifications.clear()]);
            });
            triggerNotif("تم تصفير السجلات والتقارير بنجاح", "info");
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
        const item = newCart.get(id) as CartItem | undefined;
        if (!item) return;
        if (item.quantity > 1) newCart.set(id, { ...item, quantity: item.quantity - 1 });
        else newCart.delete(id);
        setCart(newCart);
    }, [cart, setCart]);

    const handleSale = useCallback(async () => {
        const cartTotal = Array.from(cart.values()).reduce((sum: number, i: CartItem) => sum + (i.medicine.price * i.quantity), 0);
        const net = cartTotal - (parseFloat(payData.discount) || 0);
        const paid = (parseFloat(payData.cash) || 0) + (parseFloat(payData.bank) || 0) + (parseFloat(payData.debt) || 0);
        if (Math.abs(paid - net) > 0.1) { triggerNotif("توزيع المبالغ غير صحيح", "error"); return; }
        await db.transaction('rw', [db.medicines, db.sales, db.customers], async () => {
            const items: CartItem[] = Array.from(cart.values());
            const totalCost = items.reduce((sum: number, i: CartItem) => sum + (i.medicine.costPrice * i.quantity), 0);
            for (const item of items) {
                if (!item.medicine.id) continue;
                await db.medicines.update(item.medicine.id, {
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
                totalAmount: cartTotal,
                discount: parseFloat(payData.discount) || 0,
                netAmount: net,
                cashAmount: parseFloat(payData.cash) || 0,
                bankAmount: parseFloat(payData.bank) || 0,
                debtAmount: parseFloat(payData.debt) || 0,
                bankTrxId: payData.trx,
                customerName: payData.cust,
                totalCost,
                profit: net - totalCost,
                timestamp: Date.now(),
                itemsJson: JSON.stringify(items),
                isReturned: false
            });
        });

        // مزامنة مع Supabase (بعد الحفظ المحلي بنجاح)
        try {
            const items = Array.from(cart.values());
            const totalCostSync = items.reduce((sum: number, i: CartItem) => sum + (i.medicine.costPrice * i.quantity), 0);

            const saleData = {
                total_amount: cartTotal,
                discount: parseFloat(payData.discount) || 0,
                net_amount: net,
                cash_amount: parseFloat(payData.cash) || 0,
                bank_amount: parseFloat(payData.bank) || 0,
                debt_amount: parseFloat(payData.debt) || 0,
                bank_trx_id: payData.trx || null,
                customer_name: payData.cust || null,
                total_cost: totalCostSync,
                profit: net - totalCostSync,
                timestamp: new Date().toISOString(),
                items_json: JSON.stringify(items.map((item: CartItem) => ({
                    product_name: item.medicine.name,
                    price: item.medicine.price,
                    quantity: item.quantity
                })))
            };

            const { data, error } = await supabase.from('sales').insert([saleData]);

            if (error) {
                console.log('فشل الاتصال - تم الحفظ محلياً فقط');
                console.error('خطأ في مزامنة بيانات البيع مع Supabase:', error);
            } else {
                console.log('تمت المزامنة مع السحاب');
            }

            for (const item of items as CartItem[]) {
                const { error: inventoryError } = await supabase.rpc('decrement_inventory', {
                    product_name: item.medicine.name,
                    quantity_to_deduct: item.quantity
                });

                if (inventoryError) {
                    const { data: inventoryItem, error: fetchError } = await supabase
                        .from('inventory')
                        .select('*')
                        .eq('name', item.medicine.name)
                        .maybeSingle();

                    if (fetchError) {
                        console.error(`خطأ في قراءة مخزون ${item.medicine.name}:`, fetchError);
                        continue;
                    }

                    if (inventoryItem) {
                        const { error: updateError } = await supabase
                            .from('inventory')
                            .update({ stock: inventoryItem.stock - item.quantity })
                            .eq('name', item.medicine.name);

                        if (updateError) {
                            console.error(`خطأ في تحديث مخزون ${item.medicine.name}:`, updateError);
                        }
                    } else {
                        const { error: insertError } = await supabase
                            .from('inventory')
                            .insert({
                                name: item.medicine.name,
                                stock: -item.quantity
                            });

                        if (insertError) {
                            console.error(`خطأ في إضافة منتج ${item.medicine.name} للمخزون:`, insertError);
                        } else {
                            console.log(`تم إضافة ${item.medicine.name} للمخزون السحابي`);
                        }
                    }
                }
            }
        } catch (error) {
            console.log('فشل الاتصال - تم الحفظ محلياً فقط');
            console.error('خطأ في الاتصال مع Supabase (سيستمر العمل محلياً):', error);
        }

        setCart(new Map());
        setIsCheckoutOpen(false);
        setPayData({ discount: '', cash: '', bank: '', debt: '', trx: '', cust: '' });
        triggerNotif("تمت عملية البيع بنجاح", "info");
        loadData();
    }, [cart, payData, loadData, triggerNotif]);

    const [clickCount, setClickCount] = useState(0);

    const handleSetup = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const cleanedCode = setupCode.trim().toLowerCase();
        const allowed = ['rahaopin', 'raha'];
        if (allowed.includes(cleanedCode)) {
            try {
                localStorage.setItem('raha_initialized', 'true');
                setIsInitialized(true);
            } catch (err: unknown) {
                setIsInitialized(true);
            }
        } else {
            alert("الرمز غير صحيح. يرجى مراجعة المالك.");
            setSetupCode('');
        }
    }, [setupCode]);

    const handleLoginTitleClick = () => {
        setClickCount((prev: number) => {
            const newCount = prev + 1;
            if (newCount >= 2) {
                localStorage.setItem('raha_initialized', 'true');
                setIsInitialized(true);
                return 0;
            }
            return newCount;
        });
    };

    if (!isInitialized) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans select-none" dir="rtl">
                <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10 border border-slate-100 animate-in fade-in zoom-in duration-500">
                    <div className="text-center mb-10">
                        <div
                            className="w-20 h-20 bg-emerald-600 rounded-[30px] flex items-center justify-center text-white text-4xl mx-auto shadow-xl shadow-emerald-100 mb-6 cursor-pointer active:scale-90 transition-transform"
                            onClick={handleLoginTitleClick}
                        >
                            <Layers size={40} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">راحة <span className="text-emerald-600">PRO</span></h1>
                        <p className="text-slate-400 text-sm font-bold mt-2 uppercase tracking-widest opacity-60">Property Rights Protected</p>
                    </div>

                    <form onSubmit={handleSetup} className="space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest block">رمز الوصول الخاص</label>
                            <input
                                type="password"
                                placeholder="أدخل الرمز هنا..."
                                className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-center outline-none border-2 border-transparent focus:border-emerald-500 transition-all text-emerald-700"
                                value={setupCode}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetupCode(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-black transition-all active:scale-95"
                        >
                            دخول النظام
                        </button>
                    </form>
                    <div className="mt-8 text-center pt-6 opacity-30">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Raha Pharmacy Management System © 2026</p>
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
                        <label className="p-2.5 bg-slate-50 text-slate-400 rounded-xl cursor-pointer">
                            <Upload size={20} />
                            <input type="file" className="hidden" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleImport(e)} accept=".json" />
                        </label>
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
                            <input type="text" placeholder="بحث سريع باسم المنتج أو الباركود..." className="w-full bg-white rounded-3xl py-4 pr-12 pl-4 text-lg font-bold shadow-sm border-2 border-transparent focus:border-emerald-500 outline-none transition-all" value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} />
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
                            {categories.map((c: string) => (
                                <button key={c} onClick={() => setActiveCategory(c)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all ${activeCategory === c ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-400 shadow-sm'}`}>{c}</button>
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
                                        <div className="text-xl font-black text-emerald-700">{m.price.toFixed(2)}</div>
                                        {cart.has(m.id!) && (
                                            <div className="flex items-center gap-2 mt-2" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
                    <div className="animate-in slide-in-from-left duration-500 pb-20">
                        <div className="flex flex-col md:flex-row gap-3 mb-6">
                            <div className="relative flex-grow">
                                <input type="text" placeholder="بحث في المخزن..." className="w-full bg-white rounded-2xl py-3 pr-10 pl-4 text-sm font-bold shadow-sm outline-none" value={invSearchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvSearchQuery(e.target.value)} />
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            </div>
                            <button onClick={() => { setEditingMed(null); setIsEditOpen(true); }} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                                <Plus size={18} /> إضافة صنف
                            </button>
                        </div>

                        {/* Inventory Filters */}
                        <div className="bg-white p-4 rounded-3xl shadow-sm mb-6 flex flex-wrap gap-4 items-center">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 mr-2">فلتر الكمية</span>
                                <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none" value={invStockFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInvStockFilter(e.target.value as any)}>
                                    <option value="all">كل المخزون</option>
                                    <option value="low">مخزون منخفض</option>
                                    <option value="out">نفد المخزون</option>
                                    <option value="stagnant">أصناف راكدة</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 mr-2">الصلاحية</span>
                                <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none" value={invExpiryFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInvExpiryFilter(e.target.value as any)}>
                                    <option value="all">كل التواريخ</option>
                                    <option value="expired">منتهي</option>
                                    <option value="near">قريب الانتهاء</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 mr-2">التصنيف</span>
                                <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none" value={activeCategory} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setActiveCategory(e.target.value)}>
                                    {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Stats Summary Panel */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-[35px] border border-white shadow-sm">
                                <div className="text-[10px] font-black text-slate-400 mb-1">إجمالي الأصناف</div>
                                <div className="text-2xl font-black text-slate-800">{medicines.length}</div>
                            </div>
                            <div className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-[35px] border border-white shadow-sm">
                                <div className="text-[10px] font-black text-slate-400 mb-1">قيمة البيع المتوقعة</div>
                                <div className="text-2xl font-black text-emerald-600">{inventoryValue.sell.toLocaleString()}</div>
                            </div>
                            <div className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-[35px] border border-white shadow-sm">
                                <div className="text-[10px] font-black text-slate-400 mb-1">إجمالي التكلفة</div>
                                <div className="text-2xl font-black text-blue-600">{inventoryValue.cost.toLocaleString()}</div>
                            </div>
                            <div className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-[35px] border border-white shadow-sm">
                                <div className="text-[10px] font-black text-slate-400 mb-1">الربح المحتمل</div>
                                <div className="text-2xl font-black text-amber-600">{(inventoryValue.sell - inventoryValue.cost).toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Inventory Table/List */}
                        <div className="bg-white rounded-[40px] shadow-sm overflow-hidden border border-slate-50">
                            <div className="overflow-x-auto">
                                <table className="w-full text-right">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                                            <th className="px-6 py-4">المنتج</th>
                                            <th className="px-6 py-4">المخزون</th>
                                            <th className="px-6 py-4">سعر البيع</th>
                                            <th className="px-6 py-4">التكلفة</th>
                                            <th className="px-6 py-4 text-center">عمليات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredInventory.map((m: Medicine) => (
                                            <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">{m.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-black">{m.category} | {m.expiryDate}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="number"
                                                        className={`w-16 bg-transparent border-b-2 border-transparent focus:border-emerald-500 outline-none font-black text-sm ${(m.stock || 0) <= 5 ? 'text-rose-500' : 'text-slate-600'}`}
                                                        defaultValue={m.stock}
                                                        onBlur={(e: React.FocusEvent<HTMLInputElement>) => inlineUpdate(m.id!, 'stock', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="number"
                                                        className="w-20 bg-transparent border-b-2 border-transparent focus:border-emerald-500 outline-none font-black text-sm text-emerald-700"
                                                        defaultValue={m.price}
                                                        onBlur={(e: React.FocusEvent<HTMLInputElement>) => inlineUpdate(m.id!, 'price', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="number"
                                                        className="w-20 bg-transparent border-b-2 border-transparent focus:border-emerald-500 outline-none font-black text-sm text-slate-500"
                                                        defaultValue={m.costPrice}
                                                        onBlur={(e: React.FocusEvent<HTMLInputElement>) => inlineUpdate(m.id!, 'costPrice', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setEditingMed(m); setIsEditOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={16} /></button>
                                                        <button onClick={async () => { if (confirm('حذف الصنف؟')) { await db.medicines.delete(m.id!); loadData(); } }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                                                    </div>
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
                    <div className="animate-in slide-in-from-right duration-500">
                        {/* Accounting Filters */}
                        <div className="bg-white p-6 rounded-[35px] shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-slate-400">تاريخ التقرير</span>
                                    <input type="date" className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none" value={accDateFilter} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccDateFilter(e.target.value)} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-slate-400">طريقة الدفع</span>
                                    <div className="flex bg-slate-50 p-1 rounded-xl">
                                        {(['all', 'cash', 'bank', 'debt'] as const).map(f => (
                                            <button key={f} onClick={() => setAccPaymentFilter(f)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${accPaymentFilter === f ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>
                                                {f === 'all' ? 'الكل' : f === 'cash' ? 'كاش' : f === 'bank' ? 'بنك' : 'دين'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-left">
                                    <div className="text-[10px] font-black text-slate-400">صافي المبيعات</div>
                                    <div className="text-2xl font-black text-emerald-600">{financeStats.sales.toFixed(2)}</div>
                                </div>
                                <div className="text-left border-r pr-4 border-slate-100">
                                    <div className="text-[10px] font-black text-slate-400">إجمالي الأرباح</div>
                                    <div className="text-2xl font-black text-blue-600">{financeStats.profit.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Accounting Content Split */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-4">
                                <h2 className="text-lg font-black text-slate-800 px-2 flex items-center gap-2">
                                    <Receipt size={20} className="text-emerald-500" /> سجل العمليات
                                </h2>
                                {financeStats.list.length === 0 ? (
                                    <div className="bg-white p-20 rounded-[40px] text-center border-2 border-dashed border-slate-100">
                                        <div className="text-slate-300 font-black">لا توجد عمليات لهذا اليوم</div>
                                    </div>
                                ) : (
                                    financeStats.list.map((sale: Sale) => (
                                        <div key={sale.id} className={`bg-white p-5 rounded-[35px] shadow-sm border-2 transition-all ${sale.isReturned ? 'border-rose-100 opacity-60 bg-rose-50/20' : 'border-transparent hover:border-emerald-100'}`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-slate-800">فاتورة #{sale.id}</span>
                                                        {sale.isReturned && <span className="bg-rose-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black">مرتجع</span>}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-bold mt-1">
                                                        {new Date(sale.timestamp).toLocaleTimeString('ar-SA')} | {sale.customerName || 'عميل نقدي'}
                                                    </div>
                                                </div>
                                                <div className="text-left">
                                                    <div className={`text-xl font-black ${sale.isReturned ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>{sale.netAmount.toFixed(2)}</div>
                                                    <div className="text-[10px] font-black text-slate-300">الربح: {sale.profit.toFixed(2)}</div>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {JSON.parse(sale.itemsJson).map((it: CartItem, idx: number) => (
                                                    <span key={idx} className="bg-slate-50 text-slate-500 text-[10px] font-black px-3 py-1 rounded-lg">
                                                        {it.medicine.name} x{it.quantity}
                                                    </span>
                                                ))}
                                            </div>
                                            {!sale.isReturned && (
                                                <button onClick={() => handleReturn(sale)} className="text-[10px] font-black text-rose-500 flex items-center gap-1 hover:underline">
                                                    <RotateCcw size={12} /> إرجاع الفاتورة
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Debtors Side Panel */}
                            <div className="space-y-4">
                                <h2 className="text-lg font-black text-slate-800 px-2 flex items-center gap-2">
                                    <UserMinus size={20} className="text-amber-500" /> مديونيات العملاء
                                </h2>
                                <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-50">
                                    {financeStats.debtors.length === 0 ? (
                                        <div className="text-center py-10 text-slate-300 text-xs font-black">لا توجد ديون مسجلة</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {financeStats.debtors.map(([name, amount]: [string, number]) => (
                                                <div key={name} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-2xl transition-all">
                                                    <div>
                                                        <div className="font-bold text-slate-700">{name}</div>
                                                        <div className="text-[8px] font-black text-slate-300 uppercase">مستحق الدفع</div>
                                                    </div>
                                                    <div className="text-lg font-black text-amber-600">{amount.toFixed(2)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'expenses' && (
                    <div className="animate-in fade-in duration-500">
                        {/* Financial Analysis Dashboard */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="md:col-span-2 bg-emerald-600 p-8 rounded-[50px] text-white shadow-xl relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="text-emerald-200 text-xs font-black mb-1">الربح الصافي للفترة</div>
                                    <div className="text-5xl font-black mb-6">{expensesFinancials.netProfit.toLocaleString()}</div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md">
                                            <div className="text-emerald-200 text-[10px] font-black">أرباح المبيعات</div>
                                            <div className="text-xl font-black">{expensesFinancials.salesProfit.toLocaleString()}</div>
                                        </div>
                                        <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md">
                                            <div className="text-emerald-200 text-[10px] font-black">إجمالي المصروفات</div>
                                            <div className="text-xl font-black">{expensesFinancials.totalExp.toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                                <BarChart3 className="absolute -bottom-10 -right-10 text-white/5" size={250} />
                            </div>
                            <div className="bg-white p-8 rounded-[50px] shadow-sm border border-slate-50 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-4"><CreditCard size={32} /></div>
                                <div className="text-slate-400 text-xs font-black mb-1">نسبة المصاريف للربح</div>
                                <div className="text-3xl font-black text-slate-800">
                                    {expensesFinancials.salesProfit > 0 ? ((expensesFinancials.totalExp / expensesFinancials.salesProfit) * 100).toFixed(1) : 0}%
                                </div>
                            </div>
                        </div>

                        {/* Expenses Filters & Add */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <div className="bg-white p-4 rounded-3xl shadow-sm flex-grow flex items-center gap-4">
                                <Calendar size={18} className="text-slate-300" />
                                <input type="date" className="bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold outline-none border-none" value={expStartDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpStartDate(e.target.value)} />
                                <span className="text-slate-300 text-xs font-black">إلى</span>
                                <input type="date" className="bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold outline-none border-none" value={expEndDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpEndDate(e.target.value)} />
                            </div>
                            <button onClick={() => {
                                const desc = prompt('وصف المصروف:');
                                const amt = parseFloat(prompt('المبلغ:') || '0');
                                const cat = prompt('التصنيف:', 'نثريات');
                                if (desc && amt > 0) {
                                    db.expenses.add({ description: desc, amount: amt, type: cat!, timestamp: Date.now() });
                                    loadData();
                                    triggerNotif("تم تسجيل المصروف", "info");
                                }
                            }} className="bg-slate-900 text-white px-8 py-4 rounded-3xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center gap-2">
                                <Wallet size={20} /> إضافة مصروف
                            </button>
                        </div>

                        {/* Expenses List */}
                        <div className="bg-white rounded-[40px] shadow-sm overflow-hidden border border-slate-50">
                            <table className="w-full text-right">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase">
                                        <th className="px-8 py-5">المصروف</th>
                                        <th className="px-8 py-5">الفئة</th>
                                        <th className="px-8 py-5">المبلغ</th>
                                        <th className="px-8 py-5 text-center">الإجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {expensesFinancials.list.map((exp: Expense) => (
                                        <tr key={exp.id} className="hover:bg-slate-50/50">
                                            <td className="px-8 py-5 font-bold text-slate-700">
                                                {exp.description}
                                                <div className="text-[8px] text-slate-300 font-black">{new Date(exp.timestamp).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-8 py-5"><span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-lg">{exp.type}</span></td>
                                            <td className="px-8 py-5 font-black text-rose-600">{exp.amount.toFixed(2)}</td>
                                            <td className="px-8 py-5 text-center">
                                                <button onClick={async () => { if (confirm('حذف المصروف؟')) { await db.expenses.delete(exp.id!); loadData(); } }} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {view === 'notifications' && (
                    <div className="animate-in zoom-in-95 duration-500 pb-20">
                        <div className="flex items-center justify-between mb-8 px-4">
                            <h2 className="text-3xl font-black text-slate-800">التنبيهات <span className="text-emerald-600 text-lg">({notifs.length})</span></h2>
                            <button onClick={async () => { if (confirm('مسح كل التنبيهات؟')) { await db.notifications.clear(); loadData(); } }} className="text-rose-500 text-xs font-black flex items-center gap-1">
                                <Trash2 size={14} /> مسح السجل
                            </button>
                        </div>

                        <div className="space-y-4">
                            {notifs.length === 0 ? (
                                <div className="text-center py-24">
                                    <div className="w-24 h-24 bg-slate-100 rounded-[40px] flex items-center justify-center text-slate-300 mx-auto mb-4">
                                        <Bell size={40} />
                                    </div>
                                    <div className="text-slate-400 font-black">لا توجد تنبيهات جديدة</div>
                                </div>
                            ) : (
                                notifs.map((n: AppNotification) => (
                                    <div key={n.id} className={`p-6 rounded-[40px] shadow-sm border-2 flex gap-4 bg-white transition-all hover:border-slate-200 ${n.type === 'error' ? 'border-rose-50' : n.type === 'warning' ? 'border-amber-50' : 'border-emerald-50'}`}>
                                        <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${n.type === 'error' ? 'bg-rose-100 text-rose-500' : n.type === 'warning' ? 'bg-amber-100 text-amber-500' : 'bg-emerald-100 text-emerald-500'}`}>
                                            {n.type === 'error' ? <ShieldAlert size={24} /> : n.type === 'warning' ? <Info size={24} /> : <CheckCircle2 size={24} />}
                                        </div>
                                        <div className="flex-grow">
                                            <div className="text-xs font-black text-slate-700 leading-relaxed mb-2">{n.message}</div>
                                            <div className="flex items-center justify-between">
                                                <div className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                                                    <Clock size={12} /> {new Date(n.timestamp).toLocaleString('ar-SA')}
                                                </div>
                                                <button onClick={async () => { await db.notifications.delete(n.id!); loadData(); }} className="text-slate-200 hover:text-rose-400 transition-colors"><X size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Shopping Cart Sticky Footer */}
            {cart.size > 0 && view === 'pos' && (
                <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/90 to-transparent">
                    <div className="max-w-4xl mx-auto bg-slate-900 text-white p-5 rounded-[40px] shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-full duration-500">
                        <div className="flex items-center gap-6 pr-4 border-l border-white/10">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400">إجمالي السلة</span>
                                <span className="text-2xl font-black text-emerald-400">
                                    {Array.from(cart.values()).reduce((sum: number, item: CartItem) => sum + (item.medicine.price * item.quantity), 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400">عدد الأصناف</span>
                                <span className="text-2xl font-black">{cart.size}</span>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setCart(new Map())} className="p-4 bg-white/10 hover:bg-rose-500 text-white rounded-3xl transition-all"><Trash2 size={24} /></button>
                            <button onClick={() => setIsCheckoutOpen(true)} className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-10 py-4 rounded-3xl font-black text-lg shadow-lg active:scale-95 transition-all flex items-center gap-2">
                                <CheckCircle2 size={24} /> إتمام البيع
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Checkout Modal */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[50px] shadow-2xl p-8 animate-in slide-in-from-bottom-20 duration-500">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-black text-slate-800">تأكيد المبيعة</h2>
                            <button onClick={() => setIsCheckoutOpen(false)} className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400"><X size={24} /></button>
                        </div>

                        <div className="space-y-6 mb-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 relative">
                                    <input type="text" placeholder="اسم العميل (اختياري)..." className="w-full bg-slate-50 p-5 rounded-3xl border-none outline-none font-bold text-sm focus:ring-2 ring-emerald-500 transition-all" value={payData.cust} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayData({ ...payData, cust: e.target.value })} />
                                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                </div>
                                <div className="bg-slate-50 p-6 rounded-[35px] relative">
                                    <div className="text-[10px] font-black text-emerald-500 mb-1">المبلغ النقدي</div>
                                    <input type="number" className="bg-transparent border-none outline-none w-full text-2xl font-black text-slate-800" placeholder="0.00" value={payData.cash} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayData({ ...payData, cash: e.target.value })} />
                                    <Wallet className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-200" size={24} />
                                </div>
                                <div className="bg-slate-50 p-6 rounded-[35px] relative">
                                    <div className="text-[10px] font-black text-blue-500 mb-1">تحويل بنكي</div>
                                    <input type="number" className="bg-transparent border-none outline-none w-full text-2xl font-black text-slate-800" placeholder="0.00" value={payData.bank} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayData({ ...payData, bank: e.target.value })} />
                                    <CreditCard className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-200" size={24} />
                                </div>
                                <div className="bg-amber-50 p-6 rounded-[35px] relative">
                                    <div className="text-[10px] font-black text-amber-500 mb-1">المبلغ المتبقي (دين)</div>
                                    <input type="number" className="bg-transparent border-none outline-none w-full text-2xl font-black text-slate-800" placeholder="0.00" value={payData.debt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayData({ ...payData, debt: e.target.value })} />
                                    <UserMinus className="absolute left-6 top-1/2 -translate-y-1/2 text-amber-200" size={24} />
                                </div>
                                <div className="bg-rose-50 p-6 rounded-[35px] relative">
                                    <div className="text-[10px] font-black text-rose-500 mb-1">خصم (قرش)</div>
                                    <input type="number" className="bg-transparent border-none outline-none w-full text-2xl font-black text-slate-800" placeholder="0.00" value={payData.discount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayData({ ...payData, discount: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <button onClick={handleSale} className="w-full bg-emerald-600 text-white py-6 rounded-[35px] font-black text-xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 active:scale-95">
                            <CheckCircle2 size={24} /> تأكيد وحفظ العملية
                        </button>
                    </div>
                </div>
            )}

            {/* Add/Edit Medicine Modal */}
            {isEditOpen && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[60px] shadow-2xl p-10 relative animate-in zoom-in-95 duration-500">
                        <button onClick={() => setIsEditOpen(false)} className="absolute top-8 left-8 w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 hover:text-rose-500 transition-all"><X size={24} /></button>
                        <h2 className="text-3xl font-black text-slate-800 mb-8">{editingMed ? 'تعديل صنف' : 'إضافة صنف جديد'}</h2>

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const med: Partial<Medicine> = {
                                name: formData.get('name') as string,
                                barcode: formData.get('barcode') as string,
                                category: formData.get('category') as string,
                                price: parseFloat(formData.get('price') as string),
                                costPrice: parseFloat(formData.get('costPrice') as string),
                                stock: parseFloat(formData.get('stock') as string),
                                expiryDate: formData.get('expiryDate') as string,
                                supplier: formData.get('supplier') as string,
                                addedDate: editingMed?.addedDate || new Date().toISOString().split('T')[0]
                            };

                            if (editingMed) await db.medicines.update(editingMed.id!, med);
                            else await db.medicines.add(med as Medicine);

                            setIsEditOpen(false);
                            loadData();
                            triggerNotif(editingMed ? "تم التحديث" : "تمت الإضافة", "info");
                        }} className="grid grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="text-[10px] font-black text-slate-400 mr-2 mb-1 block">اسم الصنف الكامل</label>
                                <input name="name" required defaultValue={editingMed?.name} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-emerald-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 mr-2 mb-1 block">الباركود</label>
                                <input name="barcode" defaultValue={editingMed?.barcode} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 mr-2 mb-1 block">الفئة / التصنيف</label>
                                <input name="category" required defaultValue={editingMed?.category} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none" list="cats" />
                                <datalist id="cats">{categories.map((c: string) => <option key={c} value={c} />)}</datalist>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 mr-2 mb-1 block">سعر البيع</label>
                                <input name="price" type="number" step="0.01" required defaultValue={editingMed?.price} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none text-emerald-600" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 mr-2 mb-1 block">سعر التكلفة</label>
                                <input name="costPrice" type="number" step="0.01" required defaultValue={editingMed?.costPrice} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 mr-2 mb-1 block">الكمية المتوفرة</label>
                                <input name="stock" type="number" required defaultValue={editingMed?.stock} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 mr-2 mb-1 block">تاريخ الانتهاء</label>
                                <input name="expiryDate" type="date" required defaultValue={editingMed?.expiryDate} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none" />
                            </div>
                            <div className="col-span-2">
                                <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-lg shadow-xl hover:bg-black transition-all">
                                    {editingMed ? 'حفظ التعديلات' : 'إضافة للمخزن الآن'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default App;

