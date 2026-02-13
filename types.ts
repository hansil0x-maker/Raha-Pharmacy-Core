// types.ts - النسخة المدمجة النهائية والشاملة

export type ViewType = 'pos' | 'inventory' | 'accounting' | 'expenses' | 'notifications';

export interface Medicine {
  id?: number;
  name: string;
  barcode: string;
  price: number;
  costPrice: number;
  stock: number;
  category: string;
  expiryDate: string;
  
  // دمج نوع التاريخ لدعم التوافق مع البيانات القديمة والجديدة
  addedDate?: number | string; 
  
  supplier?: string;
  supplierPhone?: string; // جديد
  
  usageCount?: number;
  lastSold?: number;
  
  // حقول نظام التجزئة والنواقص الذكي
  unitsPerPkg?: number;   // سعة العبوة (شريط/حبة)
  minStockAlert?: number; // حد التنبيه للنواقص
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
  bankTrxId: string;      // مطلوب للتدقيق المالي
  customerName: string;   // مطلوب لربط المبيعات بالعملاء
  totalCost: number;      // تكلفة البيعة (بناءً على العلبة)
  profit: number;         // صافي الربح
  timestamp: number;
  itemsJson: string;      // تفاصيل المنتجات المباعة
  isReturned: boolean;    // حالة المرتجع
}

export interface CartItem {
  medicine: Medicine;
  quantity: number;
}

// واجهة نظام النواقص - النسخة الشاملة
export interface WantedItem {
  id?: string; // UUID للسحاب
  itemName: string;
  notes?: string;
  requestCount: number;
  status: 'pending' | 'ordered' | 'received' | 'completed' | 'archived';
  createdAt: number;
  reminderAt?: number; // الحقل الذي كان ناقصاً وتمت إعادته
}