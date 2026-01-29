import { Dexie, type Table } from 'dexie';
import { Medicine, Sale, Expense, Customer, AppNotification } from './types';
import { createClient } from '@supabase/supabase-js';

// الإعدادات النهائية والربط المباشر بالسحاب
const SUPABASE_URL = 'https://cihficjizojbtnshwtfl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpaGZpY2ppem9qYnRuc2h3dGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTEyMDQsImV4cCI6MjA4NDY2NzIwNH0.lta6_WMeXAdvJhZKJd4e-9tSxoZX9DOvuoCPkuSWpO8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export class RahaDB extends Dexie {
    medicines!: Table<Medicine, number>;
    sales!: Table<Sale, number>;
    expenses!: Table<Expense, number>;
    customers!: Table<Customer, number>;
    notifications!: Table<AppNotification, number>;

    constructor() {
        super('RahaDB');

        // الفهرسة المتقدمة لسرعة البحث والعرض
        this.version(8).stores({
            medicines: '++id, name, barcode, category, supplier, addedDate, expiryDate, stock, price',
            sales: '++id, timestamp, customerName, isReturned',
            expenses: '++id, timestamp, type',
            customers: '++id, name',
            notifications: '++id, timestamp'
        });

        // --- نظام المزامنة التلقائية (إرسال للسحاب) ---

        // 1. مزامنة الأدوية
        this.medicines.hook('creating', (primKey, obj) => {
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
            setTimeout(() => supabase.from('medicines').insert([cloudObj]).then(), 0);
        });

        this.medicines.hook('updating', (mods, primKey, obj) => {
            const updatedObj = { ...obj, ...mods };
            const cloudObj = {
                name: updatedObj.name,
                barcode: updatedObj.barcode,
                price: updatedObj.price,
                cost_price: updatedObj.costPrice,
                stock: updatedObj.stock,
                category: updatedObj.category,
                expiry_date: updatedObj.expiryDate,
                supplier: updatedObj.supplier,
                added_date: updatedObj.addedDate,
                usage_count: updatedObj.usageCount || 0
            };
            setTimeout(() => supabase.from('medicines').upsert(cloudObj, { onConflict: 'barcode' }).then(), 0);
        });

        // 2. مزامنة المبيعات
        this.sales.hook('creating', (primKey, obj) => {
            const cloudObj = {
                timestamp: obj.timestamp,
                total_amount: obj.totalAmount,
                profit: obj.profit,
                items_json: JSON.stringify(obj.itemsJson),
                customer_name: obj.customerName,
                is_returned: obj.isReturned || false
            };
            setTimeout(() => supabase.from('sales').insert([cloudObj]).then(), 0);
        });
    }

    /**
     * جلب البيانات من السحاب لتحديث الجهاز
     */
    async fullSyncFromCloud() {
        try {
            const { data, error } = await supabase.from('medicines').select('*');
            if (error) throw error;

            if (data && data.length > 0) {
                const cleanedData: Medicine[] = data.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    barcode: item.barcode,
                    price: Number(item.price) || 0,
                    costPrice: Number(item.cost_price) || 0,
                    stock: Number(item.stock) || 0,
                    category: item.category,
                    expiryDate: item.expiry_date,
                    supplier: item.supplier,
                    addedDate: item.added_date,
                    usageCount: item.usage_count || 0
                }));

                await this.medicines.bulkPut(cleanedData);
                return { success: true, count: data.length };
            }
            return { success: false, message: 'السحاب فارغ' };
        } catch (error) {
            console.error('Raha Sync Error:', error);
            return { success: false, error };
        }
    }
}

export const db = new RahaDB();