
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Search, Plus, Package, BarChart3, ShoppingCart, X, Trash2, 
  CheckCircle2, TrendingUp, AlertCircle, 
  CreditCard, Wallet, UserMinus, ShoppingBag, 
  ArrowRight, Minus, Edit3, Truck, Receipt, 
  RotateCcw, Download, Filter, ArrowDownRight, Layers, Bell, Calendar,
  ArrowUpRight, Info
} from 'lucide-react';
import { db } from './db';
import { Medicine, ViewType, Sale, CartItem, Expense, Customer } from './types';
import { createClient } from '@supabase/supabase-js';

// Supabase Configuration - قناة الاتصال مع سيرفر ألمانيا
const SUPABASE_URL = 'https://cihficjizojbtnshwtfl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9Nmdm3LJUHK1fBF0ihj38g_ophBRHyD';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('pos');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('الكل');
  
  // Inventory Advanced Filters (Separated)
  const [invStockFilter, setInvStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [invExpiryFilter, setInvExpiryFilter] = useState<'all' | 'expired' | 'near'>('all');
  const [selectedSupplier, setSelectedSupplier] = useState('الكل');
  
  // Financial & Expense Filters
  const [payFilter, setPayFilter] = useState<'all' | 'cash' | 'bank' | 'debt'>('all');
  const [expenseDateFilter, setExpenseDateFilter] = useState(new Date().toISOString().split('T')[0]);

  // Checkout & UI State
  const [cart, setCart] = useState<Map<number, CartItem>>(new Map());
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [payData, setPayData] = useState({ discount: '', cash: '', bank: '', debt: '', trx: '', cust: '' });

  const loadData = useCallback(async () => {
    const [m, s, e, c] = await Promise.all([
      db.medicines.toArray(),
      db.sales.orderBy('timestamp').reverse().toArray(),
      db.expenses.orderBy('timestamp').reverse().toArray(),
      db.customers.toArray()
    ]);
    setMedicines(m);
    setSalesHistory(s);
    setExpenses(e);
    setSavedCustomers(c);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Alert Metrics
  const alerts = useMemo(() => {
    const now = new Date().getTime();
    const lowStock = medicines.filter(m => m.stock <= 5 && m.stock > 0).length;
    const expired = medicines.filter(m => new Date(m.expiryDate).getTime() < now).length;
    const nearExpiry = medicines.filter(m => {
      const diff = new Date(m.expiryDate).getTime() - now;
      return diff > 0 && diff < (30 * 24 * 60 * 60 * 1000); // 30 days
    }).length;
    return { lowStock, expired, nearExpiry, total: lowStock + expired + nearExpiry };
  }, [medicines]);

  // Dynamic Lists
  const categories = useMemo(() => ['الكل', ...Array.from(new Set(medicines.map(m => m.category))).filter(Boolean)], [medicines]);
  const suppliers = useMemo(() => ['الكل', ...Array.from(new Set(medicines.map(m => m.supplier))).filter(Boolean)], [medicines]);
  const expenseTypes = useMemo(() => Array.from(new Set(expenses.map(e => e.type))), [expenses]);

  const posItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return medicines
      .filter(m => (m.name.toLowerCase().includes(q) || m.barcode.includes(q)) && (activeCategory === 'الكل' || m.category === activeCategory))
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }, [medicines, searchQuery, activeCategory]);

  const filteredInventory = useMemo(() => {
    const now = Date.now();
    return medicines.filter(m => {
      let stockMatch = true;
      if (invStockFilter === 'low') stockMatch = m.stock <= 5 && m.stock > 0;
      if (invStockFilter === 'out') stockMatch = m.stock <= 0;

      let expiryMatch = true;
      if (invExpiryFilter === 'expired') expiryMatch = new Date(m.expiryDate).getTime() < now;
      if (invExpiryFilter === 'near') {
        const diff = new Date(m.expiryDate).getTime() - now;
        expiryMatch = diff > 0 && diff < (30 * 24 * 60 * 60 * 1000);
      }

      const supplierMatch = selectedSupplier === 'الكل' || m.supplier === selectedSupplier;
      const categoryMatch = activeCategory === 'الكل' || m.category === activeCategory;

      return stockMatch && expiryMatch && supplierMatch && categoryMatch;
    });
  }, [medicines, invStockFilter, invExpiryFilter, selectedSupplier, activeCategory]);

  const inventoryStats = useMemo(() => {
    return filteredInventory.reduce((acc, m) => {
      acc.totalCost += m.stock * m.costPrice;
      acc.totalSell += m.stock * m.price;
      return acc;
    }, { totalCost: 0, totalSell: 0 });
  }, [filteredInventory]);

  const financialSummary = useMemo(() => {
    const filtered = salesHistory.filter(s => {
      if (payFilter === 'all') return true;
      if (payFilter === 'cash') return s.cashAmount > 0 && s.bankAmount === 0;
      if (payFilter === 'bank') return s.bankAmount > 0;
      if (payFilter === 'debt') return s.debtAmount > 0;
      return true;
    });
    
    const totals = filtered.reduce((acc, s) => {
      if (!s.isReturned) {
        acc.sales += s.netAmount;
        acc.costs += s.totalCost;
        acc.profit += s.profit;
        acc.cash += s.cashAmount;
        acc.bank += s.bankAmount;
        acc.debt += s.debtAmount;
      }
      return acc;
    }, { sales: 0, costs: 0, profit: 0, cash: 0, bank: 0, debt: 0 });

    return { ...totals, list: filtered };
  }, [salesHistory, payFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => new Date(e.timestamp).toISOString().split('T')[0] === expenseDateFilter);
  }, [expenses, expenseDateFilter]);

  // Actions
  const addToCart = (m: Medicine) => {
    if (m.stock <= 0) return;
    const newCart = new Map(cart);
    const item = newCart.get(m.id!) || { medicine: m, quantity: 0 };
    if (item.quantity < m.stock) {
      newCart.set(m.id!, { ...item, quantity: item.quantity + 1 });
      setCart(newCart);
    }
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
    const disc = parseFloat(payData.discount) || 0;
    const net = cartTotal - disc;
    const cash = parseFloat(payData.cash) || 0;
    const bank = parseFloat(payData.bank) || 0;
    const debt = parseFloat(payData.debt) || 0;
    
    if (Math.abs((cash + bank + debt) - net) > 0.1) {
      alert("خطأ: المبالغ الموزعة غير مطابقة للصافي."); return;
    }

    const items = Array.from(cart.values());
    const totalCost = items.reduce((s, i) => s + (i.medicine.costPrice * i.quantity), 0);

    await db.transaction('rw', [db.medicines, db.sales, db.customers], async () => {
      
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
        discount: disc,
        netAmount: net,
        cashAmount: cash,
        bankAmount: bank,
        debtAmount: debt,
        bankTrxId: payData.trx,
        customerName: payData.cust,
        totalCost,
        profit: net - totalCost,
        timestamp: Date.now(),
        itemsJson: JSON.stringify(items)
      });
    });

    // مزامنة مع Supabase (بعد الحفظ المحلي بنجاح)
    try {
      // تحضير بيانات البيع (تشمل: اسم المنتج، السعر، الكمية، والتاريخ في items_json و timestamp)
      const saleData = {
        total_amount: cartTotal,
        discount: disc,
        net_amount: net,
        cash_amount: cash,
        bank_amount: bank,
        debt_amount: debt,
        bank_trx_id: payData.trx || null,
        customer_name: payData.cust || null,
        total_cost: totalCost,
        profit: net - totalCost,
        timestamp: new Date().toISOString(), // التاريخ
        items_json: JSON.stringify(items.map(item => ({
          product_name: item.medicine.name, // اسم المنتج
          price: item.medicine.price,       // السعر
          quantity: item.quantity          // الكمية
        }))) // items_json يحتوي على: اسم المنتج، السعر، الكمية
      };

      // إرسال البيانات إلى Supabase
      const { error: saleError } = await supabase
        .from('sales')
        .insert([saleData]);

      if (saleError) {
        console.log('فشل الاتصال - تم الحفظ محلياً فقط');
        console.error('خطأ في مزامنة بيانات البيع مع Supabase:', saleError);
      } else {
        console.log('تمت المزامنة مع السحاب');
      }

      // 2. تحديث المخزون (خصم الكمية المباعة)
      for (const item of items) {
        const { error: inventoryError } = await supabase
          .rpc('decrement_inventory', {
            product_name: item.medicine.name,
            quantity_to_deduct: item.quantity
          });

        // إذا فشلت RPC، جرب update مباشرة
        if (inventoryError) {
          // البحث عن المنتج في جدول inventory
          const { data: inventoryItem, error: fetchError } = await supabase
            .from('inventory')
            .select('id, stock')
            .eq('name', item.medicine.name)
            .single();

          if (!fetchError && inventoryItem) {
            const { error: updateError } = await supabase
              .from('inventory')
              .update({ stock: inventoryItem.stock - item.quantity })
              .eq('id', inventoryItem.id);

            if (updateError) {
              console.error(`خطأ في تحديث مخزون ${item.medicine.name}:`, updateError);
            }
          } else {
            console.error(`لم يتم العثور على المنتج ${item.medicine.name} في المخزون السحابي:`, fetchError);
          }
        }
      }
    } catch (error) {
      // في حالة فشل الاتصال بالسحابة، نكتفي بطباعة الخطأ ونستمر في العمل المحلي
      console.log('فشل الاتصال - تم الحفظ محلياً فقط');
      console.error('خطأ في الاتصال مع Supabase (سيستمر العمل محلياً):', error);
    }

    setCart(new Map());
    setIsCheckoutOpen(false);
    loadData();
  };

  const handleReturn = async (sale: Sale) => {
    if (!confirm("تأكيد إرجاع هذه العملية؟")) return;
    await db.transaction('rw', [db.medicines, db.sales], async () => {
      const items = JSON.parse(sale.itemsJson);
      for (const item of items) {
        const m = await db.medicines.get(item.medicine.id);
        if (m) await db.medicines.update(m.id!, { stock: m.stock + item.quantity });
      }
      await db.sales.update(sale.id!, { isReturned: true });
    });
    loadData();
  };

  const inlineUpdate = async (id: number, field: string, val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n)) {
      await db.medicines.update(id, { [field]: n });
      loadData();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-medium">
      {/* Header PRO */}
      <header className="bg-white px-6 pt-10 pb-4 shadow-sm z-30 border-b border-slate-100 shrink-0">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                <Layers size={24} />
             </div>
             <div>
                <h1 className="text-xl font-black text-slate-800 tracking-tight">راحة <span className="text-emerald-600">PRO</span></h1>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">إدارة فائقة الذكاء</p>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            {alerts.total > 0 && (
              <div onClick={() => { setView('inventory'); setInvStockFilter('low'); }} className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-2xl text-[10px] font-black cursor-pointer animate-pulse">
                <Bell size={14} /> تنبيهات: {alerts.total}
              </div>
            )}
            <button onClick={() => setView('pos')} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all"><ShoppingCart size={20}/></button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {['pos', 'inventory', 'accounting', 'expenses'].map((v) => (
            <button key={v} onClick={() => { setView(v as ViewType); setActiveCategory('الكل'); }} className={`px-6 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${view === v ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>
              {v === 'pos' ? 'نقطة البيع' : v === 'inventory' ? 'المخزن' : v === 'accounting' ? 'التقارير' : 'المنصرفات'}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto p-4 pb-48 no-scrollbar">
        {view === 'pos' && (
          <div className="animate-in fade-in duration-300">
            <div className="relative mb-4">
              <input type="text" placeholder="ابحث باسم الصنف أو الباركود..." className="w-full bg-white rounded-3xl py-4 pr-12 pl-4 text-lg font-bold shadow-sm border-2 border-transparent focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
            </div>
            
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
              {categories.map(c => (
                <button key={c} onClick={() => setActiveCategory(c)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all ${activeCategory === c ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-400 shadow-sm border border-slate-50'}`}>{c}</button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {posItems.map(m => (
                <div key={m.id} onClick={() => addToCart(m)} className={`p-5 rounded-[35px] bg-white border-2 flex justify-between items-center transition-all active:scale-95 ${cart.has(m.id!) ? 'border-emerald-500 bg-emerald-50/20' : 'border-transparent shadow-sm'}`}>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{m.name}</h3>
                    <div className="text-[10px] font-black mt-1 flex items-center gap-2">
                       <span className={`${m.stock <= 5 ? 'text-rose-500' : 'text-emerald-600'}`}>متاح: {m.stock}</span>
                       <span className="text-slate-300">|</span>
                       <span className="text-slate-400">{m.category}</span>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-xl font-black text-emerald-700">{m.price.toFixed(2)}</div>
                    {cart.has(m.id!) && (
                      <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => removeFromCart(m.id!)} className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><Minus size={14}/></button>
                        <span className="text-sm font-black text-slate-700">{cart.get(m.id!)?.quantity}</span>
                        <button onClick={() => addToCart(m)} className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><Plus size={14}/></button>
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
            {/* Header Value Summary */}
            <div className="grid grid-cols-2 gap-3 mb-6">
               <div className="bg-emerald-600 p-6 rounded-[35px] text-white shadow-xl shadow-emerald-100 flex flex-col">
                  <span className="text-[10px] font-black opacity-70 uppercase mb-1">قيمة المخزون (بيع)</span>
                  <span className="text-2xl font-black tabular-nums">{inventoryStats.totalSell.toLocaleString()}</span>
               </div>
               <div className="bg-slate-800 p-6 rounded-[35px] text-white shadow-xl flex flex-col">
                  <span className="text-[10px] font-black opacity-70 uppercase mb-1">رأس المال (تكلفة)</span>
                  <span className="text-2xl font-black tabular-nums">{inventoryStats.totalCost.toLocaleString()}</span>
               </div>
            </div>

            <div className="bg-white p-5 rounded-[35px] shadow-sm border border-slate-100 space-y-4">
              <div className="flex flex-wrap gap-2">
                <select className="bg-slate-50 p-3 rounded-2xl text-[10px] font-black outline-none border border-slate-100" value={invStockFilter} onChange={e => setInvStockFilter(e.target.value as any)}>
                  <option value="all">كل المخزون</option>
                  <option value="low">النواقص فقط</option>
                  <option value="out">المنتهي كمياً</option>
                </select>
                <select className="bg-slate-50 p-3 rounded-2xl text-[10px] font-black outline-none border border-slate-100" value={invExpiryFilter} onChange={e => setInvExpiryFilter(e.target.value as any)}>
                  <option value="all">كل التواريخ</option>
                  <option value="expired">منتهي الصلاحية</option>
                  <option value="near">قريب الانتهاء</option>
                </select>
                <select className="bg-slate-50 p-3 rounded-2xl text-[10px] font-black outline-none border border-slate-100" value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="bg-slate-50 p-3 rounded-2xl text-[10px] font-black outline-none border border-slate-100" value={activeCategory} onChange={e => setActiveCategory(e.target.value)}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="p-4">الصنف</th>
                      <th className="p-4">المخزون</th>
                      <th className="p-4">الأسعار</th>
                      <th className="p-4">الصلاحية</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredInventory.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                           <div className="font-bold text-slate-800 text-sm">{m.name}</div>
                           <div className="text-[9px] text-slate-300">{m.supplier}</div>
                        </td>
                        <td className="p-4">
                           <span className={`px-2 py-1 rounded-lg font-black ${m.stock <= 5 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>{m.stock}</span>
                        </td>
                        <td className="p-4">
                           <div className="flex flex-col gap-1">
                              <input type="number" onFocus={e => e.target.select()} className="w-16 bg-emerald-50 text-emerald-700 font-black rounded px-1.5 py-0.5 outline-none" defaultValue={m.price} onBlur={e => inlineUpdate(m.id!, 'price', e.target.value)} />
                              <input type="number" onFocus={e => e.target.select()} className="w-16 bg-slate-50 text-slate-400 font-bold rounded px-1.5 py-0.5 outline-none" defaultValue={m.costPrice} onBlur={e => inlineUpdate(m.id!, 'costPrice', e.target.value)} />
                           </div>
                        </td>
                        <td className="p-4 font-bold text-slate-400 whitespace-nowrap">{m.expiryDate}</td>
                        <td className="p-4">
                           <button onClick={() => { setEditingMed(m); setIsEditOpen(true); }} className="p-2 text-slate-300 hover:text-emerald-500"><Edit3 size={16}/></button>
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
             {/* Financial Dashboard */}
             <div className="bg-slate-900 p-8 rounded-[45px] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10 space-y-6">
                   <div className="flex justify-between items-start">
                      <div>
                         <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">إجمالي الربح الصافي</span>
                         <h2 className="text-4xl font-black tabular-nums mt-1">{financialSummary.profit.toLocaleString()} <span className="text-xs font-normal opacity-50">ج.م</span></h2>
                      </div>
                      <div className="p-3 bg-white/10 rounded-2xl"><TrendingUp size={28} className="text-emerald-400"/></div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-6">
                      <div>
                         <span className="text-[10px] font-bold text-slate-400 uppercase">إجمالي المبيعات</span>
                         <div className="text-xl font-black">{financialSummary.sales.toLocaleString()}</div>
                      </div>
                      <div>
                         <span className="text-[10px] font-bold text-slate-400 uppercase">إجمالي التكلفة</span>
                         <div className="text-xl font-black">{financialSummary.costs.toLocaleString()}</div>
                      </div>
                   </div>

                   <div className="flex gap-3 overflow-x-auto no-scrollbar pt-2">
                      <div className="flex-1 bg-white/5 p-3 rounded-2xl text-center">
                         <div className="text-[8px] font-black text-emerald-400">نقدي</div>
                         <div className="text-sm font-black">{financialSummary.cash.toLocaleString()}</div>
                      </div>
                      <div className="flex-1 bg-white/5 p-3 rounded-2xl text-center">
                         <div className="text-[8px] font-black text-blue-400">بنكك</div>
                         <div className="text-sm font-black">{financialSummary.bank.toLocaleString()}</div>
                      </div>
                      <div className="flex-1 bg-white/5 p-3 rounded-2xl text-center">
                         <div className="text-[8px] font-black text-amber-400">مديونية</div>
                         <div className="text-sm font-black">{financialSummary.debt.toLocaleString()}</div>
                      </div>
                   </div>
                </div>
             </div>

             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {['all', 'cash', 'bank', 'debt'].map(f => (
                   <button key={f} onClick={() => setPayFilter(f as any)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all ${payFilter === f ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
                      {f === 'all' ? 'كل العمليات' : f === 'cash' ? 'كاش صافي' : f === 'bank' ? 'بنكك' : 'مديونيات'}
                   </button>
                ))}
             </div>

             <div className="space-y-3">
                {financialSummary.list.map(s => (
                   <div key={s.id} className={`p-6 rounded-[35px] bg-white border border-slate-100 shadow-sm flex flex-col gap-4 ${s.isReturned ? 'opacity-40 grayscale' : ''}`}>
                      <div className="flex justify-between items-start">
                         <div>
                            <div className="text-xl font-black text-slate-800 tabular-nums">{s.netAmount.toFixed(2)} ج.م</div>
                            <div className="text-[9px] font-bold text-slate-400">{new Date(s.timestamp).toLocaleString('ar-EG')}</div>
                         </div>
                         <div className="flex gap-2">
                            {s.cashAmount > 0 && <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Wallet size={16}/></div>}
                            {s.bankAmount > 0 && <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><CreditCard size={16}/></div>}
                            {s.debtAmount > 0 && <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><UserMinus size={16}/></div>}
                         </div>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                         <div className="text-[10px] font-bold text-slate-500 flex items-center gap-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-slate-600">{s.customerName || 'زبون عام'}</span>
                            {s.bankTrxId && <span className="bg-blue-50 px-2 py-0.5 rounded-lg text-blue-600">#{s.bankTrxId}</span>}
                         </div>
                         {!s.isReturned && (
                            <button onClick={() => handleReturn(s)} className="text-[10px] font-black text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-xl transition-all">إرجاع</button>
                         )}
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {view === 'expenses' && (
           <div className="space-y-6 animate-in slide-in-from-right duration-300">
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                 <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><ArrowUpRight className="text-rose-500"/> إضافة منصرف</h2>
                 <form onSubmit={async (e) => {
                   e.preventDefault();
                   const form = e.target as any;
                   await db.expenses.add({
                     amount: parseFloat(form.amt.value) || 0,
                     type: form.typ.value,
                     description: form.dsc.value,
                     timestamp: Date.now()
                   });
                   form.reset(); loadData();
                 }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                       <input name="amt" type="number" step="0.01" onFocus={e => e.target.select()} placeholder="المبلغ" required className="bg-slate-50 p-4 rounded-3xl font-black outline-none border-2 border-transparent focus:border-emerald-500" />
                       <input name="typ" list="exp-types" placeholder="نوع المنصرف" required className="bg-slate-50 p-4 rounded-3xl font-black outline-none" />
                       <datalist id="exp-types">{expenseTypes.map(t => <option key={t} value={t}/>)}</datalist>
                    </div>
                    <input name="dsc" type="text" placeholder="الوصف (اختياري)" className="w-full bg-slate-50 p-4 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" />
                    <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black shadow-lg active:scale-95 transition-all">تثبيت المنصرف</button>
                 </form>
              </div>

              <div className="flex items-center gap-4 px-2">
                 <div className="flex-grow h-px bg-slate-100"></div>
                 <input type="date" className="bg-white px-4 py-2 rounded-xl text-xs font-black border border-slate-100 outline-none shadow-sm" value={expenseDateFilter} onChange={e => setExpenseDateFilter(e.target.value)} />
                 <div className="flex-grow h-px bg-slate-100"></div>
              </div>

              <div className="space-y-3">
                 {filteredExpenses.map(e => (
                   <div key={e.id} className="p-6 rounded-[35px] bg-white border border-slate-100 flex justify-between items-center shadow-sm">
                      <div>
                         <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest">{e.type}</div>
                         <div className="font-bold text-slate-800 text-sm mt-1">{e.description || 'منصرف عام'}</div>
                      </div>
                      <div className="text-xl font-black text-rose-600 tabular-nums">-{e.amount.toFixed(2)}</div>
                   </div>
                 ))}
                 {filteredExpenses.length === 0 && (
                   <div className="text-center py-12 text-slate-300 font-bold">لا توجد منصرفات في هذا التاريخ</div>
                 )}
              </div>
           </div>
        )}
      </main>

      {/* Floating UI Elements */}
      {view === 'pos' && cart.size > 0 && (
         <div className="fixed bottom-28 left-0 right-0 px-6 z-40 animate-in slide-in-from-bottom duration-500">
            <div className="max-w-xl mx-auto bg-slate-900 text-white p-6 rounded-[40px] shadow-2xl flex items-center justify-between border border-white/10">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-3xl bg-emerald-600 flex items-center justify-center text-white font-black text-xl shadow-lg">{Array.from(cart.values()).reduce((s,i)=>s+i.quantity,0)}</div>
                  <div>
                    <div className="text-2xl font-black tabular-nums">{Array.from(cart.values()).reduce((s,i)=>s+(i.medicine.price*i.quantity),0).toFixed(2)} <span className="text-[10px] opacity-50">ج.م</span></div>
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">إجمالي السلة</div>
                  </div>
               </div>
               <button onClick={() => {
                 const total = Array.from(cart.values()).reduce((s,i)=>s+(i.medicine.price*i.quantity),0);
                 setPayData({ discount: '', cash: total.toString(), bank: '', debt: '', trx: '', cust: '' });
                 setIsCheckoutOpen(true);
               }} className="bg-white text-slate-900 px-8 py-4 rounded-3xl font-black flex items-center gap-2 active:scale-95 transition-all shadow-xl">إتمام <ArrowRight size={20} /></button>
            </div>
         </div>
      )}

      {/* Primary Add Button */}
      <button onClick={() => { setEditingMed(null); setIsEditOpen(true); }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-emerald-600 text-white w-20 h-20 rounded-[35px] shadow-2xl flex items-center justify-center active:scale-90 transition-all border-8 border-[#F8FAFC] z-50">
        <Plus size={36} strokeWidth={3} />
      </button>

      {/* Modern Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center px-4 pt-4 pb-12 z-30 shrink-0">
        <button onClick={() => setView('pos')} className={`flex flex-col items-center gap-1 transition-all ${view === 'pos' ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}> 
            <ShoppingCart size={24} strokeWidth={view === 'pos' ? 3 : 2} /> <span className="text-[10px] font-black uppercase">البيع</span> 
        </button>
        <div className="w-16"></div>
        <button onClick={() => setView('accounting')} className={`flex flex-col items-center gap-1 transition-all ${view === 'accounting' ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}> 
            <BarChart3 size={24} strokeWidth={view === 'accounting' ? 3 : 2} /> <span className="text-[10px] font-black uppercase">التقارير</span> 
        </button>
      </nav>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
           <div className="bg-white w-full max-w-lg rounded-t-[45px] sm:rounded-[50px] shadow-2xl flex flex-col max-h-[95vh] animate-in slide-in-from-bottom">
              <div className="p-10 pb-4 flex justify-between items-center">
                 <h2 className="text-3xl font-black text-slate-800">إتمام البيع</h2>
                 <button onClick={() => setIsCheckoutOpen(false)} className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all"><X/></button>
              </div>
              <div className="p-10 pt-4 space-y-6 overflow-y-auto no-scrollbar pb-16">
                 <div className="bg-emerald-50 p-8 rounded-[40px] border border-emerald-100 flex justify-between items-center shadow-inner">
                    <div>
                       <div className="text-[10px] font-black text-emerald-600 opacity-60 uppercase tracking-widest">المبلغ المطلوب سداده</div>
                       <div className="text-4xl font-black text-emerald-700 tabular-nums">
                         {(Array.from(cart.values()).reduce((s,i)=>s+(i.medicine.price*i.quantity),0) - (parseFloat(payData.discount)||0)).toFixed(2)}
                       </div>
                    </div>
                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-emerald-600 shadow-sm"><Receipt size={32} /></div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-tighter">الخصم</label>
                      <input type="number" onFocus={e => e.target.select()} className="w-full bg-slate-50 p-4 rounded-3xl font-black text-lg outline-none border-2 border-transparent focus:border-emerald-500 transition-all" value={payData.discount} onChange={e => setPayData({...payData, discount: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-emerald-500 mr-2 uppercase tracking-tighter">نقداً (كاش)</label>
                      <input type="number" onFocus={e => e.target.select()} className="w-full bg-emerald-50/30 p-4 rounded-3xl font-black text-lg outline-none border-2 border-emerald-100 focus:border-emerald-500 transition-all" value={payData.cash} onChange={e => setPayData({...payData, cash: e.target.value})} />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-blue-500 mr-2 uppercase tracking-tighter">بنكك</label>
                      <input type="number" onFocus={e => e.target.select()} className="w-full bg-blue-50/30 p-4 rounded-3xl font-black text-lg outline-none border-2 border-blue-100 focus:border-blue-500 transition-all" value={payData.bank} onChange={e => setPayData({...payData, bank: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-amber-600 mr-2 uppercase tracking-tighter">آجل (مديونية)</label>
                      <input type="number" onFocus={e => e.target.select()} className="w-full bg-amber-50/30 p-4 rounded-3xl font-black text-lg outline-none border-2 border-amber-100 focus:border-amber-500 transition-all" value={payData.debt} onChange={e => setPayData({...payData, debt: e.target.value})} />
                    </div>
                 </div>

                 {parseFloat(payData.bank) > 0 && (
                   <div className="animate-in zoom-in duration-300">
                     <label className="text-[10px] font-black text-blue-400 mr-2">رقم العملية البنكية</label>
                     <input type="text" placeholder="أدخل رقم العملية..." className="w-full bg-blue-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-blue-100 focus:border-blue-500" value={payData.trx} onChange={e => setPayData({...payData, trx: e.target.value})} />
                   </div>
                 )}

                 {parseFloat(payData.debt) > 0 && (
                   <div className="animate-in slide-in-from-top duration-300">
                     <label className="text-[10px] font-black text-amber-500 mr-2">اسم صاحب الدين</label>
                     <input list="cust-list" type="text" placeholder="اختر من القائمة أو أضف جديداً..." className="w-full bg-amber-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-amber-100 focus:border-amber-500" value={payData.cust} onChange={e => setPayData({...payData, cust: e.target.value})} />
                     <datalist id="cust-list">{savedCustomers.map(c => <option key={c.id} value={c.name} />)}</datalist>
                   </div>
                 )}

                 <button onClick={handleSale} className="w-full bg-slate-900 text-white py-6 rounded-[35px] font-black text-xl shadow-2xl active:scale-95 transition-all mt-6 flex items-center justify-center gap-3">
                   <CheckCircle2 size={24}/> تثبيت وطباعة الفاتورة
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Modern Add/Edit Medicine Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
           <div className="bg-white w-full max-w-lg rounded-t-[45px] sm:rounded-[50px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom">
              <div className="p-10 pb-4 flex justify-between items-center">
                 <h2 className="text-2xl font-black text-slate-800">{editingMed ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد لـ راحة'}</h2>
                 <button onClick={() => setIsEditOpen(false)} className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center"><X/></button>
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
                setIsEditOpen(false); loadData();
              }} className="p-10 pt-4 space-y-5 overflow-y-auto no-scrollbar pb-16">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 mr-2 flex items-center gap-1"><Info size={12}/> اسم المنتج</label>
                   <input name="nm" type="text" defaultValue={editingMed?.name} required className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500 transition-all" />
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
                      <label className="text-[10px] font-black text-slate-400 mr-2">التصنيف</label>
                      <input name="ct" list="cat-list-edit" defaultValue={editingMed?.category} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none" />
                      <datalist id="cat-list-edit">{categories.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 mr-2">المورد</label>
                      <input name="sp" list="sup-list-edit" defaultValue={editingMed?.supplier} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none" />
                      <datalist id="sup-list-edit">{suppliers.map(s => <option key={s} value={s} />)}</datalist>
                    </div>
                    <div className="space-y-1 relative group">
                      <label className="text-[10px] font-black text-rose-500 mr-2 flex items-center gap-1"><Calendar size={12}/> تاريخ الصلاحية</label>
                      <input name="ex" type="date" defaultValue={editingMed?.expiryDate || '2026-01-01'} required className="w-full bg-rose-50/20 p-5 rounded-3xl font-bold outline-none border-2 border-rose-50 focus:border-rose-400 transition-all appearance-none text-rose-700" />
                    </div>
                 </div>

                 <input name="bc" type="text" placeholder="الباركود (إن وجد)" defaultValue={editingMed?.barcode} className="w-full bg-slate-50 p-5 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" />
                 
                 <div className="flex gap-3 pt-6">
                   <button type="submit" className="flex-grow bg-emerald-600 text-white py-6 rounded-[35px] font-black text-xl shadow-xl active:scale-95 transition-all">حفظ البيانات</button>
                   {editingMed?.id && (
                     <button type="button" onClick={async () => { if(confirm('حذف هذا المنتج نهائياً من المخزن؟')) { await db.medicines.delete(editingMed.id!); setIsEditOpen(false); loadData(); }}} className="bg-rose-50 text-rose-500 px-8 rounded-[35px] hover:bg-rose-100 transition-all shadow-sm"><Trash2 size={24}/></button>
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
