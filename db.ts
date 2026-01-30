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
                    ...obj,
                    cost_price: obj.costPrice,
                    added_date: obj.addedDate,
                    expiry_date: obj.expiryDate,
                    usage_count: obj.usageCount
                };
                setTimeout(() => supabase.from('inventory').upsert(cloudObj).then(), 0);
            }
        });

        this.medicines.hook('updating', (mods, primKey, obj) => {
            if (supabase) {
                const cloudObj = {
                    ...obj,
                    ...mods,
                    cost_price: mods.costPrice || obj.costPrice,
                    added_date: mods.addedDate || obj.addedDate,
                    expiry_date: mods.expiryDate || obj.expiryDate,
                    usage_count: mods.usageCount || obj.usageCount
                };
                setTimeout(() => supabase.from('inventory').upsert(cloudObj).then(), 0);
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
                    timestamp: obj.timestamp, // ارسله كرقم Unix ليتوافق مع BIGINT
                    items_json: obj.itemsJson,
                    is_returned: obj.isReturned
                };
                setTimeout(() => supabase.from('sales').insert([cloudObj]).then(), 0);
            }
        });

        // 3. مزامنة المنصرفات
        this.expenses.hook('creating', (primKey, obj) => {
            if (supabase) {
                const cloudObj = {
                    timestamp: obj.timestamp,
                    amount: obj.amount,
                    description: obj.description,
                    type: obj.type // تأكد من استخدام الحقل الصحيح
                };
                setTimeout(() => supabase.from('expenses').upsert(cloudObj, { onConflict: 'timestamp' }).then(), 0);
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
            // 1. مزامنة المخزون
            const { data: invData } = await supabase.from('inventory').select('*');
            if (invData) {
                const cleanedInv: Medicine[] = invData.map((item: any) => ({
                    id: item.id,
                    name: item.name || 'صنف غير معروف',
                    barcode: item.barcode || '',
                    price: Number(item.price) || 0,
                    costPrice: Number(item.cost_price || item.costPrice) || 0,
                    stock: Number(item.stock) || 0,
                    category: item.category || 'عام',
                    expiryDate: item.expiry_date || item.expiryDate || '',
                    supplier: item.supplier || '',
                    addedDate: item.added_date || item.addedDate || new Date().toISOString().split('T')[0],
                    usageCount: item.usage_count || item.usageCount || 0
                }));
                await this.medicines.bulkPut(cleanedInv);
            }

            // 2. مزامنة المبيعات (إصلاح مشكلة الأصفار)
            const { data: salesData } = await supabase.from('sales').select('*');
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
            const { data: expData } = await supabase.from('expenses').select('*');
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
            console.error('Raha Sync Error:', error);
            return { success: false, error };
        }
    }
}

export const db = new RahaDB();
