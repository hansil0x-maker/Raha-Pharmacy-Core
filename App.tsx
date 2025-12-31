
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Plus, Package, BarChart3, ShoppingCart, X, Trash2, CheckCircle2, History, TrendingUp, AlertCircle, Filter, Calendar, Tag, Coins, CreditCard, Wallet, UserMinus, ChevronLeft } from 'lucide-react';
import { db } from './db';
import { Medicine, ViewType, Sale, CartItem, PaymentMethod } from './types';

const formatDate = (date: string) => new Date(date).toLocaleDateString('ar-EG');
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
  const [checkoutResult, setCheckoutResult] = useState<{status: 'success' | 'error', msg: string} | null>(null);
  
  // --- Inventory Filters State ---
  const [invCategoryFilter, setInvCategoryFilter] = useState<string>('all');
  const [invStockFilter, setInvStockFilter] = useState<'all' | 'low' | 'out'>('all'); // فلتر الكمية
  const [invExpiryFilter, setInvExpiryFilter] = useState<'all' | 'soon' | 'expired'>('all'); // فلتر الصلاحية

  // --- Sales Filters State ---
  const [salesDateFilter, setSalesDateFilter] = useState<string>(new Date().toISOString().split('T')[0]); // فلتر التاريخ
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<'all' | PaymentMethod>('all'); // فلتر النوع (كاش/بنك/آجل)
  
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
      setCheckoutResult({status: 'error', msg: 'عذراً، هذا الصنف نفذ من المخزن'});
      setTimeout(() => setCheckoutResult(null), 2000);
      return;
    }
    const newCart = new Map<number, CartItem>(cart);
    const existing = newCart.get(med.id);
    const currentQty = existing?.quantity || 0;

    if (currentQty >= med.stock) {
        setCheckoutResult({status: 'error', msg: 'الكمية المختارة تتجاوز المتاح'});
        setTimeout(() => setCheckoutResult(null), 2000);
        return;
    }
    newCart.set(med.id, { medicine: med, quantity: currentQty + 1 });
    setCart(newCart);
    if (navigator.vibrate) navigator.vibrate(40);
  };

  const clearCart = () => { if (confirm('مسح السلة؟')) setCart(new Map()); };

  const handleCheckout = async () => {
    if (cart.size === 0) return;
    try {
      const items: CartItem[] = Array.from(cart.values());
      const totalAmount: number = items.reduce<number>((sum, item: CartItem) => sum + (item.medicine.price * item.quantity), 0);
      const totalCost: number = items.reduce<number>((sum, item: CartItem) => sum + (item.medicine.costPrice * item.quantity), 0);
      
      // Fix: Removed unnecessary 'any' cast as db.transaction is a standard Dexie method
      await db.transaction('rw', [db.medicines, db.sales], async () => {
        for (const item of items) {
          const currentMed = await db.medicines.get(item.medicine.id!);
          if (!currentMed || currentMed.stock < item.quantity) throw new Error(`نقص مخزون ${item.medicine.name}`);
          await db.medicines.update(item.medicine.id!, { stock: currentMed.stock - item.quantity });
        }
        await db.sales.add({
          totalAmount, totalCost, timestamp: Date.now(),
          paymentMethod: selectedPayment,
          itemsJson: JSON.stringify(items.map(i => ({ name: i.medicine.name, qty: i.quantity, price: i.medicine.price, cost: i.medicine.costPrice })))
        });
      });
      setCart(new Map());
      setCheckoutResult({status: 'success', msg: `تم البيع (${selectedPayment === 'cash' ? 'كاش' : selectedPayment === 'bank' ? 'بنك' : 'آجل'})`});
      loadData();
    } catch (err: any) {
      setCheckoutResult({status: 'error', msg: err.message || 'خطأ غير متوقع'});
    }
    setTimeout(() => setCheckoutResult(null), 3000);
  };

  // --- Inventory Filtering Logic (Quantity, Expiry, Category) ---
  const filteredInventory = useMemo(() => {
    const now = new Date();
    const soonThreshold = new Date(); soonThreshold.setMonth(now.getMonth() + 3);

    return medicines.filter(m => {
      const matchesCat = invCategoryFilter === 'all' || m.category === invCategoryFilter;
      const matchesStock = invStockFilter === 'all' || 
                           (invStockFilter === 'low' && m.stock > 0 && m.stock < 10) || 
                           (invStockFilter === 'out' && m.stock <= 0);
      
      const expDate = new Date(m.expiryDate);
      const matchesExp = invExpiryFilter === 'all' || 
                         (invExpiryFilter === 'soon' && expDate > now && expDate <= soonThreshold) || 
                         (invExpiryFilter === 'expired' && expDate <= now);
      
      return matchesCat && matchesStock && matchesExp;
    });
  }, [medicines, invCategoryFilter, invStockFilter, invExpiryFilter]);

  // --- Sales Filtering Logic (Date, Type/Payment) ---
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

  // --- Medicine Handling (Unchanged Addition Method) ---
  const handleSaveMedicine = async (data: Medicine) => {
    if (data.id) await db.medicines.update(data.id, data);
    else await db.medicines.add(data);
    setIsEditOpen(false); setEditingMedicine(null); loadData();
  };

  const handleDeleteMedicine = async (id: number) => {
    if (confirm('حذف نهائي؟')) { await db.medicines.delete(id); setIsEditOpen(false); loadData(); }
  };

  const cartItemsArr: CartItem[] = Array.from(cart.values());
  const cartTotal = cartItemsArr.reduce<number>((sum, item: CartItem) => sum + (item.medicine.price * item.quantity), 0);
  const cartItemsCount = cartItemsArr.reduce<number>((sum, item: CartItem) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-emerald-50 text-emerald-950 select-none">
      <header className="bg-emerald-600 p-4 shadow-xl z-20 shrink-0">
        <div className="relative">
          <input ref={searchInputRef} type="text" placeholder="ابحث باسم الدواء أو الباركود..." className="w-full bg-white text-emerald-950 rounded-2xl py-4 px-12 text-lg font-bold shadow-inner focus:ring-4 focus:ring-emerald-300 transition-all border-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <Search className="absolute left-4 top-4.5 text-emerald-400" size={24} />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-4.5 text-gray-300"><X size={24} /></button>}
        </div>
      </header>

      <main className="flex-grow overflow-y-auto p-2 pb-40 no-scrollbar">
        {view === 'pos' ? (
          <div className="grid grid-cols-1 gap-2">
            {medicinesForPOS.map((med) => (
              <div key={med.id} onClick={() => addToCart(med)} onContextMenu={(e) => { e.preventDefault(); setEditingMedicine(med); setIsEditOpen(true); }} className={`bg-white border-2 ${cart.has(med.id!) ? 'border-emerald-500 bg-emerald-50' : 'border-transparent'} p-4 rounded-2xl flex justify-between items-center active:scale-[0.97] transition-all shadow-sm cursor-pointer`}>
                <div className="flex-grow">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-xl text-emerald-900">{med.name}</h3>
                    {cart.has(med.id!) && <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">× {cart.get(med.id!)?.quantity}</span>}
                  </div>
                  <div className="flex gap-4 mt-1 opacity-70">
                    <span className="text-xs font-bold bg-emerald-100 px-2 py-0.5 rounded-lg">{med.barcode || 'N/A'}</span>
                    <span className={`text-xs font-bold ${med.stock < 10 ? 'text-red-600' : 'text-emerald-700'}`}>المخزن: {med.stock}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-emerald-700">{med.price.toFixed(2)}</div>
                  <div className="text-[10px] font-bold text-emerald-400">ج.م</div>
                </div>
              </div>
            ))}
            {medicinesForPOS.length === 0 && (
                <div className="py-20 text-center opacity-30 flex flex-col items-center">
                    <Package size={80} />
                    <p className="text-xl font-bold mt-4">لا توجد أدوية بهذا الاسم</p>
                </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Sub-navigation */}
            <div className="flex bg-white p-1 rounded-2xl shadow-sm sticky top-0 z-10">
              <button onClick={() => setAccountingSubView('sales')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${accountingSubView === 'sales' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-600'}`}> <History size={18} /> المبيعات </button>
              <button onClick={() => setAccountingSubView('inventory')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${accountingSubView === 'inventory' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-600'}`}> <Package size={18} /> المخزون </button>
            </div>

            {accountingSubView === 'sales' ? (
              <div className="space-y-4">
                {/* --- Sales Filters: Date & Payment Type --- */}
                <div className="bg-white p-4 rounded-3xl shadow-sm space-y-3 border border-emerald-100">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1 px-1">
                    <Filter size={14} /> فلاتر المبيعات
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[9px] font-black text-emerald-600/60 mr-1 uppercase">التاريخ (يوم محدد)</label>
                      <input type="date" className="bg-emerald-50/50 p-3 rounded-xl font-bold text-xs border-2 border-emerald-50 outline-none w-full focus:border-emerald-500" value={salesDateFilter} onChange={e => setSalesDateFilter(e.target.value)} />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[9px] font-black text-emerald-600/60 mr-1 uppercase">النوع (طريقة الدفع)</label>
                      <select className="bg-emerald-50/50 p-3 rounded-xl font-bold text-xs border-2 border-emerald-50 outline-none w-full focus:border-emerald-500" value={salesPaymentFilter} onChange={e => setSalesPaymentFilter(e.target.value as any)}>
                        <option value="all">كل الطرق</option>
                        <option value="cash">كاش (نقدي)</option>
                        <option value="bank">بنك (شبكة)</option>
                        <option value="credit">آجل (دين)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-white p-4 rounded-3xl shadow-sm border-b-4 border-emerald-500">
                      <div className="flex items-center gap-1 text-emerald-600 mb-1 text-xs font-bold"> <TrendingUp size={14}/> المبيعات </div>
                      <div className="text-2xl font-black text-emerald-900">{salesStats.revenue.toFixed(2)}</div>
                   </div>
                   <div className="bg-white p-4 rounded-3xl shadow-sm border-b-4 border-amber-500">
                      <div className="flex items-center gap-1 text-amber-600 mb-1 text-xs font-bold"> <Coins size={14}/> صافي الربح </div>
                      <div className="text-2xl font-black text-emerald-900">{salesStats.profit.toFixed(2)}</div>
                   </div>
                </div>

                <div className="space-y-2">
                    {filteredSales.map(sale => (
                        <div key={sale.id} className="bg-white p-4 rounded-2xl shadow-sm border-r-4" style={{borderRightColor: sale.paymentMethod === 'cash' ? '#10b981' : sale.paymentMethod === 'bank' ? '#3b82f6' : '#f59e0b'}}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-black text-lg text-emerald-900">{sale.totalAmount.toFixed(2)} ج.م</div>
                                    <div className="text-[10px] text-emerald-500 font-bold">
                                      {formatTime(sale.timestamp)} • 
                                      <span className="mx-1">{sale.paymentMethod === 'cash' ? 'كاش' : sale.paymentMethod === 'bank' ? 'بنك' : 'آجل'}</span>
                                    </div>
                                </div>
                                <div className="text-[10px] font-bold bg-emerald-50 px-2 py-1 rounded-lg text-emerald-700">{formatDate(new Date(sale.timestamp).toISOString())}</div>
                            </div>
                            {/* تفاصيل ماذا بيع وكم بيع */}
                            <div className="text-[11px] text-gray-500 leading-relaxed bg-emerald-50/30 p-2 rounded-xl border border-emerald-50">
                                {JSON.parse(sale.itemsJson).map((i:any, idx:number) => (
                                    <span key={idx} className="inline-block bg-white px-2 py-0.5 rounded-md border border-gray-100 m-0.5">
                                      {i.name} <span className="text-emerald-600 font-bold">×{i.qty}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                    {filteredSales.length === 0 && (
                      <div className="text-center p-14 opacity-20 flex flex-col items-center">
                        <History size={60} />
                        <p className="mt-4 font-bold">لا مبيعات تطابق الفلاتر</p>
                      </div>
                    )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* --- Advanced Inventory Filters: Category, Quantity, Expiry --- */}
                <div className="bg-white p-4 rounded-3xl shadow-sm space-y-4 border border-emerald-100">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1 px-1">
                    <Filter size={14} /> فلاتر المخزون (جرد سريع)
                  </div>
                  
                  {/* فلتر الفئة */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-emerald-900/40 uppercase ml-2 flex items-center gap-1"><Tag size={12}/> الفئة (القسم)</label>
                    <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
                      <button onClick={() => setInvCategoryFilter('all')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${invCategoryFilter === 'all' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>الكل</button>
                      {categories.map(cat => (
                        <button key={cat} onClick={() => setInvCategoryFilter(cat)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${invCategoryFilter === cat ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{cat}</button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {/* فلتر الكمية */}
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-black text-emerald-900/40 uppercase ml-2 flex items-center gap-1"><Package size={12}/> الكمية (المخزون)</label>
                      <select className="w-full bg-emerald-50 p-3 rounded-xl font-bold text-xs outline-none border-2 border-emerald-50 focus:border-emerald-500 transition-all" value={invStockFilter} onChange={e => setInvStockFilter(e.target.value as any)}>
                        <option value="all">كل الكميات</option>
                        <option value="low">نواقص (&lt;10 قطعة)</option>
                        <option value="out">منتهي (0 قطعة)</option>
                      </select>
                    </div>
                    {/* فلتر الصلاحية */}
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-black text-emerald-900/40 uppercase ml-2 flex items-center gap-1"><Calendar size={12}/> الصلاحية (تاريخ)</label>
                      <select className="w-full bg-emerald-50 p-3 rounded-xl font-bold text-xs outline-none border-2 border-emerald-50 focus:border-emerald-500 transition-all" value={invExpiryFilter} onChange={e => setInvExpiryFilter(e.target.value as any)}>
                        <option value="all">كل المواعيد</option>
                        <option value="soon">قريبة (&lt;3 شهور)</option>
                        <option value="expired">منتهية الصلاحية</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-xs font-bold text-emerald-800 opacity-50">تم العثور على {filteredInventory.length} صنف</span>
                  </div>
                  {filteredInventory.map(med => {
                    const isExpired = new Date(med.expiryDate) <= new Date();
                    const isLow = med.stock <= 5;
                    return (
                      <div key={med.id} onClick={() => { setEditingMedicine(med); setIsEditOpen(true); }} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border-r-8" style={{ borderRightColor: isExpired ? '#ef4444' : isLow ? '#f59e0b' : '#10b981' }}>
                        <div>
                          <div className="font-bold text-emerald-900">{med.name}</div>
                          <div className="text-[10px] text-emerald-500 font-bold">
                            {med.category} • تنتهي في: {formatDate(med.expiryDate)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-black ${med.stock < 5 ? 'text-red-500' : 'text-emerald-700'}`}>{med.stock} <span className="text-[9px] font-normal opacity-50">قطعة</span></div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredInventory.length === 0 && (
                    <div className="text-center p-20 opacity-20">
                      <Filter size={60} className="mx-auto" />
                      <p className="mt-4 font-bold">لا توجد أصناف تطابق هذه الفلاتر</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* POS Cart Control (Improved Payment Choice) */}
      {view === 'pos' && cart.size > 0 && (
        <div className="fixed bottom-24 left-0 right-0 p-4 pointer-events-none z-50">
            <div className="max-w-md mx-auto bg-emerald-900/95 backdrop-blur-xl text-white p-5 rounded-[40px] shadow-2xl pointer-events-auto border border-white/10">
                {/* كيف باع: اختيار وسيلة الدفع قبل التأكيد */}
                <div className="flex gap-2 mb-4 bg-white/5 p-1 rounded-2xl">
                    <button onClick={() => setSelectedPayment('cash')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black transition-all ${selectedPayment === 'cash' ? 'bg-emerald-500 text-white shadow-lg' : 'text-emerald-400'}`}> <Wallet size={14}/> كاش </button>
                    <button onClick={() => setSelectedPayment('bank')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black transition-all ${selectedPayment === 'bank' ? 'bg-blue-500 text-white shadow-lg' : 'text-emerald-400'}`}> <CreditCard size={14}/> بنك </button>
                    <button onClick={() => setSelectedPayment('credit')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black transition-all ${selectedPayment === 'credit' ? 'bg-amber-500 text-white shadow-lg' : 'text-emerald-400'}`}> <UserMinus size={14}/> آجل </button>
                </div>
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={clearCart} title="مسح السلة" className="bg-red-500/20 text-red-400 p-3 rounded-2xl active:scale-90 transition-all"><Trash2 size={24} /></button>
                        <div>
                            <div className="text-2xl font-black">{cartTotal.toFixed(2)} <span className="text-xs font-normal">ج.م</span></div>
                            <div className="text-[10px] font-bold opacity-40">{cartItemsCount} قطعة في السلة</div>
                        </div>
                    </div>
                    <button onClick={handleCheckout} className="bg-emerald-500 text-white px-8 py-4 rounded-[24px] font-black text-xl shadow-lg active:scale-95 transition-all flex items-center gap-2">
                      تأكيد <ChevronLeft size={20} />
                    </button>
                </div>
            </div>
        </div>
      )}

      {checkoutResult && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[60] px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300 font-bold text-lg ${checkoutResult.status === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {checkoutResult.status === 'success' ? <CheckCircle2 /> : <AlertCircle />}
          {checkoutResult.msg}
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white border-t border-emerald-100 flex justify-around p-3 pb-10 z-40 shrink-0">
        <button onClick={() => setView('pos')} className={`flex flex-col items-center gap-1 transition-all ${view === 'pos' ? 'text-emerald-600 scale-110' : 'text-gray-300'}`}> <Package size={28} strokeWidth={view === 'pos' ? 3 : 2} /> <span className="text-[10px] font-black">الكاشير</span> </button>
        <div className="relative -mt-12">
            <button onClick={() => { setEditingMedicine(null); setIsEditOpen(true); }} className="bg-emerald-500 text-white p-6 rounded-full shadow-2xl active:scale-90 transition-transform"><Plus size={36} strokeWidth={4} /></button>
        </div>
        <button onClick={() => setView('accounting')} className={`flex flex-col items-center gap-1 transition-all ${view === 'accounting' ? 'text-emerald-600 scale-110' : 'text-gray-300'}`}> <BarChart3 size={28} strokeWidth={view === 'accounting' ? 3 : 2} /> <span className="text-[10px] font-black">التقارير</span> </button>
      </nav>

      {/* Modal Layer (Unchanged Addition Method) */}
      {isEditOpen && (
        <MedicineDialog categories={categories} initialData={editingMedicine} onSave={handleSaveMedicine} onClose={() => setIsEditOpen(false)} onDelete={handleDeleteMedicine} />
      )}
    </div>
  );
};

const MedicineDialog: React.FC<{ initialData: Medicine | null; categories: string[]; onSave: (data: Medicine) => void; onClose: () => void; onDelete: (id: number) => void; }> = ({ initialData, categories, onSave, onClose, onDelete }) => {
  const [formData, setFormData] = useState<Medicine>( initialData || { name: '', barcode: '', price: 0, costPrice: 0, stock: 0, category: 'عام', expiryDate: new Date().toISOString().split('T')[0] } );
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (nameRef.current) nameRef.current.focus(); }, []);

  return (
    <div className="fixed inset-0 bg-emerald-950/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[48px] overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        <div className="bg-emerald-600 p-8 text-white flex justify-between items-center shrink-0">
          <h2 className="text-3xl font-black">{initialData ? 'تعديل الصنف' : 'إضافة صنف'}</h2>
          <button onClick={onClose} className="p-2 bg-white/20 rounded-full active:scale-90 transition-all"><X size={24}/></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="p-8 space-y-5 overflow-y-auto no-scrollbar">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-emerald-900/40 uppercase px-1">الاسم التجاري</label>
            <input ref={nameRef} type="text" className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 font-bold focus:border-emerald-500 focus:bg-white outline-none" value={formData.name} required onChange={e => setFormData({...formData, name: e.target.value})}/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-emerald-900/40 uppercase px-1">سعر البيع</label>
              <input type="number" step="0.01" className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 font-bold focus:border-emerald-500 outline-none" value={formData.price} required onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})}/>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-emerald-900/40 uppercase px-1">سعر التكلفة</label>
              <input type="number" step="0.01" className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 font-bold focus:border-emerald-500 outline-none" value={formData.costPrice} required onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
                <label className="text-[10px] font-black text-emerald-900/40 uppercase px-1">المخزون</label>
                <input type="number" className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 font-bold focus:border-emerald-500 outline-none" value={formData.stock} required onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})}/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-emerald-900/40 uppercase px-1">الفئة</label>
                <input type="text" list="cats-dialog" className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 font-bold focus:border-emerald-500 outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}/>
                <datalist id="cats-dialog">{categories.map(c => <option key={c} value={c}/>)}</datalist>
              </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-emerald-900/40 uppercase px-1">الباركود</label>
            <input type="text" className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 font-bold focus:border-emerald-500 outline-none" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-emerald-900/40 uppercase px-1">تاريخ الصلاحية</label>
            <input type="date" className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 font-bold focus:border-emerald-500 outline-none" value={formData.expiryDate} required onChange={e => setFormData({...formData, expiryDate: e.target.value})}/>
          </div>
          <div className="flex gap-4 pt-4 shrink-0">
            <button type="submit" className="flex-grow bg-emerald-600 text-white py-5 rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all">حفظ البيانات</button>
            {initialData?.id && ( <button type="button" onClick={() => onDelete(initialData.id!)} className="bg-red-50 text-red-600 p-5 rounded-3xl active:scale-95 transition-all"><Trash2 size={24} /></button> )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default App;
