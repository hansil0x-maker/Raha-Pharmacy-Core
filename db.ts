import { Dexie, type Table } from 'dexie';
import { Medicine, Sale, Expense, Customer, AppNotification, WantedItem, Pharmacy, PharmacyDevice } from './types';

// Dynamic Supabase import to avoid initialization issues
let createClient: any = null;

// تهيئة عميل Supabase - قناة الاتصال مع سيرفر ألمانيا
const SUPABASE_URL = 'https://cihficjizojbtnshwtfl.supabase.co';
const SUPABASE_KEY = (typeof window !== 'undefined' && (window as any).SUPABASE_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpaGZpY2ppem9qYnRuc2h3dGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTEyMDQsImV4cCI6MjA4NDY2NzIwNH0.lta6_WMeXAdvJhZKJd4e-9tSxoZX9DOvuoCPkuSWpO8';

export let supabase: any = null;

/**
 * Return the shared supabase client, initialising it if necessary.
 */
export async function getSupabase() {
    if (!supabase) await initSupabase();
    return supabase;
}

export async function initSupabase() {
    if (supabase) return;
    if (!SUPABASE_URL || !SUPABASE_KEY || typeof window === 'undefined') return;

    try {
        if (!createClient) {
            const mod = await import('@supabase/supabase-js');
            createClient = mod.createClient;
        }

        supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            realtime: { enabled: false, params: { eventsPerSecond: 0 } },
            global: { fetch: (typeof window !== 'undefined' && window.fetch) ? window.fetch.bind(window) : undefined }
        });
        console.log('✅ Supabase initialized successfully');
    } catch (e) {
        console.error('❌ Supabase init failed:', e);
        console.warn('⚠️ Working in offline mode - Supabase not available');
        supabase = null;
    }
}

// Initialize on module load
initSupabase();

export class RahaDB extends Dexie {
    medicines!: Table<Medicine, string>;
    sales!: Table<Sale, string>;
    expenses!: Table<Expense, string>;
    customers!: Table<Customer, string>;
    notifications!: Table<AppNotification, string>;
    wantedItems!: Table<WantedItem, string>;
    pharmacies!: Table<Pharmacy, string>;
    pharmacyDevices!: Table<PharmacyDevice, string>;

