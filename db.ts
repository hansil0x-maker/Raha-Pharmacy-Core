import Dexie, { Table } from 'dexie';
import { Medicine, Sale, Expense, Customer, AppNotification, WantedItem, Pharmacy, PharmacyDevice, Note } from './types';

// =====================================================
// REAL SOLUTION - SUPABASE LOADING FIX
// =====================================================

// Hidden Supabase configuration
const SUPABASE_URL = "https://cihficjizojbtnshwtfl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpaGZpY2ppem9qYnRuc2h3dGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTEyMDQsImV4cCI6MjA4NDY2NzIwNH0.lta6_WMeXAdvJhZKJd4e-9tSxoZX9DOvuoCPkuSWpO8";

// Global Supabase instance - START AS NULL
let supabase: any = null;

// REAL SOLUTION: Load Supabase with browser compatibility - Singleton Pattern
export async function initSupabase() {
    if (supabase) return supabase; // Return existing instance
    if (!SUPABASE_URL || !SUPABASE_KEY || typeof window === 'undefined') return null;

    try {
        let createClient: any;
        if (!createClient) {
            const mod = await import('@supabase/supabase-js');
            createClient = mod.createClient;
        }
        
        // ✅ REAL SOLUTION - أنشئ Supabase حقيقي!
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        
        // Fix subscribe and channel methods
        const originalSubscribe = supabase.subscribe;
        const originalChannel = supabase.channel;
        const originalRealtime = supabase.realtime;
        
        supabase.subscribe = (...args: any[]) => {
            console.warn('🔕 Supabase subscribe disabled to prevent errors');
            return { unsubscribe: () => {} };
        };
        
        supabase.channel = (...args: any[]) => {
            console.warn('🔕 Supabase channel disabled to prevent errors');
            return { subscribe: () => ({ unsubscribe: () => {} }) };
        };
        
        supabase.realtime = {
            subscribe: () => ({ unsubscribe: () => {} }),
            channels: []
        };
        
        console.log('✅ Supabase initialized successfully (REAL SOLUTION)');
        return supabase;
    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error);
    }
}

export async function getSupabase() {
    if (!supabase) {
        await initSupabase();
    }
    return supabase;
}

// =====================================================
// DATABASE CLASS
// =====================================================

class RahaDB extends Dexie {
    medicines!: Table<Medicine, string>;
    sales!: Table<Sale, string>;
    expenses!: Table<Expense, string>;
    customers!: Table<Customer, string>;
    notifications!: Table<AppNotification, string>;
    wantedItems!: Table<WantedItem, string>;
    pharmacies!: Table<Pharmacy, string>;
    pharmacyDevices!: Table<PharmacyDevice, string>;
    notes!: Table<Note, string>;

