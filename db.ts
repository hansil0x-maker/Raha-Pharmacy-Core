
import { Dexie, type Table } from 'dexie';
import { Medicine, Sale, Expense, Customer, AppNotification } from './types';
import { createClient } from '@supabase/supabase-js';

// تهيئة عميل Supabase باستخدام المتغيرات العالمية المعرفة في index.html
const SUPABASE_URL = (window as any).SUPABASE_URL || '';
const SUPABASE_KEY = (window as any).SUPABASE_KEY || '';

export const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;

export class RahaDB extends Dexie {
  medicines!: Table<Medicine, number>;
  sales!: Table<Sale, number>;
  expenses!: Table<Expense, number>;
  customers!: Table<Customer, number>;
  notifications!: Table<AppNotification, number>;

  constructor() {
    super('RahaDB');
    
    // الحفاظ على إصدار قاعدة البيانات وهيكلة الجداول كما هي
    (this as any).version(8).stores({
      medicines: '++id, name, barcode, category, supplier, addedDate, expiryDate, usageCount, lastSold',
      sales: '++id, timestamp, customerName, isReturned',
      expenses: '++id, timestamp, type',
      customers: '++id, name',
      notifications: '++id, timestamp'
    });

    // إضافة خطافات التزامن السحابي (Cloud Sync Hooks)
    // يتم استخدام setTimeout لضمان تنفيذ المزامنة بعد اكتمال المعاملة المحلية وتوفر المعرف (ID)
    
    this.medicines.hook('creating', (primKey, obj) => {
      if (supabase) {
        setTimeout(async () => {
          try {
            await supabase.from('medicines').upsert({ ...obj });
          } catch (e) {
            console.warn('Raha Cloud Sync: فشل مزامنة صنف جديد في جدول الأدوية', e);
          }
        }, 0);
      }
    });

    this.sales.hook('creating', (primKey, obj) => {
      if (supabase) {
        setTimeout(async () => {
          try {
            await supabase.from('sales').upsert({ ...obj });
          } catch (e) {
            console.warn('Raha Cloud Sync: فشل مزامنة عملية بيع جديدة', e);
          }
        }, 0);
      }
    });

    // إضافة منطق التحديث لضمان دقة البيانات السحابية عند تعديل المخزون أو الأسعار
    this.medicines.hook('updating', (mods, primKey, obj) => {
      if (supabase) {
        setTimeout(async () => {
          try {
            await supabase.from('medicines').upsert({ ...obj, ...mods });
          } catch (e) {
            console.warn('Raha Cloud Sync: فشل تحديث البيانات السحابية للأدوية', e);
          }
        }, 0);
      }
    });
  }
}

export const db = new RahaDB();