    constructor() {
        super('RahaDB');

        // الإصدار 12: معرفات نصية (UUID) لتطابق التخزين السحابي ولتجنب أخطاء المزامنة
        this.version(12).stores({
            medicines: 'id, pharmacyId, name, barcode, category, supplier, addedDate, expiryDate, stock, price',
            sales: 'id, timestamp, pharmacyId, customerName, isReturned',
            expenses: 'id, timestamp, pharmacyId, type',
            customers: 'id, pharmacyId, name',
            notifications: 'id, pharmacyId, timestamp',
            wantedItems: 'id, pharmacyId, itemName, status, createdAt, reminderAt',
            pharmacies: 'id, pharmacyKey, name',
            pharmacyDevices: 'id, pharmacyId, hardwareId'
        });

        // Error handling for database version conflicts
        this.on('blocked', () => {
            console.warn('Database blocked - another tab might be open');
        });

        // --- المزامنة التلقائية ---
        this.medicines.hook('creating', (primKey: any, obj: Medicine) => {
            if (supabase && obj.pharmacyId) {
                console.log('🔄 Syncing medicine to cloud:', obj.name);
                const cloudObj = {
                    id: obj.id,
                    pharmacy_id: obj.pharmacyId,
                    name: obj.name,
                    barcode: obj.barcode,
                    price: obj.price,
                    cost_price: obj.costPrice,
                    stock: obj.stock,
                    category: obj.category,
                    expiry_date: obj.expiryDate,
                    supplier: obj.supplier,
                    supplier_phone: obj.supplierPhone,
                    added_date: obj.addedDate,
                    usage_count: obj.usageCount,
                    last_sold: obj.lastSold,
                    units_per_pkg: obj.unitsPerPkg,
                    min_stock_alert: obj.minStockAlert
                };
                setTimeout(() => supabase.from('medicines').upsert(cloudObj).then(({ error }: any) => {
                    if (error) {
                        console.error('❌ Supabase Inventory Sync Error:', error);
                    } else {
                        console.log('✅ Medicine synced successfully');
                    }
                }), 0);
                this.trackActivity(obj.pharmacyId);
            } else {
                console.warn('⚠️ Supabase not ready or no pharmacyId for medicine sync:', { supabase: !!supabase, pharmacyId: obj.pharmacyId });
            }
        });

        this.medicines.hook('updating', (mods: any, primKey: any, obj: Medicine) => {
            if (supabase && obj.pharmacyId) {
                const updated = { ...obj, ...mods };
                const cloudObj = {
                    id: updated.id,
                    pharmacy_id: updated.pharmacyId,
                    name: updated.name,
                    barcode: updated.barcode,
                    price: updated.price,
                    cost_price: updated.costPrice,
                    stock: updated.stock,
                    category: updated.category,
                    expiry_date: updated.expiryDate,
                    supplier: updated.supplier,
                    supplier_phone: updated.supplierPhone,
                    added_date: updated.addedDate,
                    usage_count: updated.usageCount || 0,
                    last_sold: updated.lastSold,
                    units_per_pkg: updated.unitsPerPkg || 1,
                    min_stock_alert: updated.minStockAlert || 0
                };
                setTimeout(() => supabase.from('medicines').upsert(cloudObj).then(({ error }: any) => {
                    if (error) console.error('❌ Medicine Update Error:', error);
                    else console.log('✅ Medicine updated successfully');
                }), 0);
                this.trackActivity(updated.pharmacyId);
            } else {
                console.warn('⚠️ Supabase not ready or no pharmacyId for medicine update');
            }
        });

        this.sales.hook('creating', (primKey: any, obj: Sale) => {
            if (supabase && obj.pharmacyId) {
                console.log('🔄 Syncing sale to cloud:', obj.totalAmount);
                const cloudObj = {
                    id: obj.id,
                    timestamp: obj.timestamp,
                    pharmacy_id: obj.pharmacyId,
                    total_amount: obj.totalAmount,
                    discount: obj.discount,
                    net_amount: obj.netAmount,
                    cash_amount: obj.cashAmount,
                    bank_amount: obj.bankAmount,
                    debt_amount: obj.debtAmount,
                    bank_trx_id: obj.bankTrxId,
                    customer_name: obj.customerName,
                    total_cost: obj.totalCost,
                    profit: obj.profit,
                    items_json: obj.itemsJson ? JSON.parse(obj.itemsJson) : {},
                    is_returned: obj.isReturned
                };
                setTimeout(() => supabase.from('sales').upsert(cloudObj).then(({ error }: any) => {
                    if (error) console.error('❌ Supabase Sales Sync Error:', error);
                    else console.log('✅ Sale synced successfully');
                }), 0);
            } else {
                console.warn('⚠️ Supabase not ready or no pharmacyId for sale sync');
            }
        });

        this.sales.hook('updating', (mods: any, primKey: any, obj: Sale) => {
            if (supabase && obj.pharmacyId) {
                const updated = { ...obj, ...mods };
                const cloudObj = {
                    id: updated.id,
                    timestamp: updated.timestamp,
                    pharmacy_id: updated.pharmacyId,
                    total_amount: updated.totalAmount,
                    discount: updated.discount,
                    net_amount: updated.netAmount,
                    cash_amount: updated.cashAmount,
                    bank_amount: updated.bankAmount,
                    debt_amount: updated.debtAmount,
                    bank_trx_id: updated.bankTrxId || '',
                    customer_name: updated.customerName || '',
                    total_cost: updated.totalCost,
                    profit: updated.profit,
                    items_json: updated.itemsJson,
                    is_returned: updated.isReturned
                };
                setTimeout(() => supabase.from('sales').upsert(cloudObj, { onConflict: 'timestamp' }).then(({ error }: any) => {
                    if (error) console.error('❌ Supabase Sales Update Error:', error);
                    else console.log('✅ Sale updated successfully');
                }), 0);
            } else {
                console.warn('⚠️ Supabase not ready or no pharmacyId for sale update');
            }
        });

        this.sales.hook('deleting', (primKey: any, obj: Sale) => {
            if (supabase && obj.pharmacyId) {
                setTimeout(() => supabase.from('sales').delete().eq('timestamp', obj.timestamp).then(({ error }: any) => {
                    if (error) console.error('❌ Supabase Sales Delete Error:', error);
                    else console.log('✅ Sale deleted successfully');
                }), 0);
            } else {
                console.warn('⚠️ Supabase not ready or no pharmacyId for sale delete');
            }
        });

        this.expenses.hook('creating', (primKey: any, obj: Expense) => {
            if (supabase && obj.pharmacyId) {
                console.log('🔄 Syncing expense to cloud:', obj.amount);
                const cloudObj = {
                    id: obj.id,
                    timestamp: obj.timestamp,
                    pharmacy_id: obj.pharmacyId,
                    amount: obj.amount,
                    description: obj.description,
                    type: obj.type
                };
                setTimeout(() => supabase.from('expenses').upsert(cloudObj).then(({ error }: any) => {
                    if (error) console.error('❌ Supabase Expenses Sync Error:', error);
                    else console.log('✅ Expense synced successfully');
                }), 0);
            } else {
                console.warn('⚠️ Supabase not ready or no pharmacyId for expense sync');
            }
        });

        this.expenses.hook('updating', (mods: any, primKey: any, obj: Expense) => {
            if (supabase && obj.pharmacyId) {
                const updated = { ...obj, ...mods };
                const cloudObj = {
                    id: updated.id,
                    timestamp: updated.timestamp,
                    pharmacy_id: updated.pharmacyId,
                    amount: updated.amount,
                    description: updated.description || '',
                    type: updated.type
                };
                setTimeout(() => supabase.from('expenses').upsert(cloudObj, { onConflict: 'timestamp' }).then(({ error }: any) => {
                    if (error) console.error('❌ Supabase Expense Update Error:', error);
                    else console.log('✅ Expense updated successfully');
                }), 0);
            } else {
                console.warn('⚠️ Supabase not ready or no pharmacyId for expense update');
            }
        });

        this.expenses.hook('deleting', (primKey: any, obj: Expense) => {
            if (supabase && obj.pharmacyId) {
                setTimeout(() => supabase.from('expenses').delete().eq('timestamp', obj.timestamp).then(({ error }: any) => {
                    if (error) console.error('❌ Supabase Expense Delete Error:', error);
                    else console.log('✅ Expense deleted successfully');
                }), 0);
            } else {
                console.warn('⚠️ Supabase not ready or no pharmacyId for expense delete');
            }
        });

        this.medicines.hook('deleting', (primKey: any, obj: Medicine) => {
            if (supabase && obj.pharmacyId) {
                setTimeout(() => supabase.from('medicines').delete().eq('id', obj.id).then(({ error }: any) => {
                    if (error) console.error('❌ Supabase Inventory Delete Error:', error);
                    else console.log('✅ Medicine deleted successfully');
                }), 0);
            } else {
                console.warn('⚠️ Supabase not ready or no pharmacyId for medicine delete');
            }
        });

        this.wantedItems.hook('creating', (primKey: any, obj: any) => {
            if (supabase && obj.pharmacyId) {
                console.log('🔄 Syncing wanted item to cloud:', obj.itemName);
                const cloudObj = {
                    id: obj.id,
                    pharmacy_id: obj.pharmacyId,
                    item_name: obj.itemName,
                    notes: obj.notes,
                    request_count: obj.requestCount,
                    status: obj.status,
                    created_at: new Date(obj.createdAt).toISOString(),
                    reminder_at: obj.reminderAt
                };
                setTimeout(() => supabase.from('wanted_list').upsert(cloudObj).then(({ error }: any) => {
                    if (error) console.error('❌ WantedList Sync Error:', error);
                    else console.log('✅ Wanted item synced successfully');
                }), 0);
            } else {
                console.warn('⚠️ Supabase not ready or no pharmacyId for wanted item sync');
            }
        });
    }

