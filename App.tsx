import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Search, Plus, BarChart3, ShoppingCart, X, Trash2,
    CheckCircle2, TrendingUp, CreditCard, Wallet, UserMinus,
    ArrowRight, Minus, Edit3, Receipt, Calendar,
    RotateCcw, Download, Upload, Layers, Bell, Info, ArrowUpRight, Clock, ShieldAlert, Filter, User
} from 'lucide-react';
import { db } from './db';
import { Medicine, ViewType, Sale, CartItem, Expense, Customer, AppNotification } from './types';
const App: React.FC = () => {
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
    useEffect(() => { loadData(); }, [loadData]);
    const triggerNotif = async (message: string, type: 'warning' | 'error' | 'info' = 'info') => {
        const n: AppNotification = { message, type, timestamp: Date.now() };
        await db.notifications.add(n);
        setActiveNotif(n);
        setTimeout(() => setActiveNotif(null), 4000);
        loadData();
    };
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
        const debtors = new Map<string, number>();
        if (accPaymentFilter === 'debt') {
            salesHistory.forEach(s => {
                if (!s.isReturned && s.debtAmount > 0 && s.customerName) {
                    const current = debtors.get(s.customerName) || 0;
                    debtors.set(s.customerName, current + s.debtAmount);
                }
            });
        }
        return { ...totals, list: filtered, debtors: Array.from(debtors.entries()) };
    }, [salesHistory, accDateFilter, accPaymentFilter]);
    const expensesFinancials = useMemo(() => {
        // Filter expenses by date range
        const filteredExps = expenses.filter(e => {
            const d = new Date(e.timestamp).toISOString().split('T')[0];
            return d >= expStartDate && d <= expEndDate;
        });
        // Filter sales for the same period
        const filteredSales = salesHistory.filter(s => {
            const d = new Date(s.timestamp).toISOString().split('T')[0];
            return d >= expStartDate && d <= expEndDate && !s.isReturned;
        });
        // Calculate totals
        const totalExp = filteredExps.reduce((sum, e) => sum + e.amount, 0);
        const totalCost = filteredSales.reduce((sum, s) => sum + s.totalCost, 0);
        const salesProfit = filteredSales.reduce((sum, s) => sum + s.profit, 0);
        const netProfit = salesProfit - totalExp;
        return { list: filteredExps, totalExp, totalCost, salesProfit, netProfit };
    }, [expenses, salesHistory, expStartDate, expEndDate]);
    const inlineUpdate = async (id: number, field: string, value: any) => {
        const val = (field === 'price' || field === 'costPrice' || field === 'stock') ? parseFloat(value) : value;
        await db.medicines.update(id, { [field]: val });
        loadData();
    };
    const handleReturn = async (sale: Sale) => {
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
    };
    const backupData = async () => {
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
    };
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                        db.sales.bulkAdd(data.sales || data.salesHistory || []), // Handle both keys
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
    };
    const resetApp = async () => {
        const summary = `تقرير التصفير:\nإجمالي المبيعات: ${salesHistory.reduce((a, b) => a + (b.isReturned ? 0 : b.netAmount), 0).toFixed(2)}\nإجمالي الأصناف: ${medicines.length}`;
        if (confirm(`${summary}\n\nهل أنت متأكد من تصفير التطبيق بالكامل؟ لا يمكن التراجع.`)) {
            await db.transaction('rw', [db.sales, db.expenses, db.notifications], async () => {
                await Promise.all([db.sales.clear(), db.expenses.clear(), db.notifications.clear()]);
            });
            triggerNotif("تم تصفير السجلات والتقارير بنجاح", "info");
            loadData();
        }
    };
    const addToCart = (m: Medicine) => {
        if (m.stock <= 0) { triggerNotif(`نفد مخزون ${m.name}`, "error"); return; }
        const newCart = new Map(cart);
        const item = newCart.get(m.id!) || { medicine: m, quantity: 0 };
        if (item.quantity < m.stock) {
            newCart.set(m.id!, { ...item, quantity: item.quantity + 1 });
            setCart(newCart);
        } else { triggerNotif("لا توجد كمية كافية", "warning"); }
    };
    const removeFromCart = (id: number) => {
        const newCart = new Map(cart);
        const item = newCart.get(id);
        if (!item) return;
        if (item.quantity > 1) newCart.set(id, { ...item, quantity: item.quantity - 1 });
        else newCart.delete(id);
        setCart(newCart);
    };
    const handleSale = async () => {
        const cartTotal = Array.from(cart.values()).reduce((s, i) => s + (i.medicine.price * i.quantity), 0);
        const net = cartTotal - (parseFloat(payData.discount) || 0);
        const paid = (parseFloat(payData.cash) || 0) + (parseFloat(payData.bank) || 0) + (parseFloat(payData.debt) || 0);
        if (Math.abs(paid - net) > 0.1) { triggerNotif("توزيع المبالغ غير صحيح", "error"); return; }
        await db.transaction('rw', [db.medicines, db.sales, db.customers], async () => {
            const items = Array.from(cart.values());
            const totalCost = items.reduce((s, i) => s + (i.medicine.costPrice * i.quantity), 0);
            for (const item of items) {
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
                itemsJson: JSON.stringify(items)
            });
        });
        setCart(new Map());
        setIsCheckoutOpen(false);
        triggerNotif("تمت عملية البيع بنجاح", "info");
        loadData();
    };
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
                        <label className="p-2.5 bg-slate-50 text-slate-400 rounded-xl cursor-pointer"><Upload size={20} /><input type="file" className="hidden" onChange={handleImport} accept=".json" /></label>
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
                                        <div className="text-xl font-black text-emerald-700">{m.price.toFixed(2)}</div>
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
                    <div className="space-y-4 animate-in slide-in-from-left">
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            <div className="bg-emerald-600 p-6 rounded-[35px] text-white shadow-xl shadow-emerald-100">
                                <div className="text-[9px] font-black opacity-70 mb-1 uppercase tracking-widest">قيمة المخزون (بيع)</div>
                                <div className="text-2xl font-black">{inventoryValue.sell.toLocaleString()}</div>
                            </div>
                            <div className="bg-slate-800 p-6 rounded-[35px] text-white shadow-xl">
                                <div className="text-[9px] font-black opacity-70 mb-1 uppercase tracking-widest">التكلفة (رأس مال)</div>
                                <div className="text-2xl font-black">{inventoryValue.cost.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-[35px] shadow-sm space-y-4">
                            <div className="relative">
                                <input type="text" placeholder="بحث في المخزن باسم المنتج أو الباركود..." className="w-full bg-white rounded-3xl py-3 pr-12 pl-4 text-sm font-bold shadow-sm border border-slate-100 focus:border-emerald-500 outline-none transition-all" value={invSearchQuery} onChange={e => setInvSearchQuery(e.target.value)} />
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                    <Filter size={14} className="text-slate-400 mr-1" />
                                    <select className="bg-white p-2 rounded-xl text-[10px] font-black outline-none shadow-sm" value={invStockFilter} onChange={e => setInvStockFilter(e.target.value as any)}>
                                        <option value="all">كل الكميات</option><option value="low">نواقص (5 فأقل)</option><option value="out">نفد (0)</option><option value="stagnant">راكد (60 يوم)</option>
                                    </select>
                                    <select className="bg-white p-2 rounded-xl text-[10px] font-black outline-none shadow-sm text-rose-500" value={invExpiryFilter} onChange={e => setInvExpiryFilter(e.target.value as any)}>
                                        <option value="all">صلاحية: الكل</option><option value="expired">منتهية</option><option value="near">قريبة الانتهاء</option>
                                    </select>
                                </div>
                                <div className="flex flex-wrap gap-2 flex-grow">
                                    <select className="bg-slate-50 p-2.5 rounded-xl text-[10px] font-black outline-none border-none flex-grow" value={activeCategory} onChange={e => setActiveCategory(e.target.value)}>
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select className="bg-slate-50 p-2.5 rounded-xl text-[10px] font-black outline-none border-none flex-grow" value={invSupplierFilter} onChange={e => setInvSupplierFilter(e.target.value)}>
                                        {suppliers.map(s => <option key={s} value={s}>{s === 'الكل' ? 'كل الموردين' : s}</option>)}
                                    </select>
                                    <input type="date" className="bg-slate-50 p-2.5 rounded-xl text-[10px] font-black border-none" value={invDateFilter} onChange={e => setInvDateFilter(e.target.value)} />
                                    <button onClick={() => { setInvDateFilter(''); setInvStockFilter('all'); setInvExpiryFilter('all'); setInvSupplierFilter('الكل'); setActiveCategory('الكل'); }} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all"><RotateCcw size={14} /></button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 text-slate-400 font-black border-b border-slate-100">
                                        <tr><th className="p-4">الصنف</th><th className="p-4">الكمية</th><th className="p-4">السعر</th><th className="p-4">الصلاحية</th><th className="p-4">تاريخ الإضافة</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 font-bold">
                                        {filteredInventory.map(m => (
                                            <tr key={m.id} onClick={() => { setEditingMed(m); setIsEditOpen(true); }} className="hover:bg-slate-50 cursor-pointer">
                                                <td className="p-4">
                                                    <div>{m.name}</div>
                                                    <div className="flex gap-2 text-[9px]">
                                                        <span className="text-slate-300 font-black">{m.supplier}</span>
                                                        <span className="text-emerald-400 font-black px-1 bg-emerald-50 rounded">{m.category}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4"><span className={`px-2 py-1 rounded-lg ${m.stock <= 5 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>{m.stock}</span></td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1">
                                                        <input type="number" onFocus={e => e.target.select()} className="w-16 bg-emerald-50 text-emerald-700 font-black rounded px-1" defaultValue={m.price} onBlur={e => inlineUpdate(m.id!, 'price', e.target.value)} onClick={e => e.stopPropagation()} />
                                                        <input type="number" onFocus={e => e.target.select()} className="w-16 bg-slate-50 text-slate-400 font-bold rounded px-1" defaultValue={m.costPrice} onBlur={e => inlineUpdate(m.id!, 'costPrice', e.target.value)} onClick={e => e.stopPropagation()} />
                                                    </div>
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    <div className={`${m.expiryDate < new Date().toISOString().split('T')[0] ? 'text-rose-600 bg-rose-50 px-2 py-1 rounded' : 'text-slate-400'}`}>{m.expiryDate}</div>
                                                </td>
                                                <td className="p-4 text-slate-300 text-[10px] whitespace-nowrap">{m.addedDate}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                {view === 'accounting' && (
                    <div className="space-y-6 animate-in zoom-in-95">
                        <div className="flex items-center gap-2 mb-2 bg-white p-2 rounded-3xl shadow-sm">
                            <input type="date" className="bg-slate-50 p-3 rounded-2xl text-xs font-black border-none outline-none" value={accDateFilter} onChange={e => setAccDateFilter(e.target.value)} />
                            <select className="bg-slate-50 p-3 rounded-2xl text-xs font-black outline-none flex-grow" value={accPaymentFilter} onChange={e => setAccPaymentFilter(e.target.value as any)}>
                                <option value="all">كل العمليات</option>
                                <option value="cash">كاش (نقداً)</option>
                                <option value="bank">بنكك</option>
                                <option value="debt">آجل (مديونية)</option>
                            </select>
                        </div>
                        <div className="bg-slate-900 p-8 rounded-[45px] text-white shadow-2xl space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">صافي الأرباح</span>
                                    <h2 className="text-4xl font-black mt-1">{financeStats.profit.toFixed(2)} <span className="text-xs font-normal opacity-50">ج.م</span></h2>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-slate-400 uppercase">المبيعات</div>
                                    <div className="text-xl font-black">{financeStats.sales.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                        {accPaymentFilter === 'debt' && financeStats.debtors.length > 0 && (
                            <div className="bg-amber-50 rounded-[35px] p-6 border border-amber-100 animate-in slide-in-from-right">
                                <h3 className="text-lg font-black text-amber-700 mb-4 flex items-center gap-2"><UserMinus size={20} /> قائمة المديونين (من العمليات)</h3>
                                <div className="space-y-2">
                                    {financeStats.debtors.map(([name, amount]) => (
                                        <div key={name} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><User size={14} /></div>
                                                <span className="font-bold text-slate-800">{name || 'زبون عام (غير مسجل)'}</span>
                                            </div>
                                            <span className="font-black text-amber-600">{amount.toFixed(2)} ج.م</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="space-y-3">
                            {financeStats.list.map(s => (
                                <div key={s.id} className={`p-6 rounded-[35px] bg-white border border-slate-100 shadow-sm flex flex-col gap-4 ${s.isReturned ? 'opacity-40 grayscale' : ''}`}>
                                    <div className="flex justify-between items-start">
                                        <div><div className="text-xl font-black text-slate-800">{s.netAmount.toFixed(2)} ج.م</div><div className="text-[9px] font-bold text-slate-400">{new Date(s.timestamp).toLocaleTimeString('ar-EG')}</div></div>
                                        <div className="flex gap-2">
                                            {s.cashAmount > 0 && <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Wallet size={16} /></div>}
                                            {s.bankAmount > 0 && <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><CreditCard size={16} /></div>}
                                            {s.debtAmount > 0 && <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><UserMinus size={16} /></div>}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                                        <div className="text-[10px] font-bold text-slate-500">{s.customerName || 'زبون عام'} {s.bankTrxId && `| عمليّة: ${s.bankTrxId}`}</div>
                                        {!s.isReturned && <button onClick={() => handleReturn(s)} className="text-[10px] font-black text-rose-500 bg-rose-50 px-4 py-2 rounded-xl transition-all">إرجاع</button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {view === 'expenses' && (
                    <div className="space-y-6 animate-in slide-in-from-right">
                        {/* Add Expense Form */}
                        <div className="bg-white p-8 rounded-[40px] shadow-sm">
                            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><ArrowUpRight className="text-rose-500" /> إضافة منصرف</h2>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const form = e.target as any;
                                await db.expenses.add({ amount: parseFloat(form.amt.value) || 0, type: form.typ.value, description: form.dsc.value, timestamp: Date.now() });
                                form.reset(); triggerNotif("تم تسجيل المنصرف", "info"); loadData();
                            }} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <input name="amt" type="number" step="0.01" onFocus={e => e.target.select()} placeholder="المبلغ" required className="bg-slate-50 p-4 rounded-3xl font-black outline-none" />
                                    <input name="typ" list="exp-types" placeholder="نوع المنصرف" required className="bg-slate-50 p-4 rounded-3xl font-black outline-none" />
                                    <datalist id="exp-types">{expenseTypes.map(t => <option key={t} value={t} />)}</datalist>
                                </div>
                                <input name="dsc" type="text" placeholder="الوصف..." className="w-full bg-slate-50 p-4 rounded-3xl font-bold outline-none" />
                                <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black shadow-lg">حفظ المنصرف</button>
                            </form>
                        </div>
                        {/* Date Range Filter */}
                        <div className="bg-white p-4 rounded-[35px] shadow-sm flex items-center gap-3">
                            <Clock className="text-slate-400" size={20} />
                            <div className="flex items-center gap-2 flex-grow">
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-black text-slate-400">من</label>
                                    <input type="date" className="bg-slate-50 px-3 py-2 rounded-xl text-xs font-black outline-none" value={expStartDate} onChange={e => { setExpStartDate(e.target.value); if (e.target.value > expEndDate) setExpEndDate(e.target.value); }} />
                                </div>
                                <ArrowRight className="text-slate-300" size={16} />
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-black text-slate-400">إلى</label>
                                    <input type="date" className="bg-slate-50 px-3 py-2 rounded-xl text-xs font-black outline-none" value={expEndDate} onChange={e => setExpEndDate(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        {/* Expenses Table */}
                        <div className="bg-white p-5 rounded-[35px] shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 text-slate-400 font-black border-b border-slate-100">
                                        <tr><th className="p-4">التاريخ</th><th className="p-4">النوع</th><th className="p-4">الوصف</th><th className="p-4">المبلغ</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 font-bold">
                                        {expensesFinancials.list.map(e => (
                                            <tr key={e.id} className="hover:bg-slate-50">
                                                <td className="p-4 text-slate-400 text-[10px] whitespace-nowrap">{new Date(e.timestamp).toLocaleDateString('ar-EG')}</td>
                                                <td className="p-4"><span className="text-rose-500 bg-rose-50 px-2 py-1 rounded text-[10px] font-black uppercase">{e.type}</span></td>
                                                <td className="p-4 text-slate-700">{e.description || 'منصرف عام'}</td>
                                                <td className="p-4 text-rose-600 font-black">-{e.amount.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {/* Financial Summary */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[45px] text-white shadow-2xl space-y-4">
                            <h3 className="text-lg font-black text-emerald-400 mb-4 flex items-center gap-2"><TrendingUp size={20} /> الملخص المالي للفترة</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/10 p-4 rounded-2xl">
                                    <div className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-1">إجمالي المنصرفات</div>
                                    <div className="text-2xl font-black text-rose-400">-{expensesFinancials.totalExp.toFixed(2)}</div>
                                </div>
                                <div className="bg-white/10 p-4 rounded-2xl">
                                    <div className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">رأس المال المسحوب</div>
                                    <div className="text-2xl font-black text-blue-400">{expensesFinancials.totalCost.toFixed(2)}</div>
                                </div>
                            </div>
                            <div className="bg-emerald-600 p-6 rounded-2xl mt-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-[10px] font-black text-emerald-200 uppercase tracking-widest">الربح الصافي النهائي</div>
                                        <div className="text-sm font-bold text-emerald-100 mt-1">(بعد خصم المنصرفات)</div>
                                    </div>
                                    <div className="text-4xl font-black text-white">{expensesFinancials.netProfit.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {view === 'notifications' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-black text-slate-800">صندوق التنبيهات</h2>
                            <button onClick={async () => { await db.notifications.clear(); loadData(); }} className="text-xs font-black text-rose-500 flex items-center gap-1"><Trash2 size={14} /> مسح الكل</button>
                        </div>
                        {notifs.map(n => (
                            <div key={n.id} className={`p-5 rounded-[28px] border-2 bg-white flex items-center gap-4 shadow-sm ${n.type === 'error' ? 'border-rose-100' : 'border-slate-50'}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${n.type === 'error' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {n.type === 'error' ? <ShieldAlert size={20} /> : <Info size={20} />}
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-slate-800">{n.message}</div>
                                    <div className="text-[9px] font-black text-slate-300 uppercase mt-1">{new Date(n.timestamp).toLocaleString('ar-EG')}</div>
                                </div>
                            </div>
                        ))}
                        {notifs.length === 0 && <div className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest">لا توجد تنبيهات جديدة</div>}
                    </div>
                )}
            </main>
            {view === 'pos' && cart.size > 0 && (
                <div className="fixed bottom-28 left-0 right-0 px-6 z-40 animate-in slide-in-from-bottom">
                    <div className="max-w-xl mx-auto bg-slate-900 text-white p-6 rounded-[40px] shadow-2xl flex items-center justify-between border border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-3xl bg-emerald-600 flex items-center justify-center text-white font-black text-xl">{Array.from(cart.values()).reduce((s, i) => s + i.quantity, 0)}</div>
                            <div>
                                <div className="text-2xl font-black tabular-nums">{Array.from(cart.values()).reduce((s, i) => s + (i.medicine.price * i.quantity), 0).toFixed(2)} <span className="text-[10px] opacity-50">ج.م</span></div>
                                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">إجمالي السلة</div>
                            </div>
                        </div>
                        <button onClick={() => {
                            const total = Array.from(cart.values()).reduce((s, i) => s + (i.medicine.price * i.quantity), 0);
                            setPayData({ discount: '', cash: total.toString(), bank: '', debt: '', trx: '', cust: '' });
                            setIsCheckoutOpen(true);
                        }} className="bg-white text-slate-900 px-8 py-4 rounded-3xl font-black flex items-center gap-2">دفع <ArrowRight size={20} /></button>
                    </div>
                </div>
            )}
            <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center px-4 pt-4 pb-12 z-30 shrink-0">
                <button onClick={() => setView('pos')} className={`flex flex-col items-center gap-1 transition-all ${view === 'pos' ? 'text-emerald-600' : 'text-slate-300'}`}>
                    <ShoppingCart size={24} strokeWidth={3} /> <span className="text-[10px] font-black uppercase tracking-tighter">البيع</span>
                </button>
                <button onClick={() => { setEditingMed(null); setIsEditOpen(true); }} className="bg-emerald-600 text-white w-20 h-20 rounded-[35px] shadow-2xl flex items-center justify-center active:scale-90 transition-all border-8 border-[#F8FAFC] -mt-10">
                    <Plus size={36} strokeWidth={3} />
                </button>
                <button onClick={() => setView('accounting')} className={`flex flex-col items-center gap-1 transition-all ${view === 'accounting' ? 'text-emerald-600' : 'text-slate-300'}`}>
                    <BarChart3 size={24} strokeWidth={3} /> <span className="text-[10px] font-black uppercase tracking-tighter">التقارير</span>
                </button>
            </nav>
            {isCheckoutOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white w-full max-w-lg rounded-t-[45px] sm:rounded-[50px] shadow-2xl flex flex-col max-h-[95vh] animate-in slide-in-from-bottom">
                        <div className="p-10 pb-4 flex justify-between items-center">
                            <h2 className="text-3xl font-black text-slate-800 tracking-tighter">إتمام الطلبية</h2>
                            <button onClick={() => setIsCheckoutOpen(false)} className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-rose-50 transition-all"><X /></button>
                        </div>
                        <div className="p-10 pt-4 space-y-6 overflow-y-auto no-scrollbar pb-16">
                            <div className="bg-emerald-50 p-8 rounded-[40px] border border-emerald-100 flex justify-between items-center shadow-inner">
                                <div>
                                    <div className="text-[10px] font-black text-emerald-600 opacity-60 uppercase tracking-widest">المبلغ المطلوب</div>
                                    <div className="text-4xl font-black text-emerald-700 tabular-nums">
                                        {(Array.from(cart.values()).reduce((s, i) => s + (i.medicine.price * i.quantity), 0) - (parseFloat(payData.discount) || 0)).toFixed(2)}
                                    </div>
                                </div>
                                <Receipt className="text-emerald-200" size={40} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-tighter">الخصم</label>
                                    <input type="number" onFocus={e => e.target.select()} className="w-full bg-slate-50 p-4 rounded-3xl font-black text-lg outline-none border-2 border-transparent focus:border-emerald-500" value={payData.discount} onChange={e => setPayData({ ...payData, discount: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-emerald-500 mr-2 uppercase tracking-tighter">نقداً (كاش)</label>
                                    <input type="number" onFocus={e => e.target.select()} className="w-full bg-emerald-50/30 p-4 rounded-3xl font-black text-lg outline-none border-2 border-emerald-100 focus:border-emerald-500" value={payData.cash} onChange={e => setPayData({ ...payData, cash: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-blue-500 mr-2 uppercase tracking-tighter">بنكك</label>
                                    <input type="number" onFocus={e => e.target.select()} className="w-full bg-blue-50/30 p-4 rounded-3xl font-black text-lg outline-none border-2 border-blue-100 focus:border-blue-500" value={payData.bank} onChange={e => setPayData({ ...payData, bank: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-amber-600 mr-2 uppercase tracking-tighter">آجل (مديونية)</label>
                                    <input type="number" onFocus={e => e.target.select()} className="w-full bg-amber-50/30 p-4 rounded-3xl font-black text-lg outline-none border-2 border-amber-100 focus:border-amber-500" value={payData.debt} onChange={e => setPayData({ ...payData, debt: e.target.value })} />
                                </div>
                            </div>
                            {parseFloat(payData.bank) > 0 && (
                                <div className="animate-in zoom-in duration-300">
                                    <label className="text-[10px] font-black text-blue-400 mr-2">رقم العملية البنكية</label>
                                    <input type="text" placeholder="أدخل الرقم..." className="w-full bg-blue-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-blue-100" value={payData.trx} onChange={e => setPayData({ ...payData, trx: e.target.value })} />
                                </div>
                            )}
                            {parseFloat(payData.debt) > 0 && (
                                <div className="animate-in slide-in-from-top duration-300">
                                    <label className="text-[10px] font-black text-amber-500 mr-2">اسم صاحب الدين</label>
                                    <input list="cust-list" type="text" placeholder="اختر من القائمة أو أضف جديداً..." className="w-full bg-amber-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-amber-100 focus:border-amber-500" value={payData.cust} onChange={e => setPayData({ ...payData, cust: e.target.value })} />
                                    <datalist id="cust-list">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
                                </div>
                            )}
                            <button onClick={handleSale} className="w-full bg-slate-900 text-white py-6 rounded-[35px] font-black text-xl shadow-2xl active:scale-95 transition-all mt-6 flex items-center justify-center gap-3">
                                <CheckCircle2 size={24} /> تثبيت وحفظ العملية
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isEditOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white w-full max-w-lg rounded-t-[45px] sm:rounded-[50px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom">
                        <div className="p-10 pb-4 flex justify-between items-center">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tighter">{editingMed ? 'تعديل الصنف' : 'صنف جديد لـ راحة'}</h2>
                            <button onClick={() => setIsEditOpen(false)} className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center"><X /></button>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const f = e.target as any;
                            const data: Medicine = {
                                name: f.nm.value, barcode: f.bc.value, price: parseFloat(f.pr.value) || 0,
                                costPrice: parseFloat(f.cp.value) || 0, stock: parseInt(f.st.value) || 0,
                                category: f.ct.value, expiryDate: f.ex.value, supplier: f.sp.value,
                                addedDate: editingMed?.addedDate || new Date().toISOString().split('T')[0],
                                usageCount: editingMed?.usageCount || 0
                            };
                            if (editingMed?.id) await db.medicines.update(editingMed.id, data);
                            else await db.medicines.add(data);
                            setIsEditOpen(false); triggerNotif("تم حفظ البيانات", "info"); loadData();
                        }} className="p-10 pt-4 space-y-5 overflow-y-auto no-scrollbar pb-16">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2 flex items-center gap-1"><Info size={12} /> اسم المنتج</label>
                                <input name="nm" type="text" defaultValue={editingMed?.name} required className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-emerald-600 mr-2">سعر البيع</label>
                                    <input name="pr" type="number" step="0.01" onFocus={e => e.target.select()} defaultValue={editingMed?.price} required className="w-full bg-emerald-50/30 p-5 rounded-3xl font-black text-lg outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2">سعر التكلفة</label>
                                    <input name="cp" type="number" step="0.01" onFocus={e => e.target.select()} defaultValue={editingMed?.costPrice} required className="w-full bg-slate-50 p-5 rounded-3xl font-black text-lg outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2">الكمية المتوفرة</label>
                                    <input name="st" type="number" onFocus={e => e.target.select()} defaultValue={editingMed?.stock} required className="w-full bg-slate-50 p-5 rounded-3xl font-black text-lg outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2 tracking-tighter">التصنيف (مثلاً: مسكنات)</label>
                                    <input name="ct" list="cat-list-edit" defaultValue={editingMed?.category} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none" />
                                    <datalist id="cat-list-edit">{Array.from(new Set(medicines.map(m => m.category))).map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 mr-2">المورد</label>
                                    <input name="sp" list="sup-list-edit" defaultValue={editingMed?.supplier} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none" />
                                    <datalist id="sup-list-edit">{Array.from(new Set(medicines.map(m => m.supplier))).map(s => <option key={s} value={s} />)}</datalist>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-rose-500 mr-2 flex items-center gap-1"><Calendar size={12} /> تاريخ الصلاحية</label>
                                    <input name="ex" type="date" defaultValue={editingMed?.expiryDate || '2026-01-01'} required className="w-full bg-rose-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-rose-50 focus:border-rose-400 appearance-none text-rose-700" />
                                </div>
                            </div>
                            <input name="bc" type="text" placeholder="الباركود (إن وجد)" defaultValue={editingMed?.barcode} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" />
                            <div className="flex gap-3 pt-6">
                                <button type="submit" className="flex-grow bg-emerald-600 text-white py-6 rounded-[35px] font-black text-xl shadow-xl active:scale-95 transition-all">حفظ البيانات</button>
                                {editingMed?.id && (
                                    <button type="button" onClick={async () => { if (confirm('حذف هذا الصنف نهائياً من راحة؟')) { await db.medicines.delete(editingMed.id!); setIsEditOpen(false); triggerNotif("تم حذف الصنف", "info"); loadData(); } }} className="bg-rose-50 text-rose-500 px-8 rounded-[35px] hover:bg-rose-100 shadow-sm"><Trash2 size={24} /></button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default App;