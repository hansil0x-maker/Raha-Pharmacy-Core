
import { Dexie, type Table } from 'dexie';
import { Medicine, Sale, Expense, Customer, AppNotification } from './types';

// Use named import for Dexie to ensure proper type inheritance.
// In many modern TypeScript environments, extending the named export 'Dexie' 
// correctly resolves the class constructor and all inherited methods like version() and transaction().
export class RahaDB extends Dexie {
  medicines!: Table<Medicine, number>;
  sales!: Table<Sale, number>;
  expenses!: Table<Expense, number>;
  customers!: Table<Customer, number>;
  notifications!: Table<AppNotification, number>;

  constructor() {
    super('RahaDB');
    // Define database schema version and tables
    // The version method is inherited from the Dexie base class.
    // Fix: Using named import for Dexie ensures 'this.version' is recognized by TypeScript.
    this.version(8).stores({
      medicines: '++id, name, barcode, category, supplier, addedDate, expiryDate, usageCount, lastSold',
      sales: '++id, timestamp, customerName, isReturned',
      expenses: '++id, timestamp, type',
      customers: '++id, name',
      notifications: '++id, timestamp'
    });
  }
}

export const db = new RahaDB();