    async fullSyncFromCloud(pharmacyId: string) {
        if (!supabase) return { success: false, message: 'لا يوجد اتصال بالسحاب' };
        console.log('🔄 Starting full sync from cloud for pharmacy:', pharmacyId);
        try {
            const { data: medicines, error: mErr } = await supabase.from('medicines').select('*').eq('pharmacy_id', pharmacyId);
            const { data: sales, error: sErr } = await supabase.from('sales').select('*').eq('pharmacy_id', pharmacyId);
            const { data: expenses, error: eErr } = await supabase.from('expenses').select('*').eq('pharmacy_id', pharmacyId);
            const { data: wanted, error: wErr } = await supabase.from('wanted_list').select('*').eq('pharmacy_id', pharmacyId);

            if (mErr || sErr || eErr || wErr) {
                console.error('❌ Cloud sync errors:', { mErr, sErr, eErr, wErr });
                throw new Error('خطأ في جلب البيانات من السحاب');
            }

            console.log('📥 Downloaded data:', { 
                medicines: medicines?.length || 0, 
                sales: sales?.length || 0, 
                expenses: expenses?.length || 0, 
                wanted: wanted?.length || 0 
            });

            await this.transaction('rw', [this.medicines, this.sales, this.expenses, this.wantedItems], async () => {
                if (medicines) await this.medicines.bulkPut(medicines.map((m: any) => ({
                    id: m.id,
                    pharmacyId: m.pharmacy_id,
                    name: m.name,
                    barcode: m.barcode,
                    price: m.price,
                    costPrice: m.cost_price,
                    stock: m.stock,
                    category: m.category,
                    expiryDate: m.expiry_date,
                    supplier: m.supplier,
                    supplierPhone: m.supplier_phone,
                    addedDate: m.added_date,
                    usageCount: m.usage_count,
                    lastSold: m.last_sold,
                    unitsPerPkg: m.units_per_pkg,
                    minStockAlert: m.min_stock_alert
                })));

                if (sales) await this.sales.bulkPut(sales.map((s: any) => ({
                    id: s.id,
                    timestamp: Number(s.timestamp),
                    pharmacyId: s.pharmacy_id,
                    totalAmount: s.total_amount,
                    discount: s.discount,
                    netAmount: s.net_amount,
                    cashAmount: s.cash_amount,
                    bankAmount: s.bank_amount,
                    debtAmount: s.debt_amount,
                    bankTrxId: s.bank_trx_id,
                    customerName: s.customer_name,
                    totalCost: s.total_cost,
                    profit: s.profit,
                    itemsJson: JSON.stringify(s.items_json),
                    isReturned: s.is_returned
                })));

                if (expenses) await this.expenses.bulkPut(expenses.map((e: any) => ({
                    id: e.id,
                    timestamp: Number(e.timestamp),
                    pharmacyId: e.pharmacy_id,
                    amount: e.amount,
                    description: e.description,
                    type: e.type
                })));

                if (wanted) await this.wantedItems.bulkPut(wanted.map((w: any) => ({
                    id: w.id,
                    pharmacyId: w.pharmacy_id,
                    itemName: w.item_name,
                    notes: w.notes,
                    requestCount: w.request_count,
                    status: w.status,
                    createdAt: new Date(w.created_at).getTime(),
                    reminderAt: w.reminder_at
                })));
            });

            console.log('✅ Full sync completed successfully');
            return { success: true };
        } catch (err) {
            console.error('❌ Full Sync Error:', err);
            return { success: false, message: 'فشل المزامنة الشاملة' };
        }
    }

