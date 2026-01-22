
export interface Medicine {
  id?: number;
  name: string;
  barcode: string;
  price: number;
  costPrice: number;
  stock: number;
  category: string;
  expiryDate: string;
  addedDate: string; 
  supplier: string;
  usageCount: number;
  lastSold?: number;
}

export interface AppNotification {
  id?: number;
  message: string;
  type: 'warning' | 'error' | 'info';
  timestamp: number;
}

export interface Expense {
  id?: number;
  amount: number;
  type: string;
  description: string;
  timestamp: number;
}

export interface Customer {
  id?: number;
  name: string;
}

export interface Sale {
  id?: number;
  totalAmount: number;
  discount: number;
  netAmount: number;
  cashAmount: number;
  bankAmount: number;
  debtAmount: number;
  bankTrxId?: string;
  customerName?: string;
  totalCost: number;
  profit: number;
  timestamp: number;
  itemsJson: string; 
  isReturned?: boolean;
}

export interface CartItem {
  medicine: Medicine;
  quantity: number;
}

export type ViewType = 'pos' | 'accounting' | 'inventory' | 'expenses' | 'notifications';