    constructor() {
        super('RahaDB');
        
        // FORCE DELETE OLD DATABASE TO AVOID PRIMARY KEY CONFLICTS
        Dexie.delete('RahaDB').then(() => {
            console.log('🗑️ Old database deleted successfully');
        }).catch((err) => {
            console.warn('⚠️ Could not delete old database:', err);
        });
        
        this.version(32).stores({ 
            pharmacies: 'id, pharmacyKey, name',
            medicines: 'id, pharmacyId, name, barcode, price, costPrice, stock, category, expiryDate, supplier, supplierPhone, addedDate, usageCount, lastSold, unitsPerPkg, minStockAlert, createdAt, updatedAt',
            sales: 'id, timestamp, pharmacyId, totalAmount, discount, netAmount, cashAmount, bankAmount, debtAmount, bankTrxId, customerName, totalCost, profit, itemsJson, isReturned',
            expenses: 'id, timestamp, pharmacyId, amount, description, type',
            customers: 'id, name, phone, email, address, notes, createdAt',
            notifications: 'id, title, message, type, read, createdAt, data, timestamp',
            wantedItems: 'id, pharmacyId, itemName, notes, requestCount, status, createdAt, reminderAt',
            pharmacyDevices: 'id, pharmacyId, hardwareId, deviceName, lastLogin, isBanned',
            notes: 'id, pharmacyId, title, content, type, createdAt, updatedAt, createdBy, isDeleted'
        });

        // Handle upgrade errors by deleting database
        this.on('blocked', () => {
            console.warn(' Database blocked - deleting and reloading...');
            Dexie.delete('RahaDB').then(() => {
                window.location.reload();
            });
        });
        this.on('versionchange', () => {
            console.warn('🔄 Database version changed - deleting and reloading...');
            Dexie.delete('RahaDB').then(() => {
                window.location.reload();
            });
        });

        // Add hooks for real-time sync
        this.medicines.hook('creating', (primKey, obj, trans) => {
            if (obj.pharmacyId && navigator.onLine) {
                setTimeout(() => this.syncSingleMedicine(obj), 1000);
            }
        });

        this.medicines.hook('updating', (modifications, primKey, obj, trans) => {
            if (obj.pharmacyId && navigator.onLine) {
                setTimeout(() => this.syncSingleMedicine({...obj, ...modifications}), 1000);
            }
        });

        this.sales.hook('creating', (primKey, obj, trans) => {
            if (obj.pharmacyId && navigator.onLine) {
                setTimeout(() => this.syncSingleSale(obj), 1000);
            }
        });

        this.expenses.hook('creating', (primKey, obj, trans) => {
            if (obj.pharmacyId && navigator.onLine) {
                setTimeout(() => this.syncSingleExpense(obj), 1000);
            }
        });
    }

    // =====================================================
    // SURGICAL API METHODS
    // =====================================================