    async purgeAllLocalData() {
        console.log('🗑️ Purging all local data...');
        await this.transaction('rw', [
            this.medicines, this.sales, this.expenses,
            this.customers, this.notifications, this.wantedItems,
            this.pharmacyDevices
        ], async () => {
            await Promise.all([
                this.medicines.clear(),
                this.sales.clear(),
                this.expenses.clear(),
                this.customers.clear(),
                this.notifications.clear(),
                this.wantedItems.clear(),
                this.pharmacyDevices.clear()
            ]);
        });
        console.log('✅ Local data purged successfully');
    }

    async verifyPharmacy(key: string) {
        if (!supabase) {
            console.warn('⚠️ Supabase not available for pharmacy verification');
            return null;
        }
        console.log('🔍 Verifying pharmacy with key:', key);
        try {
            const { data, error } = await supabase.from('pharmacies').select('*').eq('pharmacy_key', key).single();
            if (error || !data) {
                console.error('❌ Pharmacy verification failed:', error);
                return null;
            }

            console.log('✅ Pharmacy verified:', data.name);
            await this.pharmacies.clear();
            await this.pharmacies.add({
                id: data.id,
                pharmacyKey: data.pharmacy_key,
                name: data.name
            });

            return {
                id: data.id,
                pharmacyKey: data.pharmacy_key,
                name: data.name,
                masterPassword: data.master_password,
                status: data.status as 'active' | 'suspended'
            };
        } catch (err) {
            console.error('❌ Pharmacy verification error:', err);
            return null;
        }
    }

