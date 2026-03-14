export interface Medicine {
  id: string;
  pharmacyId: string;
  name: string;
  barcode?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  category?: string;
  expiryDate?: number | null;
  supplier?: string;
  supplierPhone?: string;
  addedDate?: number;
  usageCount?: number;
  lastSold?: number | null;
  unitsPerPkg?: number;
  minStockAlert?: number;
}

export interface Sale {
  id: string;
  timestamp: number;
  pharmacyId: string;
  totalAmount?: number;
  discount?: number;
  netAmount?: number;
  cashAmount?: number;
  bankAmount?: number;
  debtAmount?: number;
  bankTrxId?: string;
  customerName?: string;
  totalCost?: number;
  profit?: number;
  itemsJson?: string;
  isReturned?: boolean;
}

export interface Expense {
  id: string;
  timestamp: number;
  pharmacyId: string;
  amount: number;
  description?: string;
  type?: string;
}

export interface Customer {
  id: string;
  pharmacyId: string;
  name: string;
  phone?: string;
  address?: string;
}

export interface AppNotification {
  id: string;
  pharmacyId: string;
  message: string;
  type?: string;
  timestamp: number;
}

export interface WantedItem {
  id: string;
  pharmacyId: string;
  itemName: string;
  notes?: string;
  requestCount?: number;
  status?: string;
  createdAt?: number;
  reminderAt?: number | null;
}

export interface Pharmacy {
  id: string;
  pharmacyKey: string;
  name: string;
  masterPassword?: string;
  status?: 'active' | 'suspended' | string;
  lastActive?: number | null;
  createdAt?: number;
}

export interface PharmacyDevice {
  id: string;
  pharmacyId: string;
  hardwareId: string;
  deviceName?: string;
  lastLogin?: number | null;
  isBanned?: boolean;
}

export interface CartItem {
  medicine: Medicine;
  quantity: number;
}

export type ViewType = 'pos' | 'inventory' | 'accounting' | 'expenses' | 'notifications';
