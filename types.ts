export interface Pharmacy {
    id: string;
    pharmacyKey: string;
    name: string;
    masterPassword: string;
    status: 'active' | 'suspended';
    createdAt: number;
}

export interface Medicine {
    id?: number;
    pharmacyId?: string;
    name: string;
    barcode: string;
    price: number;
    costPrice: number;
    stock: number;
    category: string;
    expiryDate: string;
    supplier?: string;
    supplierPhone?: string;
    addedDate?: number | string;
    usageCount?: number;
    lastSold?: number;
    unitsPerPkg?: number;
    minStockAlert?: number;
}

export type ViewType = 'pos' | 'inventory' | 'accounting' | 'expenses' | 'notifications';

export interface CartItem {
    medicine: Medicine;
    quantity: number;
}

export interface Sale {
    id?: number;
    pharmacyId?: string;
    totalAmount: number;
    discount: number;
    netAmount: number;
    cashAmount: number;
    bankAmount: number;
    debtAmount: number;
    bankTrxId: string;
    customerName: string;
    totalCost: number;
    profit: number;
    timestamp: number;
    itemsJson: string;
    isReturned: boolean;
}

export interface Expense {
    id?: number;
    pharmacyId?: string;
    description: string;
    amount: number;
    type: string;
    timestamp: number;
}

export interface Customer {
    id?: number;
    pharmacyId?: string;
    name: string;
}

export interface AppNotification {
    id?: number;
    pharmacyId?: string;
    message: string;
    type: 'warning' | 'error' | 'info';
    timestamp: number;
}

export interface WantedItem {
    id?: string; // UUID from cloud
    pharmacyId?: string;
    itemName: string;
    notes?: string;
    requestCount: number;
    status: 'pending' | 'ordered' | 'received' | 'completed' | 'archived';
    createdAt: number;
    reminderAt?: number;
}
