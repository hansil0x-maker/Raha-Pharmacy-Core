
export interface Medicine {
  id?: number;
  name: string;
  barcode: string;
  price: number;
  costPrice: number;
  stock: number;
  category: string;
  expiryDate: string;
}

export type PaymentMethod = 'cash' | 'bank' | 'credit';

export interface Sale {
  id?: number;
  totalAmount: number;
  totalCost: number;
  timestamp: number;
  itemsJson: string; // List of {name, price, costPrice, quantity}
  paymentMethod: PaymentMethod;
}

export interface CartItem {
  medicine: Medicine;
  quantity: number;
}

export type ViewType = 'pos' | 'accounting';
