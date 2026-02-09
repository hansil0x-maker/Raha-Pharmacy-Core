import { Dexie, type Table } from 'dexie';
import { Medicine, Sale, Expense, Customer, AppNotification } from './types';
import { createClient } from '@supabase/supabase-js';

// تهيئة عميل Supabase - قناة الاتصال مع سيرفر ألمانيا
const SUPABASE_URL = 'https://cihficjizojbtnshwtfl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9Nmdm3LJUHK1fBF0ihj38g_ophBRHyD';

export const supabase = (SUPABASE_URL && SUPABASE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

export class RahaDB extends Dexie {
    medicines!: Table<Medicine, number>;
    sales!: Table<Sale, number>;
    expenses!: Table<Expense, number>;
    customers!: Table<Customer, number>;
    notifications!: Table<AppNotification, number>;

    constructor() {
        super('RahaDB');

        // الفهرسة المتقدمة (الإصدار 8) لضمان سرعة البحث
        this.version(8).stores({
            medicines: '++id, name, barcode, category, supplier, addedDate, expiryDate, stock, price',
            sales: '++id, timestamp, customerName, isReturned',
            expenses: '++id, timestamp, type',
            customers: '++id, name',
            notifications: '++id, timestamp'
        });

        // --- المزامنة التلقائية (إرسال البيانات فوراً عند الإضافة أو التعديل) ---

        // 1. مزامنة المخزون (Mirror Push)
        this.medicines.hook('creating', (primKey, obj) => {
            if (supabase) {
                const cloudObj = {
                    name: obj.name,
                    barcode: obj.barcode,
                    price: obj.price,
                    cost_price: obj.costPrice,
                    stock: obj.stock,
                    category: obj.category,
                    expiry_date: obj.expiryDate,
                    supplier: obj.supplier || '',
                    added_date: obj.addedDate || '',
                    usage_count: obj.usageCount || 0,
                    last_sold: obj.lastSold || null
                };
                setTimeout(() => supabase.from('medicines').upsert(cloudObj, { onConflict: 'barcode' }).then(({ error }) => error && console.error('Supabase Inventory Error:', error)), 0);
            }
        });

        this.medicines.hook('updating', (mods, primKey, obj) => {
            if (supabase) {
                const updated = { ...obj, ...mods };
                const cloudObj = {
                    name: updated.name,
                    barcode: updated.barcode,
                    price: updated.price,
                    cost_price: updated.costPrice,
                    stock: updated.stock,
                    category: updated.category,
                    expiry_date: updated.expiryDate,
                    supplier: updated.supplier || '',
                    added_date: updated.addedDate || '',
                    usage_count: updated.usageCount || 0,
                    last_sold: updated.lastSold || null
                };
                setTimeout(() => supabase.from('medicines').upsert(cloudObj, { onConflict: 'barcode' }).then(({ error }) => error && console.error('Supabase Inventory Update Error:', error)), 0);
            }
        });

        // 2. مزامنة المبيعات (Mirror Push - All Financial Fields)
        this.sales.hook('creating', (primKey, obj) => {
            if (supabase) {
                const cloudObj = {
                    timestamp: obj.timestamp,
                    total_amount: obj.totalAmount,
                    discount: obj.discount,
                    net_amount: obj.netAmount,
                    cash_amount: obj.cashAmount,
                    bank_amount: obj.bankAmount,
                    debt_amount: obj.debtAmount,
                    bank_trx_id: obj.bankTrxId || '',
                    customer_name: obj.customerName || '',
                    total_cost: obj.totalCost,
                    profit: obj.profit,
                    items_json: obj.itemsJson,
                    is_returned: obj.isReturned
                };
                setTimeout(() => supabase.from('sales').upsert(cloudObj, { onConflict: 'timestamp' }).then(({ error }) => error && console.error('Supabase Sales Error:', error)), 0);
            }
        });

        this.sales.hook('updating', (mods, primKey, obj) => {
            if (supabase) {
                const updated = { ...obj, ...mods };
                const cloudObj = {
                    timestamp: updated.timestamp,
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
                setTimeout(() => supabase.from('sales').upsert(cloudObj, { onConflict: 'timestamp' }).then(({ error }) => error && console.error('Supabase Sales Update Error:', error)), 0);
            }
        });

        this.sales.hook('deleting', (primKey, obj) => {
            if (supabase) {
                setTimeout(() => supabase.from('sales').delete().eq('timestamp', obj.timestamp).then(({ error }) => error && console.error('Supabase Sales Delete Error:', error)), 0);
            }
        });

        // 3. مزامنة المنصرفات (Mirror Push - Complete Fields)
        this.expenses.hook('creating', (primKey, obj) => {
            if (supabase) {
                const cloudObj = {
                    timestamp: obj.timestamp,
                    amount: obj.amount,
                    description: obj.description || '',
                    type: obj.type
                };
                setTimeout(() => supabase.from('expenses').upsert(cloudObj, { onConflict: 'timestamp' }).then(({ error }) => error && console.error('Supabase Expense Error:', error)), 0);
            }
        });

        this.expenses.hook('updating', (mods, primKey, obj) => {
            if (supabase) {
                const updated = { ...obj, ...mods };
                const cloudObj = {
                    timestamp: updated.timestamp,
                    amount: updated.amount,
                    description: updated.description || '',
                    type: updated.type
                };
                setTimeout(() => supabase.from('expenses').upsert(cloudObj, { onConflict: 'timestamp' }).then(({ error }) => error && console.error('Supabase Expense Update Error:', error)), 0);
            }
        });

        this.expenses.hook('deleting', (primKey, obj) => {
            if (supabase) {
                setTimeout(() => supabase.from('expenses').delete().eq('timestamp', obj.timestamp).then(({ error }) => error && console.error('Supabase Expense Delete Error:', error)), 0);
            }
        });

        // 4. حذف المخزون (Inventory Deletion Hook)
        this.medicines.hook('deleting', (primKey, obj) => {
            if (supabase) {
                setTimeout(() => supabase.from('medicines').delete().eq('barcode', obj.barcode).then(({ error }) => error && console.error('Supabase Inventory Delete Error:', error)), 0);
            }
        });
    }

    /**
     * دالة المزامنة الشاملة (Pull & Map - Mirror Logic): 
     * تجلب البيانات من السحاب، تحولها لكائنات محلية دقيقة، وتعالج النقص في الحقول.
     * الهدف: السحاب هو المصدر الوحيد للحقيقة (حذف ما هو غير موجود في السحاب).
     */
    async fullSyncFromCloud() {
        if (!supabase) return { success: false, message: 'اتصال Supabase غير مهيأ' };

        try {
            // 1. مزامنة المخزون (Smart Mirror)
            const { data: invData, error: invErr } = await supabase.from('medicines').select('*');
            if (invErr) console.error('Cloud Sync Error (Inventory):', invErr);
            if (invData) {
                const cloudIds = new Set(invData.map(i => i.id));
                // حذف العناصر المحلية التي اختفت من السحاب
                await this.medicines.filter(m => m.id !== undefined && !cloudIds.has(m.id)).delete();

                const cleanedInv: Medicine[] = invData.map((item: any) => ({
                    id: item.id,
                    name: item.name || 'صنف غير معروف',
                    barcode: item.barcode || '',
                    price: Number(item.price) || 0,
                    costPrice: Number(item.cost_price) || 0,
                    stock: Number(item.stock) || 0,
                    category: item.category || 'عام',
                    expiryDate: item.expiry_date || '',
                    supplier: item.supplier || '',
                    addedDate: item.added_date || new Date().toISOString().split('T')[0],
                    usageCount: item.usage_count || 0,
                    lastSold: item.last_sold || undefined
                }));
                await this.medicines.bulkPut(cleanedInv);
            }

            // 2. مزامنة المبيعات (Smart Mirror)
            const { data: salesData, error: salesErr } = await supabase.from('sales').select('*');
            if (salesErr) console.error('Cloud Sync Error (Sales):', salesErr);
            if (salesData) {
                // استخدام Timestamp كمعرف فريد للمطابقة لأن ID قد يختلف
                const cloudTimestamps = new Set(salesData.map(s => typeof s.timestamp === 'string' ? new Date(s.timestamp).getTime() : Number(s.timestamp)));
                await this.sales.filter(s => !cloudTimestamps.has(s.timestamp)).delete();

                const cleanedSales: Sale[] = salesData.map((s: any) => ({
                    timestamp: typeof s.timestamp === 'string' ? new Date(s.timestamp).getTime() : Number(s.timestamp || 0),
                    totalAmount: Number(s.total_amount) || 0,
                    discount: Number(s.discount) || 0,
                    netAmount: Number(s.net_amount) || 0,
                    cashAmount: Number(s.cash_amount) || 0,
                    bankAmount: Number(s.bank_amount) || 0,
                    debtAmount: Number(s.debt_amount) || 0,
                    bankTrxId: s.bank_trx_id || '',
                    customerName: s.customer_name || 'زبون عام',
                    totalCost: Number(s.total_cost) || 0,
                    profit: Number(s.profit) || 0,
                    itemsJson: typeof s.items_json === 'string' ? s.items_json : JSON.stringify(s.items_json || []),
                    isReturned: s.is_returned || false
                }));
                await this.sales.bulkPut(cleanedSales);
            }

            // 3. مزامنة المنصرفات (Smart Mirror)
            const { data: expData, error: expErr } = await supabase.from('expenses').select('*');
            if (expErr) console.error('Cloud Sync Error (Expenses):', expErr);
            if (expData) {
                const cloudTimestamps = new Set(expData.map(e => typeof e.timestamp === 'string' ? new Date(e.timestamp).getTime() : Number(e.timestamp)));
                await this.expenses.filter(e => !cloudTimestamps.has(e.timestamp)).delete();

                const cleanedExp: Expense[] = expData.map((e: any) => ({
                    timestamp: typeof e.timestamp === 'string' ? new Date(e.timestamp).getTime() : Number(e.timestamp || 0),
                    amount: Number(e.amount) || 0,
                    description: e.description || '',
                    type: e.type || 'عام'
                }));
                await this.expenses.bulkPut(cleanedExp);
            }

            return { success: true, count: invData?.length || 0 };
        } catch (error) {
            console.error('Raha Sync Overall Error:', error);
            return { success: false, error };
        }
    }

    /**
     * تصفير البيانات السحابية بالكامل (للاستخدام عند تصفير التطبيق)
     */
    async clearCloudData() {
        if (!supabase) return;
        try {
            // حذف كل السجلات (بدون شرط)
            await Promise.all([
                supabase.from('sales').delete().neq('id', -1),
                supabase.from('expenses').delete().neq('id', -1),
                supabase.from('medicines').delete().neq('id', -1) // اختياري حسب رغبة المستخدم
            ]);
        } catch (e) {
            console.error('Cloud Clear Error:', e);
        }
    }

    /**
     * رفع كافة البيانات المحلية للسحاب (Force Push)
     * يستخدم عند استعادة نسخة احتياطية لضمان تطابق السحاب مع المحلي
     */
    async fullUploadToCloud() {
        if (!supabase) return;
        try {
            // 1. المخزون
            const meds = await this.medicines.toArray();
            if (meds.length > 0) {
                const cloudMeds = meds.map(m => ({
                    id: m.id,
                    name: m.name,
                    barcode: m.barcode,
                    price: m.price,
                    cost_price: m.costPrice,
                    stock: m.stock,
                    category: m.category,
                    expiry_date: m.expiryDate,
                    supplier: m.supplier,
                    added_date: m.addedDate,
                    usage_count: m.usageCount,
                    last_sold: m.lastSold
                }));
                // نقوم بتقسيم البيانات لدفعات لتجنب مشاكل الحجم
                for (let i = 0; i < cloudMeds.length; i += 100) {
                    await supabase.from('medicines').upsert(cloudMeds.slice(i, i + 100));
                }
            }

            // 2. المبيعات
            const sales = await this.sales.toArray();
            if (sales.length > 0) {
                const cloudSales = sales.map(s => ({
                    // id: s.id, // نترك الـ ID ليتم توليده أو تحديثه حسب التطابق
                    timestamp: s.timestamp,
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

            // 3. المنصرفات
            const exps = await this.expenses.toArray();
            if (exps.length > 0) {
                const cloudExps = exps.map(e => ({
                    timestamp: e.timestamp,
                    amount: e.amount,
                    description: e.description,
                    type: e.type
                }));
                for (let i = 0; i < cloudExps.length; i += 100) {
                    await supabase.from('expenses').upsert(cloudExps.slice(i, i + 100), { onConflict: 'timestamp' });
                }
            }

            return true;
        } catch (e) {
            console.error('Full Upload Error:', e);
            return false;
        }
    }
}

export const db = new RahaDB();
