
import Dexie, { Table } from 'dexie';
import { Medicine, Sale } from './types';

// Define the database class extending Dexie
export class PharmacyDB extends Dexie {
  // Explicitly define tables with their types and primary key types (number)
  medicines!: Table<Medicine, number>;
  sales!: Table<Sale, number>;

  constructor() {
    super('PharmacyDB');
    
    // Configure the database version and schema inside the constructor
    // Fix: Use the inherited version() method to define stores. 
    // Removed '*' from indices as 'name' and 'barcode' are strings, not arrays.
    this.version(2).stores({
      medicines: '++id, name, barcode, stock, expiryDate, category',
      sales: '++id, timestamp'
    });
  }
}

export const db = new PharmacyDB();
