import { Dexie, type Table } from 'dexie';
import { Medicine, Sale, Expense, Customer, AppNotification, WantedItem } from './types';
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
    wantedItems!: Table<WantedItem, string>;

    constructor() {
        super('RahaDB');

        // الإصدار 10: الحل الجذري والنهائي
        this.version(10).stores({
            medicines: '++id, name, barcode, category, supplier, addedDate, expiryDate, stock, price',
            sales: 'timestamp, customerName, isReturned',
            expenses: 'timestamp, type',
            customers: '++id, name',
            notifications: '++id, timestamp',
            wantedItems: 'id, itemName, status, createdAt, reminderAt'
        });

        // --- المزامنة التلقائية ---
        this.medicines.hook('creating', (primKey, obj) => {
            if (supabase) {
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
                    supplier_phone: obj.supplierPhone,
                    added_date: obj.addedDate,
                    usage_count: obj.usageCount || 0,
                    last_sold: obj.lastSold,
                    units_per_pkg: obj.unitsPerPkg || 1,
                    min_stock_alert: obj.minStockAlert || 0
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
                    supplier_phone: updated.supplierPhone,
                    added_date: updated.addedDate,
                    usage_count: updated.usageCount || 0,
                    last_sold: updated.lastSold,
                    units_per_pkg: updated.unitsPerPkg || 1,
                    min_stock_alert: updated.minStockAlert || 0
                };
                setTimeout(() => supabase.from('medicines').upsert(cloudObj).then(({ error }) => error && console.error('Inv Update Error:', error)), 0);
            }
        });

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

        this.medicines.hook('deleting', (primKey, obj) => {
            if (supabase) {
                setTimeout(() => supabase.from('medicines').delete().eq('barcode', obj.barcode).then(({ error }) => error && console.error('Supabase Inventory Delete Error:', error)), 0);
            }
        });

        this.wantedItems.hook('creating', (primKey, obj) => {
            if (supabase) {
                const cloudObj = {
                    id: obj.id,
                    item_name: obj.itemName,
                    notes: obj.notes,
                    request_count: obj.requestCount,
                    status: obj.status,
                    created_at: new Date(obj.createdAt).toISOString(),
                    reminder_at: obj.reminderAt
                };
                setTimeout(() => supabase.from('wanted_list').upsert(cloudObj).then(({ error }) => error && console.error('WantedList Sync Error:', error)), 0);
            }
        });
    }

    async fullSyncFromCloud() {
        if (!supabase) return { success: false, message: 'لا يوجد اتصال بالسحاب' };
        try {
            const { data: sales, error: sErr } = await supabase.from('sales').select('*');
            if (sErr) console.error('Cloud Sync Error (Sales):', sErr);
            if (sales) {
                await this.sales.bulkPut(sales.map((s: any) => ({
                    timestamp: Number(s.timestamp),
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
                })));
            }

            const { data: expenses, error: eErr } = await supabase.from('expenses').select('*');
            if (eErr) console.error('Cloud Sync Error (Expenses):', eErr);
            if (expenses) {
                await this.expenses.bulkPut(expenses.map((e: any) => ({
                    timestamp: Number(e.timestamp),
                    amount: e.amount,
                    description: e.description,
                    type: e.type
                })));
            }

            const { data: meds, error: mErr } = await supabase.from('medicines').select('*');
            if (mErr) console.error('Cloud Sync Error (Inventory):', mErr);
            if (meds) {
                await this.medicines.bulkPut(meds.map((m: any) => ({
                    id: m.id,
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
            }

            const { data: wanted, error: wErr } = await supabase.from('wanted_list').select('*');
            if (wErr) console.error('Cloud Sync Error (WantedList):', wErr);
            if (wanted) {
                await this.wantedItems.bulkPut(wanted.map((w: any) => ({
                    id: w.id,
                    itemName: w.item_name,
                    notes: w.notes,
                    requestCount: w.request_count,
                    status: w.status,
                    createdAt: new Date(w.created_at).getTime(),
                    reminderAt: w.reminder_at
                })));
            }

            return { success: true };
        } catch (e) {
            console.error(e);
            return { success: false, message: 'حدث خطأ في المزامنة' };
        }
    }

    async clearCloudData() {
        if (!supabase) return;
        try {
            await supabase.from('expenses').delete().neq('timestamp', 0);
            await supabase.from('sales').delete().neq('timestamp', 0);
        } catch (e) {
            console.error('Cloud Clear Error:', e);
        }
    }

    async fullUploadToCloud() {
        if (!supabase) return;
        try {
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
                const cloudSales = sales.map(s => ({
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
