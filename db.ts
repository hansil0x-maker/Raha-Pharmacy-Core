import { Dexie, type Table } from 'dexie';
import { Medicine, Sale, Expense, Customer, AppNotification } from './types';
import { createClient } from '@supabase/supabase-js';

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

        this.version(8).stores({
            medicines: '++id, &barcode, name, category, supplier',
            sales: '++id, timestamp, customerName',
            expenses: '++id, timestamp',
            customers: '++id, name',
            notifications: '++id, timestamp'
        });

        // 1. مزامنة الأدوية: استخدام upsert بناءً على الباركود لمنع التكرار
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
            setTimeout(() => supabase.from('medicines').upsert(cloudObj, { onConflict: 'barcode' }).then(), 0);
        });

        this.medicines.hook('updating', (mods, primKey, obj) => {
            const updated = { ...obj, ...mods };
            const cloudObj = {
                name: updated.name,
                barcode: updated.barcode,
                price: updated.price,
                cost_price: updated.costPrice,
                stock: updated.stock,
                category: updated.category,
                expiry_date: updated.expiry_date || updated.expiryDate,
                supplier: updated.supplier,
                added_date: updated.added_date || updated.addedDate,
                usage_count: updated.usageCount || 0
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
            
            setTimeout(async () => {
                await supabase.from('sales').insert([cloudObj]);
                
                if (obj.itemsJson) {
                    const items = typeof obj.itemsJson === 'string' ? JSON.parse(obj.itemsJson) : obj.itemsJson;
                    for (const item of items) {
                        const { data } = await supabase.from('medicines').select('stock').eq('barcode', item.barcode).single();
                        if (data) {
                            const newStock = data.stock - item.quantity;
                            await supabase.from('medicines').update({ stock: newStock }).eq('barcode', item.barcode);
                        }
                    }
                }
            }, 0);
        });
    } // نهاية الـ Constructor

    async fullSyncFromCloud() {
        try {
            const { data, error } = await supabase.from('medicines').select('*');
            if (error) throw error;

            if (data && data.length > 0) {
                for (const item of data) {
                    const existing = await this.medicines.where('barcode').equals(item.barcode).first();
                    
                    const medicineData = {
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
                    };

                    if (existing) {
                        await this.medicines.update(existing.id!, medicineData);
                    } else {
                        await this.medicines.add(medicineData);
                    }
                }
                return { success: true, count: data.length };
            }
            return { success: false, message: 'لا توجد بيانات' };
        } catch (error) {
            console.error('Sync Error:', error);
            return { success: false, error };
        }
    }
} // <--- هذا القوس كان مفقوداً لإغلاق الـ Class

export const db = new RahaDB();