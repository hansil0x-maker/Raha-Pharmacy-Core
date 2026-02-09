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
    sales!: Table<Sale, number>;  // timestamp كمفتاح لكن نوعه number
    expenses!: Table<Expense, number>;  // timestamp كمفتاح لكن نوعه number
    customers!: Table<Customer, number>;
    notifications!: Table<AppNotification, number>;

    constructor() {
        super('RahaDB');

        // الإصدار 10: الحل الجذري والنهائي
        // 1. تغيير المفاتيح الأساسية إلى timestamp لمنع التكرار
        // 2. ضمان تطابق هيكل البيانات مع السحاب
        this.version(10).stores({
            medicines: '++id, name, barcode, category, supplier, addedDate, expiryDate, stock, price',
            sales: 'timestamp, customerName, isReturned', // timestamp هو المفتاح الفريد
            expenses: 'timestamp, type', // timestamp هو المفتاح الفريد
            customers: '++id, name',
            notifications: '++id, timestamp'
        });

        // --- المزامنة التلقائية (إرسال البيانات فوراً عند الإضافة أو التعديل) ---

        // 1. مزامنة المخزون
        this.medicines.hook('creating', (primKey, obj) => {
            if (supabase) {
                // Fix: Explicitly map fields to avoid sending local camelCase keys
                const cloudObj = {
                    id: obj.id,
                    name: obj.name,
                    barcode: obj.barcode,
                    price: obj.price,
                    cost_price: obj.costPrice,
                    stock: obj.stock,
                    category: obj.category,
                    expiry_date: obj.expiryDate,
                    supplier: obj.supplier,
                    added_date: obj.addedDate,
                    usage_count: obj.usageCount || 0,
                    last_sold: obj.lastSold
                };
                setTimeout(() => supabase.from('medicines').upsert(cloudObj).then(({ error }) => error && console.error('Inv Sync Error:', error)), 0);
            }
        });

        this.medicines.hook('updating', (mods, primKey, obj) => {
            if (supabase) {
                const updated = { ...obj, ...mods };
                const cloudObj = {
                    id: updated.id,
                    name: updated.name,
                    barcode: updated.barcode,
                    price: updated.price,
                    cost_price: updated.costPrice,
                    stock: updated.stock,
                    category: updated.category,
                    expiry_date: updated.expiryDate,
                    supplier: updated.supplier,
                    added_date: updated.addedDate,
                    usage_count: updated.usageCount || 0,
                    last_sold: updated.lastSold
                };
                setTimeout(() => supabase.from('medicines').upsert(cloudObj).then(({ error }) => error && console.error('Inv Update Error:', error)), 0);
            }
        });

        // 2. مزامنة المبيعات (Fix: Ensure Timestamp is Key)
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
                    bank_trx_id: obj.bankTrxId,
                    customer_name: obj.customerName,
                    total_cost: obj.totalCost,
                    profit: obj.profit,
                    items_json: obj.itemsJson,
                    is_returned: obj.isReturned
                };
                setTimeout(() => supabase.from('sales').upsert(cloudObj, { onConflict: 'timestamp' }).then(({ error }) => error && console.error('Sales Sync Error:', error)), 0);
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

        // 3. مزامنة المنصرفات (Fix: Ensure Timestamp is Key)
        this.expenses.hook('creating', (primKey, obj) => {
            if (supabase) {
                const cloudObj = {
                    timestamp: obj.timestamp,
                    amount: obj.amount,
                    description: obj.description,
                    type: obj.type
                };
                setTimeout(() => supabase.from('expenses').upsert(cloudObj, { onConflict: 'timestamp' }).then(({ error }) => error && console.error('Exp Sync Error:', error)), 0);
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
     * دالة المزامنة الموحدة (Fix: Strict Type & Key Handling)
     */
    async fullSyncFromCloud() {
        if (!supabase) return { success: false, message: 'لا يوجد اتصال بالسحاب' };

        try {
            // 1. المبيعات (Fix Duplication)
            const { data: sales, error: sErr } = await supabase.from('sales').select('*');
            if (sErr) console.error('Cloud Sync Error (Sales):', sErr);
            if (sales) {
                const cleanSales: Sale[] = sales
                    .filter((s: any) => s.timestamp) // Must have timestamp
                    .map((s: any) => ({
                        timestamp: Number(s.timestamp), // Force Number
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
                        itemsJson: s.items_json,
                        isReturned: s.is_returned
                    }));
                await this.sales.bulkPut(cleanSales); // bulkPut with timestamp key = Update if exists, Insert if new. NO DUPLICATES.
            }

            // 2. المنصرفات (Fix Not Syncing)
            const { data: expenses, error: eErr } = await supabase.from('expenses').select('*');
            if (eErr) console.error('Cloud Sync Error (Expenses):', eErr);
            if (expenses) {
                const cleanExpenses: Expense[] = expenses
                    .filter((e: any) => e.timestamp)
                    .map((e: any) => ({
                        timestamp: Number(e.timestamp), // Force Number
                        amount: e.amount,
                        description: e.description,
                        type: e.type
                    }));
                await this.expenses.bulkPut(cleanExpenses);
            }

            // 3. المخزون (Merge)
            const { data: meds, error: mErr } = await supabase.from('medicines').select('*');
            if (mErr) console.error('Cloud Sync Error (Inventory):', mErr);
            if (meds) {
                const cleanMeds: Medicine[] = meds.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    barcode: m.barcode,
                    price: m.price,
                    costPrice: m.cost_price,
                    stock: m.stock,
                    category: m.category,
                    expiryDate: m.expiry_date,
                    supplier: m.supplier,
                    addedDate: m.added_date,
                    usageCount: m.usage_count,
                    lastSold: m.last_sold
                }));
                await this.medicines.bulkPut(cleanMeds);
            }

            return { success: true };
        } catch (e) {
            console.error(e);
            return { success: false, message: 'حدث خطأ في المزامنة' };
        }
    }

    /**
     * تصفير البيانات (Fix: Include Sales/Reports as requested)
     */
    async clearCloudData() {
        if (!supabase) return;
        try {
            // حذف المبيعات والمنصرفات فقط - الإبقاء على المخزون
            await supabase.from('expenses').delete().neq('id', -1);
            await supabase.from('sales').delete().neq('id', -1);
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