    async clearCloudData() {
        if (!supabase) {
            console.warn('⚠️ Supabase not available for clearing cloud data');
            return;
        }
        console.log('🗑️ Clearing cloud data...');
        try {
            await supabase.from('expenses').delete().neq('timestamp', 0);
            await supabase.from('sales').delete().neq('timestamp', 0);
            console.log('✅ Cloud data cleared successfully');
        } catch (e) {
            console.error('❌ Cloud Clear Error:', e);
        }
    }

    async fullUploadToCloud() {
        if (!supabase) {
            console.warn('⚠️ Supabase not available for uploading to cloud');
            return false;
        }
        console.log('⬆️ Starting full upload to cloud...');
        try {
            const meds = await this.medicines.toArray();
            if (meds.length > 0) {
                console.log(`📤 Uploading ${meds.length} medicines...`);
                const cloudMeds = meds.map(m => ({
                    id: m.id,
                    pharmacy_id: m.pharmacyId,
                    name: m.name,
                    barcode: m.barcode,
                    price: m.price,
                    cost_price: m.costPrice,
                    stock: m.stock,
                    category: m.category,
                    expiry_date: m.expiryDate,
                    supplier: m.supplier,
                    supplier_phone: m.supplierPhone,
                    added_date: m.addedDate,
                    usage_count: m.usageCount,
                    last_sold: m.lastSold,
                    units_per_pkg: m.unitsPerPkg,
                    min_stock_alert: m.minStockAlert
                }));
                for (let i = 0; i < cloudMeds.length; i += 100) {
                    await supabase.from('medicines').upsert(cloudMeds.slice(i, i + 100));
                }
            }

            const sales = await this.sales.toArray();
            if (sales.length > 0) {
                console.log(`📤 Uploading ${sales.length} sales...`);
                const cloudSales = sales.map(s => ({
                    id: s.id,
                    timestamp: s.timestamp,
                    pharmacy_id: s.pharmacyId,
                    total_amount: s.totalAmount,
                    discount: s.discount,
                    net_amount: s.netAmount,
                    cash_amount: s.cashAmount,
                    bank_amount: s.bankAmount,
                    debt_amount: s.debtAmount,
                    bank_trx_id: s.bankTrxId,
                    customer_name: s.customerName,
                    total_cost: s.totalCost,
                    profit: s.profit,
                    items_json: s.itemsJson,
                    is_returned: s.isReturned
                }));
                for (let i = 0; i < cloudSales.length; i += 100) {
                    await supabase.from('sales').upsert(cloudSales.slice(i, i + 100), { onConflict: 'timestamp' });
                }
            }

            const exps = await this.expenses.toArray();
            if (exps.length > 0) {
                console.log(`📤 Uploading ${exps.length} expenses...`);
                const cloudExps = exps.map(e => ({
                    id: e.id,
                    timestamp: e.timestamp,
                    pharmacy_id: e.pharmacyId,
                    amount: e.amount,
                    description: e.description,
                    type: e.type
                }));
                for (let i = 0; i < cloudExps.length; i += 100) {
                    await supabase.from('expenses').upsert(cloudExps.slice(i, i + 100), { onConflict: 'timestamp' });
                }
            }
            console.log('✅ Full upload completed successfully');
            return true;
        } catch (e) {
            console.error('❌ Full Upload Error:', e);
            return false;
        }
    }

    // --- ميزات تتبع النشاط والأجهزة (Phase 5) ---

    private async trackActivity(pharmacyId: string) {
        if (!supabase) return;
        // تحديث آخر ظهور للصيدلية بدون انتظار
        supabase.from('pharmacies').update({ last_active: new Date().toISOString() }).eq('id', pharmacyId).then();
    }

