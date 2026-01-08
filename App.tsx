
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Search, Plus, Package, BarChart3, ShoppingCart, X, Trash2, 
  CheckCircle2, History, TrendingUp, AlertCircle, Filter, 
  Calendar, Tag, Coins, CreditCard, Wallet, UserMinus, 
  ChevronLeft, Printer, ShoppingBag, ArrowRight
} from 'lucide-react';
import { db } from './db';
import { Medicine, ViewType, Sale, CartItem, PaymentMethod } from './types';

const formatDate = (date: string) => new Date(date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('pos');
  const [accountingSubView, setAccountingSubView] = useState<'sales' | 'inventory'>('sales');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<Map<number, CartItem>>(new Map<number, CartItem>());
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<{status: 'success' | 'error', msg: string, saleId?: number} | null>(null);
  
  // Inventory Filters
  const [invCategoryFilter, setInvCategoryFilter] = useState<string>('all');
  const [invStockFilter, setInvStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [invExpiryFilter, setInvExpiryFilter] = useState<'all' | 'soon' | 'expired'>('all');

  // Sales Filters
  const [salesDateFilter, setSalesDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<'all' | PaymentMethod>('all');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const [allMeds, allSales] = await Promise.all([
      db.medicines.reverse().toArray(),
      db.sales.orderBy('timestamp').reverse().toArray()
    ]);
    setMedicines(allMeds);
    setSalesHistory(allSales);
  }, []);

  useEffect(() => {
    loadData();
    if (searchInputRef.current) searchInputRef.current.focus();
  }, [loadData]);

  const addToCart = (med: Medicine) => {
    if (med.id === undefined) return;
    if (med.stock <= 0) {
      setCheckoutResult({status: 'error', msg: 'هذا الصنف غير متوفر حالياً'});
      setTimeout(() => setCheckoutResult(null), 2000);
      return;
    }
    const newCart = new Map<number, CartItem>(cart);
    const existing = newCart.get(med.id);
    const currentQty = existing?.quantity || 0;

    if (currentQty >= med.stock) {
        setCheckoutResult({status: 'error', msg: 'تم الوصول للحد الأقصى للمخزون'});
        setTimeout(() => setCheckoutResult(null), 2000);
        return;
    }
    newCart.set(med.id, { medicine: med, quantity: currentQty + 1 });
    setCart(newCart);
    if (navigator.vibrate) navigator.vibrate([20]);
  };

  const removeFromCart = (id: number) => {
    // Fix: Explicitly typing the new Map to ensure 'item' is recognized as CartItem | undefined
    const newCart = new Map<number, CartItem>(cart);
    const item = newCart.get(id);
    if (item && item.quantity > 1) {
      newCart.set(id, { ...item, quantity: item.quantity - 1 });
    } else {
      newCart.delete(id);
    }
    setCart(newCart);
  };

  const handleCheckout = async () => {
    if (cart.size === 0) return;
    try {
      const items: CartItem[] = Array.from(cart.values());
      const totalAmount = items.reduce((sum, item) => sum + (item.medicine.price * item.quantity), 0);
      const totalCost = items.reduce((sum, item) => sum + (item.medicine.costPrice * item.quantity), 0);
      
      // Fix: db.transaction is available on the PharmacyDB instance because it extends Dexie correctly now.
      const saleId = await db.transaction('rw', [db.medicines, db.sales], async () => {
        for (const item of items) {
          const currentMed = await db.medicines.get(item.medicine.id!);
          if (!currentMed || currentMed.stock < item.quantity) throw new Error(`نقص مخزون ${item.medicine.name}`);
          await db.medicines.update(item.medicine.id!, { stock: currentMed.stock - item.quantity });
        }
        return await db.sales.add({
          totalAmount, totalCost, timestamp: Date.now(),
          paymentMethod: selectedPayment,
          itemsJson: JSON.stringify(items.map(i => ({ name: i.medicine.name, qty: i.quantity, price: i.medicine.price, cost: i.medicine.costPrice })))
        });
      });
      
      setCart(new Map());
      setCheckoutResult({status: 'success', msg: `تمت العملية بنجاح`, saleId});
      loadData();
    } catch (err: any) {
      setCheckoutResult({status: 'error', msg: err.message || 'فشلت العملية'});
    }
    setTimeout(() => setCheckoutResult(null), 4000);
  };

  const handlePrint = (saleId?: number) => {
    alert(`جاري محاكاة طباعة الفاتورة رقم: ${saleId || 'جديدة'}`);
  };

  const filteredInventory = useMemo(() => {
    const now = new Date();
    const soonThreshold = new Date(); soonThreshold.setMonth(now.getMonth() + 3);
    return medicines.filter(m => {
      const matchesCat = invCategoryFilter === 'all' || m.category === invCategoryFilter;
      const matchesStock = invStockFilter === 'all' || (invStockFilter === 'low' && m.stock > 0 && m.stock < 10) || (invStockFilter === 'out' && m.stock <= 0);
      const expDate = new Date(m.expiryDate);
      const matchesExp = invExpiryFilter === 'all' || (invExpiryFilter === 'soon' && expDate > now && expDate <= soonThreshold) || (invExpiryFilter === 'expired' && expDate <= now);
      return matchesCat && matchesStock && matchesExp;
    });
  }, [medicines, invCategoryFilter, invStockFilter, invExpiryFilter]);

  const filteredSales = useMemo(() => {
    return salesHistory.filter(s => {
      const sDate = new Date(s.timestamp).toISOString().split('T')[0];
      const matchesDate = !salesDateFilter || sDate === salesDateFilter;
      const matchesPayment = salesPaymentFilter === 'all' || s.paymentMethod === salesPaymentFilter;
      return matchesDate && matchesPayment;
    });
  }, [salesHistory, salesDateFilter, salesPaymentFilter]);

  const salesStats = useMemo(() => {
    const revenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const cost = filteredSales.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    return { revenue, profit: revenue - cost, count: filteredSales.length };
  }, [filteredSales]);

  const categories = useMemo(() => Array.from(new Set(medicines.map(m => m.category || 'عام'))), [medicines]);

  const medicinesForPOS = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return medicines.filter(m => m.name.toLowerCase().includes(q) || m.barcode.toLowerCase().includes(q));
  }, [medicines, searchQuery]);

  const handleSaveMedicine = async (data: Medicine) => {
    if (data.id) await db.medicines.update(data.id, data);
    else await db.medicines.add(data);
    setIsEditOpen(false); setEditingMedicine(null); loadData();
  };

  // Fix: Explicitly typing cartItemsArr to ensure properties are accessible in reduce()
  const cartItemsArr: CartItem[] = Array.from(cart.values());
  const cartTotal = cartItemsArr.reduce((sum, item: CartItem) => sum + (item.medicine.price * item.quantity), 0);

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden">
      {/* Dynamic Header */}
      <header className="bg-white px-6 pt-8 pb-6 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] z-20 shrink-0 border-b border-slate-100">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h1 className="text-2xl font-black text-emerald-600 tracking-tight">صيدلية الجلسة الواحدة</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ultra-Fast POS System</p>
            </div>
            <div className="flex gap-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <ShoppingBag size={20} />
                </div>
            </div>
        </div>
        <div className="relative group">
          <input 
            ref={searchInputRef} 
            type="text" 
            placeholder="ابحث عن دواء أو امسح الباركود..." 
            className="w-full bg-slate-50 text-slate-900 rounded-[22px] py-4 pr-14 pl-6 text-lg font-bold border-2 border-transparent focus:border-emerald-500 focus:bg-white transition-all shadow-sm outline-none" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={24} />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <X size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto p-4 pb-48 no-scrollbar">
        {view === 'pos' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {medicinesForPOS.map((med) => (
              <div 
                key={med.id} 
                onClick={() => addToCart(med)}
                onContextMenu={(e) => { e.preventDefault(); setEditingMedicine(med); setIsEditOpen(true); }}
                className={`group relative bg-white p-5 rounded-[28px] flex justify-between items-center active:scale-[0.96] transition-all shadow-[0_2px_10px_rgba(0,0,0,0.02)] border-2 ${cart.has(med.id!) ? 'border-emerald-500 bg-emerald-50/30' : 'border-transparent hover:border-slate-100'}`}
              >
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-slate-800 leading-tight">{med.name}</h3>
                    {cart.has(med.id!) && (
                      <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-in zoom-in">
                        {cart.get(med.id!)?.quantity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-tighter">{med.category}</span>
                    <span className={`text-[10px] font-black ${med.stock < 10 ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {med.stock <= 0 ? 'نفذ' : `متاح: ${med.stock}`}
                    </span>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xl font-black text-emerald-700">{med.price.toFixed(2)}</div>
                  <div className="text-[9px] font-black text-slate-300 uppercase">جنيهاً</div>
                </div>
                {/* Visual indicator for "added" */}
                {cart.has(med.id!) && <div className="absolute -top-1 -left-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-3xl shadow-sm border border-slate-100 sticky top-0 z-10">
              <button onClick={() => setAccountingSubView('sales')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[20px] text-sm font-bold transition-all ${accountingSubView === 'sales' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}> <History size={16} /> المبيعات </button>
              <button onClick={() => setAccountingSubView('inventory')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[20px] text-sm font-bold transition-all ${accountingSubView === 'inventory' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}> <Package size={16} /> المخزون </button>
            </div>

            {accountingSubView === 'sales' ? (
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100 grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-400 mr-2">تاريخ اليوم</label>
                      <input type="date" className="bg-slate-50 p-3 rounded-2xl font-bold text-sm border-2 border-transparent focus:border-emerald-500 outline-none w-full" value={salesDateFilter} onChange={e => setSalesDateFilter(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-400 mr-2">طريقة الدفع</label>
                      <select className="bg-slate-50 p-3 rounded-2xl font-bold text-sm border-2 border-transparent focus:border-emerald-500 outline-none w-full" value={salesPaymentFilter} onChange={e => setSalesPaymentFilter(e.target.value as any)}>
                        <option value="all">الكل</option>
                        <option value="cash">نقدي</option>
                        <option value="bank">فيزا/بنك</option>
                        <option value="credit">آجل</option>
                      </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-emerald-600 p-5 rounded-[32px] text-white shadow-emerald-200 shadow-xl">
                      <TrendingUp size={18} className="mb-2 opacity-80" />
                      <div className="text-2xl font-black">{salesStats.revenue.toLocaleString()}</div>
                      <div className="text-[10px] font-bold opacity-70">إجمالي البيع</div>
                   </div>
                   <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
                      <Coins size={18} className="mb-2 text-amber-500" />
                      <div className="text-2xl font-black text-slate-800">{salesStats.profit.toLocaleString()}</div>
                      <div className="text-[10px] font-bold text-slate-400">صافي الربح</div>
                   </div>
                </div>

                <div className="space-y-3">
                    {filteredSales.map(sale => (
                        <div key={sale.id} className="bg-white p-5 rounded-[28px] border border-slate-100 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-lg font-black text-slate-800">{sale.totalAmount.toFixed(2)} ج.م</div>
                                    <div className="text-[10px] text-slate-400 font-bold flex gap-2">
                                      <span>{formatTime(sale.timestamp)}</span>
                                      <span className="w-1 h-1 rounded-full bg-slate-200 mt-1.5"></span>
                                      <span className={sale.paymentMethod === 'cash' ? 'text-emerald-600' : 'text-blue-500'}>
                                        {sale.paymentMethod === 'cash' ? 'كاش' : sale.paymentMethod === 'bank' ? 'بنك' : 'آجل'}
                                      </span>
                                    </div>
                                </div>
                                <button onClick={() => handlePrint(sale.id)} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                                    <Printer size={18} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {JSON.parse(sale.itemsJson).map((i:any, idx:number) => (
                                    <span key={idx} className="bg-slate-50 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-100">
                                      {i.name} <span className="text-emerald-600">×{i.qty}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-[32px] border border-slate-100 space-y-4">
                  <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
                    <button onClick={() => setInvCategoryFilter('all')} className={`px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${invCategoryFilter === 'all' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 text-slate-500'}`}>الكل</button>
                    {categories.map(cat => (
                      <button key={cat} onClick={() => setInvCategoryFilter(cat)} className={`px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${invCategoryFilter === cat ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 text-slate-500'}`}>{cat}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select className="bg-slate-50 p-3 rounded-2xl font-bold text-xs outline-none border-2 border-transparent focus:border-emerald-500" value={invStockFilter} onChange={e => setInvStockFilter(e.target.value as any)}>
                      <option value="all">كل المخزون</option>
                      <option value="low">النواقص</option>
                      <option value="out">المنتهي</option>
                    </select>
                    <select className="bg-slate-50 p-3 rounded-2xl font-bold text-xs outline-none border-2 border-transparent focus:border-emerald-500" value={invExpiryFilter} onChange={e => setInvExpiryFilter(e.target.value as any)}>
                      <option value="all">كل الصلاحيات</option>
                      <option value="soon">قريب الإنتهاء</option>
                      <option value="expired">منتهي الصلاحية</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {filteredInventory.map(med => {
                    const isExpired = new Date(med.expiryDate) <= new Date();
                    const isLow = med.stock <= 5;
                    return (
                      <div key={med.id} onClick={() => { setEditingMedicine(med); setIsEditOpen(true); }} className="bg-white p-5 rounded-[28px] flex justify-between items-center shadow-sm border border-slate-100 hover:border-emerald-200 transition-all">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isExpired ? 'bg-rose-50 text-rose-500' : isLow ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                <Package size={20} />
                            </div>
                            <div>
                                <div className="font-bold text-slate-800">{med.name}</div>
                                <div className="text-[10px] text-slate-400 font-bold">
                                    تنتهي في: {new Date(med.expiryDate).toLocaleDateString('ar-EG')}
                                </div>
                            </div>
                        </div>
                        <div className="text-left">
                          <div className={`text-lg font-black ${med.stock < 5 ? 'text-rose-500' : 'text-slate-800'}`}>{med.stock}</div>
                          <div className="text-[8px] font-bold text-slate-300 uppercase">قطعة</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Checkout Bar */}
      {view === 'pos' && cart.size > 0 && (
        <div className="fixed bottom-28 left-0 right-0 px-6 z-50 animate-in slide-in-from-bottom duration-500">
            <div className="max-w-xl mx-auto bg-slate-900/90 backdrop-blur-xl text-white p-6 rounded-[35px] shadow-2xl border border-white/10">
                <div className="flex gap-2 mb-5">
                    <button onClick={() => setSelectedPayment('cash')} className={`flex-1 py-3 rounded-2xl text-[11px] font-black transition-all flex items-center justify-center gap-2 ${selectedPayment === 'cash' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}> <Wallet size={14}/> كاش </button>
                    <button onClick={() => setSelectedPayment('bank')} className={`flex-1 py-3 rounded-2xl text-[11px] font-black transition-all flex items-center justify-center gap-2 ${selectedPayment === 'bank' ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}> <CreditCard size={14}/> بنك </button>
                    <button onClick={() => setSelectedPayment('credit')} className={`flex-1 py-3 rounded-2xl text-[11px] font-black transition-all flex items-center justify-center gap-2 ${selectedPayment === 'credit' ? 'bg-amber-500 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}> <UserMinus size={14}/> آجل </button>
                </div>
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setCart(new Map())} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-rose-400 active:scale-90 transition-all"><Trash2 size={22} /></button>
                        <div>
                            {/* Fix: cartTotal is correctly typed as number */}
                            <div className="text-2xl font-black tabular-nums">{cartTotal.toFixed(2)} <span className="text-[10px] font-normal opacity-50">ج.م</span></div>
                            {/* Fix: Explicitly typing the reduce callback to avoid unknown error on i.quantity */}
                            <div className="text-[10px] font-bold text-emerald-400">{Array.from<CartItem>(cart.values()).reduce((s, i: CartItem) => s + i.quantity, 0)} أصناف مختارة</div>
                        </div>
                    </div>
                    <button onClick={handleCheckout} className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-[24px] font-black text-lg shadow-xl shadow-emerald-900/20 active:scale-95 transition-all flex items-center gap-2">
                      دفع الآن <ArrowRight size={20} />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Notifications */}
      {checkoutResult && (
        <div className={`fixed top-8 left-6 right-6 z-[100] p-5 rounded-[28px] shadow-2xl flex items-center justify-between animate-in slide-in-from-top-10 duration-500 ${checkoutResult.status === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          <div className="flex items-center gap-3">
            {checkoutResult.status === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            <span className="font-black">{checkoutResult.msg}</span>
          </div>
          {checkoutResult.status === 'success' && (
              <button onClick={() => handlePrint(checkoutResult.saleId)} className="bg-white/20 p-2 rounded-xl">
                  <Printer size={20} />
              </button>
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bg-white/80 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center px-4 pt-4 pb-10 z-40 shrink-0">
        <button onClick={() => setView('pos')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'pos' ? 'text-emerald-600' : 'text-slate-300'}`}> 
            <ShoppingCart size={26} strokeWidth={view === 'pos' ? 3 : 2} /> 
            <span className="text-[10px] font-black uppercase">البيع</span> 
        </button>
        
        <button onClick={() => { setEditingMedicine(null); setIsEditOpen(true); }} className="relative -mt-16 bg-emerald-600 text-white w-18 h-18 rounded-[28px] shadow-2xl shadow-emerald-200 flex items-center justify-center active:scale-90 transition-transform border-4 border-[#F8FAFC]">
            <Plus size={32} strokeWidth={3} />
        </button>
        
        <button onClick={() => setView('accounting')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'accounting' ? 'text-emerald-600' : 'text-slate-300'}`}> 
            <BarChart3 size={26} strokeWidth={view === 'accounting' ? 3 : 2} /> 
            <span className="text-[10px] font-black uppercase">التقارير</span> 
        </button>
      </nav>

      {/* Modals */}
      {isEditOpen && (
        <MedicineDialog categories={categories} initialData={editingMedicine} onSave={handleSaveMedicine} onClose={() => setIsEditOpen(false)} onDelete={async (id) => { if(confirm('حذف نهائي؟')) { await db.medicines.delete(id); setIsEditOpen(false); loadData(); } }} />
      )}
    </div>
  );
};

// Sub-component: Medicine Dialog
const MedicineDialog: React.FC<{ initialData: Medicine | null; categories: string[]; onSave: (data: Medicine) => void; onClose: () => void; onDelete: (id: number) => void; }> = ({ initialData, categories, onSave, onClose, onDelete }) => {
  const [formData, setFormData] = useState<Medicine>( initialData || { name: '', barcode: '', price: 0, costPrice: 0, stock: 0, category: 'عام', expiryDate: new Date().toISOString().split('T')[0] } );
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (nameRef.current) nameRef.current.focus(); }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[45px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 flex flex-col max-h-[95vh]">
        <div className="px-8 pt-10 pb-6 flex justify-between items-center shrink-0">
          <div>
              <h2 className="text-2xl font-black text-slate-800">{initialData ? 'تعديل بيانات' : 'إضافة صنف جديد'}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">تحديث بيانات المخزون</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center"><X size={20}/></button>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="px-8 pb-10 space-y-6 overflow-y-auto no-scrollbar">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">الاسم التجاري للدواء</label>
            <input ref={nameRef} type="text" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 font-bold focus:border-emerald-500 focus:bg-white outline-none transition-all" value={formData.name} required onChange={e => setFormData({...formData, name: e.target.value})}/>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">سعر البيع (للجمهور)</label>
              <input type="number" step="0.01" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 font-bold focus:border-emerald-500 outline-none" value={formData.price} required onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})}/>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">سعر التكلفة</label>
              <input type="number" step="0.01" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 font-bold focus:border-emerald-500 outline-none" value={formData.costPrice} required onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})}/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">الكمية الحالية</label>
                <input type="number" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 font-bold focus:border-emerald-500 outline-none" value={formData.stock} required onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})}/>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">الفئة</label>
                <input type="text" list="cats-dialog" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 font-bold focus:border-emerald-500 outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}/>
                <datalist id="cats-dialog">{categories.map(c => <option key={c} value={c}/>)}</datalist>
              </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">تاريخ الصلاحية</label>
            <input type="date" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 font-bold focus:border-emerald-500 outline-none" value={formData.expiryDate} required onChange={e => setFormData({...formData, expiryDate: e.target.value})}/>
          </div>

          <div className="flex gap-4 pt-4 shrink-0 pb-10">
            <button type="submit" className="flex-grow bg-emerald-600 text-white py-5 rounded-[22px] font-black text-xl shadow-xl shadow-emerald-100 active:scale-95 transition-all">حفظ البيانات</button>
            {initialData?.id && ( 
              <button type="button" onClick={() => onDelete(initialData.id!)} className="bg-rose-50 text-rose-500 w-16 rounded-[22px] flex items-center justify-center active:scale-95 transition-all border border-rose-100">
                <Trash2 size={24} />
              </button> 
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default App;