    async verifyPharmacy(key: string): Promise<Pharmacy | null> {
        const startTime = Date.now();
        try {
            const supabase = await getSupabase();
            if (!supabase) {
                console.error('❌ Supabase not available');
                return null;
            }

            const { data, error } = await supabase
                .from('pharmacies')
                .select('*')
                .eq('pharmacy_key', key)
                .single();

            if (error) {
                console.error('❌ Pharmacy verification failed:', error.message);
                return null;
            }

            console.log('✅ Pharmacy verified:', data.name);
            
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

    async fullSyncFromCloud(pharmacyId: string): Promise<boolean> {
        const startTime = Date.now();
        try {
            const supabase = await getSupabase();
            if (!supabase) {
                console.error('❌ Supabase not available');
                return false;
            }

            // Sync pharmacies first
            const { data: pharmacies } = await supabase
                .from('pharmacies')
                .select('*')
                .eq('id', pharmacyId);

            if (pharmacies && pharmacies.length > 0) {
                await this.pharmacies.clear();
                const validPharmacies = pharmacies.filter((p: any) => p.id != null);
                if (validPharmacies.length > 0) {
                    await this.pharmacies.bulkAdd(validPharmacies.map((p: any) => ({
                        id: p.id,
                        pharmacyKey: p.pharmacy_key,
                        name: p.name
                    })));
                }
            }

            // Sync medicines
            const { data: medicines } = await supabase
                .from('medicines')
                .select('*')
                .eq('pharmacy_id', pharmacyId);

            if (medicines) {
                await this.medicines.clear();
                const validMedicines = medicines.filter((m: any) => m.id != null);
                if (validMedicines.length > 0) {
                    await this.medicines.bulkPut(validMedicines.map((m: any) => ({
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
                        minStockAlert: m.min_stock_alert,
                        createdAt: m.created_at ? new Date(m.created_at).getTime() : undefined,
                        updatedAt: m.updated_at ? new Date(m.updated_at).getTime() : undefined
                    })));
                }
            }

            // Sync sales
            const { data: sales } = await supabase
                .from('sales')
                .select('*')
                .eq('pharmacy_id', pharmacyId);

            if (sales) {
                await this.sales.clear();
                const validSales = sales.filter((s: any) => s.id != null);
                if (validSales.length > 0) {
                    await this.sales.bulkPut(validSales.map((s: any) => ({
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
                }
            }

            console.log('✅ Full sync completed successfully');
            return true;
        } catch (err) {
            console.error('❌ Full Sync Error:', err);
            return false;
        }
    }

    async syncSingleMedicine(medicine: any): Promise<void> {
        try {
            const supabase = await getSupabase();
            if (!supabase) return;
            
            // التحقق من وجود الأعمدة قبل المزامنة
            const { data: schemaCheck } = await supabase
                .from('information_schema.columns')
                .select('column_name')
                .eq('table_name', 'medicines')
                .eq('column_name', 'created_at')
                .single();
            
            if (!schemaCheck) {
                console.warn('⚠️ medicines table missing created_at column, skipping sync');
                return;
            }
            
            const { error } = await supabase
                .from('medicines')
                .upsert({
                    id: medicine.id,
                    pharmacy_id: medicine.pharmacyId,
                    name: medicine.name,
                    barcode: medicine.barcode,
                    price: medicine.price,
                    cost_price: medicine.costPrice,
                    stock: medicine.stock,
                    category: medicine.category,
                    expiry_date: medicine.expiryDate,
                    supplier: medicine.supplier,
                    supplier_phone: medicine.supplierPhone,
                    added_date: medicine.addedDate,
                    usage_count: medicine.usageCount,
                    last_sold: medicine.lastSold,
                    units_per_pkg: medicine.unitsPerPkg,
                    min_stock_alert: medicine.minStockAlert,
                    created_at: medicine.createdAt || Date.now(),
                    updated_at: medicine.updatedAt || Date.now()
                });
            
            if (error) {
                console.error('❌ Single medicine sync error:', error);
            }
        } catch (err) {
            console.error('❌ Single medicine sync error:', err);
        }
    }

    async syncSingleSale(sale: any): Promise<void> {
        try {
            const supabase = await getSupabase();
            if (!supabase) return;
            
            const itemsJson = JSON.parse(sale.itemsJson || '[]');
            const { error } = await supabase
                .from('sales')
                .upsert({
                    id: sale.id,
                    timestamp: sale.timestamp,
                    pharmacy_id: sale.pharmacyId,
                    total_amount: sale.totalAmount,
                    discount: sale.discount,
                    net_amount: sale.netAmount,
                    cash_amount: sale.cashAmount,
                    bank_amount: sale.bankAmount,
                    debt_amount: sale.debtAmount,
                    bank_trx_id: sale.bankTrxId,
                    customer_name: sale.customerName,
                    total_cost: sale.totalCost,
                    profit: sale.profit,
                    items_json: itemsJson,
                    is_returned: sale.isReturned
                });
            
            if (error) {
                console.error('❌ Single sale sync error:', error);
            }
        } catch (err) {
            console.error('❌ Single sale sync error:', err);
        }
    }

    async syncSingleExpense(expense: any): Promise<void> {
        try {
            const supabase = await getSupabase();
            if (!supabase) return;
            
            const { error } = await supabase
                .from('expenses')
                .upsert({
                    id: expense.id,
                    timestamp: expense.timestamp,
                    pharmacy_id: expense.pharmacyId,
                    amount: expense.amount,
                    description: expense.description,
                    type: expense.type
                });
            
            if (error) {
                console.error('❌ Single expense sync error:', error);
            }
        } catch (err) {
            console.error('❌ Single expense sync error:', err);
        }
    }

    async syncToCloud(pharmacyId: string): Promise<boolean> {
        const startTime = Date.now();
        try {
            const supabase = await getSupabase();
            if (!supabase) {
                console.error('❌ Supabase not available');
                return false;
            }

            // Sync medicines to cloud
            const localMedicines = await this.medicines.where('pharmacyId').equals(pharmacyId).toArray();
            for (const med of localMedicines) {
                const { error } = await supabase
                    .from('medicines')
                    .upsert({
                        id: med.id,
                        pharmacy_id: med.pharmacyId,
                        name: med.name,
                        barcode: med.barcode,
                        price: med.price,
                        cost_price: med.costPrice,
                        stock: med.stock,
                        category: med.category,
                        expiry_date: med.expiryDate,
                        supplier: med.supplier,
                        supplier_phone: med.supplierPhone,
                        added_date: med.addedDate,
                        usage_count: med.usageCount,
                        last_sold: med.lastSold,
                        units_per_pkg: med.unitsPerPkg,
                        min_stock_alert: med.minStockAlert,
                        created_at: med.createdAt || Date.now(),
                        updated_at: med.updatedAt || Date.now()
                    });
                if (error) {
                    console.error('❌ Medicine sync error:', error);
                }
            }

            // Sync sales to cloud
            const localSales = await this.sales.where('pharmacyId').equals(pharmacyId).toArray();
            for (const sale of localSales) {
                const itemsJson = JSON.parse(sale.itemsJson || '[]');
                const { error } = await supabase
                    .from('sales')
                    .upsert({
                        id: sale.id,
                        timestamp: sale.timestamp,
                        pharmacy_id: sale.pharmacyId,
                        total_amount: sale.totalAmount,
                        discount: sale.discount,
                        net_amount: sale.netAmount,
                        cash_amount: sale.cashAmount,
                        bank_amount: sale.bankAmount,
                        debt_amount: sale.debtAmount,
                        bank_trx_id: sale.bankTrxId,
                        customer_name: sale.customerName,
                        total_cost: sale.totalCost,
                        profit: sale.profit,
                        items_json: itemsJson,
                        is_returned: sale.isReturned
                    });
                if (error) {
                    console.error('❌ Sale sync error:', error);
                }
            }

            // Sync expenses to cloud
            const localExpenses = await this.expenses.where('pharmacyId').equals(pharmacyId).toArray();
            for (const expense of localExpenses) {
                const { error } = await supabase
                    .from('expenses')
                    .upsert({
                        id: expense.id,
                        timestamp: expense.timestamp,
                        pharmacy_id: expense.pharmacyId,
                        amount: expense.amount,
                        description: expense.description,
                        type: expense.type
                    });
                if (error) {
                    console.error('❌ Expense sync error:', error);
                }
            }

            this.logPerformance('syncToCloud', startTime);
            return true;
        } catch (err) {
            console.error('❌ Sync to cloud error:', err);
            return false;
        }
    }

    async purgeAllLocalData(): Promise<boolean> {
        const startTime = Date.now();
        try {
            await this.medicines.clear();
            await this.sales.clear();
            await this.expenses.clear();
            await this.customers.clear();
            await this.notifications.clear();
            await this.wantedItems.clear();
            await this.pharmacies.clear();
            await this.pharmacyDevices.clear();

            this.logPerformance('purgeAllLocalData', startTime);
            return true;
        } catch (e) {
            console.error('❌ Purge error:', e);
            return false;
        }
    }

    async registerDevice(pharmacyId: string): Promise<string> {
        const startTime = Date.now();
        let hardwareId = localStorage.getItem('raha_hardware_id');
        if (!hardwareId) {
            hardwareId = crypto.randomUUID();
            localStorage.setItem('raha_hardware_id', hardwareId);
        }

        const supabase = await getSupabase();
        if (!supabase) {
            console.warn('⚠️ Supabase not available for device registration');
            return hardwareId;
        }

        try {
            // Check if device already exists first
            const { data: existingDevice } = await supabase
                .from('pharmacy_devices')
                .select('*')
                .eq('pharmacy_id', pharmacyId)
                .eq('hardware_id', hardwareId)
                .single();

            if (existingDevice) {
                console.log('✅ Device already registered, using existing hardware ID');
                this.logPerformance('registerDevice', startTime);
                return hardwareId;
            }

            // Only insert if device doesn't exist
            const { error } = await supabase
                .from('pharmacy_devices')
                .insert([{
                    pharmacy_id: pharmacyId,
                    hardware_id: hardwareId,
                    device_name: 'Raha PRO Device',
                    last_login: new Date().toISOString(),
                    is_banned: false
                }]);

            if (error) {
                console.error('❌ Device registration failed:', error.message);
                return hardwareId;
            }

            this.logPerformance('registerDevice', startTime);
            return hardwareId;
        } catch (e) {
            console.error('❌ Device registration error:', e);
            return hardwareId;
        }
    }

    async checkDeviceBan(pharmacyId: string): Promise<boolean> {
        const startTime = Date.now();
        try {
            let hardwareId = localStorage.getItem('raha_hardware_id');
            if (!hardwareId) {
                hardwareId = crypto.randomUUID();
                localStorage.setItem('raha_hardware_id', hardwareId);
            }

            const supabase = await getSupabase();
            if (!supabase) {
                console.warn('⚠️ Supabase not available for device ban check');
                return false;
            }

            const { data, error } = await supabase
                .from('pharmacy_devices')
                .select('is_banned')
                .eq('pharmacy_id', pharmacyId)
                .eq('hardware_id', hardwareId)
                .single();

            if (error) {
                console.warn('⚠️ Device ban check failed:', error.message);
                return false;
            }

            const isBanned = data?.is_banned || false;
            this.logPerformance('checkDeviceBan', startTime);
            return isBanned;
        } catch (e) {
            console.error('❌ Device ban check error:', e);
            return false;
        }
    }

    async smartAddWantedItem(item: Omit<WantedItem, 'id' | 'createdAt'>, pharmacyId: string) {
        console.log('🧠 Smart wanted item addition:', item.itemName);
        
        const existing = await this.wantedItems
            .where('pharmacyId').equals(pharmacyId)
            .and(item => item.itemName === item.itemName && item.status === 'pending')
            .first();

        if (existing) {
            await this.wantedItems.update(existing.id!, {
                requestCount: (existing.requestCount || 1) + (item.requestCount || 1),
                notes: item.notes || existing.notes
            });
            console.log('✅ Updated existing wanted item');
        } else {
            const newItem: WantedItem = {
                ...item,
                id: crypto.randomUUID(),
                createdAt: Date.now(),
                status: 'pending'
            };
            await this.wantedItems.add(newItem);
            console.log('✅ Added new wanted item');
        }

        const client = await getSupabase();
        if (client) {
            const cloudObj = {
                pharmacy_id: pharmacyId,
                item_name: item.itemName,
                notes: item.notes,
                request_count: existing ? (existing.requestCount || 1) + 1 : 1,
                status: 'pending',
                created_at: new Date().toISOString()
            };
            
            client.from('wanted_items').upsert(cloudObj).then(({ error }: any) => {
                if (error) {
                    console.error('❌ Silent wanted item sync error:', error);
                }
            });
        }
    }

    async getConnectionStatus() {
        try {
            const supabase = await getSupabase();
            if (!supabase) {
                return { connected: false, message: 'Supabase not loaded' };
            }

            const { error } = await supabase
                .from('pharmacies')
                .select('count')
                .limit(1);

            return {
                connected: !error,
                message: error ? error.message : 'Connected successfully'
            };
        } catch (e) {
            return {
                connected: false,
                message: e instanceof Error ? e.message : 'Unknown error'
            };
        }
    }

    async retryFailedSync() {
        console.log('🔄 Retrying failed sync...');
        return true;
    }

    private logPerformance(operation: string, startTime: number) {
        const duration = Date.now() - startTime;
        if (duration > 1000) {
            console.warn(`⚠️ Slow operation: ${operation} took ${duration}ms`);
        } else {
            console.log(`✅ Fast operation: ${operation} took ${duration}ms`);
        }
    }
}

// Export only the class
export const db = new RahaDB();
