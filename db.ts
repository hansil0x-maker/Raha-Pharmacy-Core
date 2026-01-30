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

        // 1. مزامنة المخزون
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
                    supplier: obj.supplier,
                    added_date: obj.addedDate,
                    usage_count: obj.usageCount || 0
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
                    supplier: updated.supplier,
                    added_date: updated.addedDate,
                    usage_count: updated.usageCount || 0
                };
                setTimeout(() => supabase.from('medicines').upsert(cloudObj, { onConflict: 'barcode' }).then(({ error }) => error && console.error('Supabase Inventory Update Error:', error)), 0);
            }
        });

        // 2. مزامنة المبيعات
        this.sales.hook('creating', (primKey, obj) => {
            if (supabase) {
                const cloudObj = {
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
                    timestamp: obj.timestamp, // Unix Timestamp
                    items_json: obj.itemsJson,
                    is_returned: obj.isReturned
                };
                setTimeout(() => supabase.from('sales').insert([cloudObj]).then(({ error }) => error && console.error('Supabase Sales Error:', error)), 0);
            }
        });

        // 3. مزامنة المنصرفات
        this.expenses.hook('creating', (primKey, obj) => {
            if (supabase) {
                const cloudObj = {
                    timestamp: obj.timestamp,
                    amount: obj.amount,
                    description: obj.description,
                    type: obj.type
                };
                setTimeout(() => supabase.from('expenses').upsert(cloudObj, { onConflict: 'timestamp' }).then(({ error }) => error && console.error('Supabase Expense Error:', error)), 0);
            }
        });
    }

    /**
     * دالة المزامنة الشاملة (Pull & Map): 
     * تجلب البيانات من السحاب، تنظمها، وتعالج النقص في الحقول.
     */
    async fullSyncFromCloud() {
        if (!supabase) return { success: false, message: 'اتصال Supabase غير مهيأ' };

        try {
            // 1. مزامنة المخزون (استخدام جدول medicines)
            const { data: invData, error: invErr } = await supabase.from('medicines').select('*');
            if (invErr) console.error('Cloud Sync Error (Inventory):', invErr);
            if (invData) {
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
                    usageCount: item.usage_count || 0
                }));
                await this.medicines.bulkPut(cleanedInv);
            }

            // 2. مزامنة المبيعات (إصلاح مشكلة الأصفار)
            const { data: salesData, error: salesErr } = await supabase.from('sales').select('*');
            if (salesErr) console.error('Cloud Sync Error (Sales):', salesErr);
            if (salesData) {
                const cleanedSales: Sale[] = salesData.map((s: any) => ({
                    timestamp: typeof s.timestamp === 'string' ? new Date(s.timestamp).getTime() : Number(s.timestamp),
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
                    itemsJson: typeof s.items_json === 'string' ? s.items_json : JSON.stringify(s.items_json),
                    isReturned: s.is_returned || false
                }));
                await this.sales.bulkPut(cleanedSales);
            }

            // 3. مزامنة المنصرفات
            const { data: expData, error: expErr } = await supabase.from('expenses').select('*');
            if (expErr) console.error('Cloud Sync Error (Expenses):', expErr);
            if (expData) {
                const cleanedExp: Expense[] = expData.map((e: any) => ({
                    timestamp: typeof e.timestamp === 'string' ? new Date(e.timestamp).getTime() : Number(e.timestamp),
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
}

export const db = new RahaDB();
