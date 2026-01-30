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

        // 1. مزامنة الأدوية (إضافة وتعديل)
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

        // 2. مزامنة المبيعات: (الإضافة الجديدة لمعالجة المرتجعات)
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
                await supabase.from('sales').upsert(cloudObj, { onConflict: 'timestamp' });
                
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

        // الجراحة هنا: مراقبة تحديث الفاتورة (عند الضغط على "إرجاع")
        this.sales.hook('updating', (mods, primKey, obj) => {
            const updated = { ...obj, ...mods };
            const cloudObj = {
                timestamp: updated.timestamp,
                total_amount: updated.totalAmount,
                profit: updated.profit,
                items_json: typeof updated.itemsJson === 'string' ? updated.itemsJson : JSON.stringify(updated.itemsJson),
                customer_name: updated.customerName,
                is_returned: updated.isReturned
            };
            // تحديث السحاب فوراً بحالة الإرجاع الجديدة
            setTimeout(() => supabase.from('sales').upsert(cloudObj, { onConflict: 'timestamp' }).then(), 0);
        });
    }

    async fullSyncFromCloud() {
        try {
            // أ. مزامنة الأدوية
            const { data: medsData } = await supabase.from('medicines').select('*');
            if (medsData) {
                for (const item of medsData) {
                    const existing = await this.medicines.where('barcode').equals(item.barcode).first();
                    const medObj = {
                        name: item.name, barcode: item.barcode, price: Number(item.price),
                        costPrice: Number(item.cost_price), stock: Number(item.stock),
                        category: item.category, expiryDate: item.expiry_date,
                        supplier: item.supplier, addedDate: item.added_date, usageCount: item.usage_count
                    };
                    if (existing) await this.medicines.update(existing.id!, medObj);
                    else await this.medicines.add(medObj);
                }
            }

            // ب. الجراحة هنا: مزامنة المبيعات (التقارير) لضمان تطابق حالة الإرجاع
            const { data: salesData } = await supabase.from('sales').select('*');
            if (salesData) {
                for (const s of salesData) {
                    const existingSale = await this.sales.where('timestamp').equals(s.timestamp).first();
                    const saleObj = {
                        timestamp: s.timestamp,
                        totalAmount: Number(s.total_amount),
                        profit: Number(s.profit),
                        itemsJson: JSON.parse(s.items_json),
                        customerName: s.customer_name,
                        isReturned: s.is_returned
                    };
                    if (existingSale) await this.sales.update(existingSale.id!, saleObj);
                    else await this.sales.add(saleObj);
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Sync Error:', error);
            return { success: false, error };
        }
    }
}

export const db = new RahaDB();