    async registerDevice(pharmacyId: string): Promise<string> {
        let hardwareId = localStorage.getItem('raha_hardware_id');
        if (!hardwareId) {
            hardwareId = crypto.randomUUID();
            localStorage.setItem('raha_hardware_id', hardwareId);
        }

        const deviceName = `${navigator.platform} - ${navigator.userAgent.split(') ')[0].split(' (')[1] || 'Unknown Device'}`;
        console.log('📱 Registering device:', { hardwareId, deviceName, pharmacyId });

        if (supabase) {
            try {
                await supabase.from('pharmacy_devices').upsert({
                    pharmacy_id: pharmacyId,
                    hardware_id: hardwareId,
                    device_name: deviceName,
                    last_login: new Date().toISOString()
                }, { onConflict: 'pharmacy_id, hardware_id' });
                console.log('✅ Device registered successfully');
            } catch (error) {
                console.error('❌ Device registration failed:', error);
            }
        }

        return hardwareId;
    }

    async checkDeviceBan(pharmacyId: string, hardwareId: string): Promise<boolean> {
        if (!supabase) return false;
        try {
            console.log('🔍 Checking device ban:', { pharmacyId, hardwareId });
            const { data } = await supabase.from('pharmacy_devices')
                .select('is_banned')
                .eq('pharmacy_id', pharmacyId)
                .eq('hardware_id', hardwareId)
                .single();
            const isBanned = data?.is_banned || false;
            if (isBanned) {
                console.warn('⚠️ Device is banned');
            }
            return isBanned;
        } catch (error) {
            console.error('❌ Device ban check failed:', error);
            return false;
        }
    }

    async smartAddWantedItem(item: Omit<WantedItem, 'id'>, pharmacyId: string) {
        // 1. البحث في قاعدة البيانات المحلية عن صنف "قيد الانتظار" بنفس الاسم
        const existing = await this.wantedItems
            .where('itemName')
            .equalsIgnoreCase(item.itemName)
            .and((x: WantedItem) => x.status === 'pending' && x.pharmacyId === pharmacyId)
            .first();

        if (existing) {
            const updated = {
                ...existing,
                requestCount: (existing.requestCount || 1) + 1,
                notes: item.notes || existing.notes
            };
            await this.wantedItems.put(updated);
            console.log('🔄 Updated existing wanted item:', updated.itemName);

            // المزامنة مع السحاب
            if (supabase) {
                await supabase.from('wanted_list').update({
                    request_count: updated.requestCount,
                    notes: updated.notes
                }).eq('id', updated.id);
            }
            return updated;
        } else {
            const newItem: WantedItem = {
                ...item,
                id: crypto.randomUUID(),
                pharmacyId,
                status: 'pending',
                createdAt: Date.now()
            };
            await this.wantedItems.add(newItem);
            console.log('➕ Added new wanted item:', newItem.itemName);

            if (supabase) {
                await supabase.from('wanted_list').insert({
                    id: newItem.id,
                    pharmacy_id: pharmacyId,
                    item_name: newItem.itemName,
                    notes: newItem.notes,
                    request_count: newItem.requestCount,
                    status: newItem.status,
                    created_at: new Date(newItem.createdAt || Date.now()).toISOString()
                });
            }
            return newItem;
        }
    }

    // --- دالة إعادة محاولة المزامنة ---
    async retryFailedSync() {
        if (!supabase) {
            console.warn('⚠️ Supabase not available for retry sync');
            return false;
        }
        console.log('🔄 Starting retry sync...');
        
        try {
            // إعادة تهيئة Supabase إذا لزم الأمر
            if (!supabase) {
                await initSupabase();
            }
            
            // اختبار الاتصال
            const { data, error } = await supabase.from('pharmacies').select('count').single();
            if (error) {
                console.error('❌ Connection test failed:', error);
                return false;
            }
            
            console.log('✅ Connection restored');
            return true;
        } catch (err) {
            console.error('❌ Retry sync failed:', err);
            return false;
        }
    }

    // --- دالة التحقق من حالة الاتصال ---
    async getConnectionStatus() {
        if (!supabase) {
            return { connected: false, message: 'Supabase not initialized' };
        }
        
        try {
            const { data, error } = await supabase.from('pharmacies').select('count').single();
            if (error) {
                return { connected: false, message: error.message };
            }
            return { connected: true, message: 'Connected successfully' };
        } catch (err) {
            return { connected: false, message: 'Connection test failed' };
        }
    }
}

export const db = new RahaDB();
