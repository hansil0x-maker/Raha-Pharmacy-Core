
import Dexie from 'dexie';
import type { Table } from 'dexie';
import { Medicine, Sale } from './types';

// Use default import for Dexie to ensure full class functionality is inherited correctly in TypeScript
export class PharmacyDB extends Dexie {
  medicines!: Table<Medicine, number>;
  sales!: Table<Sale, number>;

  constructor() {
    super('PharmacyDB');
    
    // Define the schema for the database. version() is a core Dexie method.
    this.version(3).stores({
      medicines: '++id, name, barcode, stock, expiryDate, category, salesCount',
      sales: '++id, timestamp'
    });
  }
}

export const db = new PharmacyDB();
