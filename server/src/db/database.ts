import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../../data');

export interface DatabaseSchema {
  tasks: any[];
  batches: any[];
  warnings: any[];
  approvals: any[];
  adjustments: any[];
  recommendations: any[];
  dailyStats: any[];
  mask_models: any[];
}

const DEFAULT_DATA: DatabaseSchema = {
  tasks: [],
  batches: [],
  warnings: [],
  approvals: [],
  adjustments: [],
  recommendations: [],
  dailyStats: [],
  mask_models: []
};

class Database {
  private data: DatabaseSchema;
  private filePath: string;

  constructor() {
    this.filePath = path.join(DATA_DIR, 'db.json');
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load database, using default:', error);
    }
    
    this.save(DEFAULT_DATA);
    return { ...DEFAULT_DATA };
  }

  private save(data: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save database:', error);
    }
  }

  getAll<K extends keyof DatabaseSchema>(collection: K): DatabaseSchema[K] {
    return [...this.data[collection]] as any;
  }

  findOne<K extends keyof DatabaseSchema>(
    collection: K, 
    predicate: (item: DatabaseSchema[K][number]) => boolean
  ): DatabaseSchema[K][number] | undefined {
    return this.data[collection].find(predicate) as any;
  }

  find<K extends keyof DatabaseSchema>(
    collection: K, 
    predicate?: (item: DatabaseSchema[K][number]) => boolean
  ): DatabaseSchema[K] {
    if (!predicate) {
      return [...this.data[collection]] as any;
    }
    return this.data[collection].filter(predicate) as any;
  }

  create<K extends keyof DatabaseSchema>(
    collection: K, 
    item: DatabaseSchema[K][number]
  ): DatabaseSchema[K][number] {
    (this.data[collection] as any[]).push(item);
    this.save(this.data);
    return item;
  }

  update<K extends keyof DatabaseSchema>(
    collection: K,
    predicate: (item: DatabaseSchema[K][number]) => boolean,
    updates: Partial<DatabaseSchema[K][number]>
  ): DatabaseSchema[K][number] | undefined {
    const index = this.data[collection].findIndex(predicate as any);
    if (index === -1) return undefined;
    
    (this.data[collection] as any[])[index] = {
      ...(this.data[collection] as any[])[index],
      ...updates
    };
    this.save(this.data);
    return (this.data[collection] as any[])[index];
  }

  remove<K extends keyof DatabaseSchema>(
    collection: K,
    predicate: (item: DatabaseSchema[K][number]) => boolean
  ): boolean {
    const index = this.data[collection].findIndex(predicate as any);
    if (index === -1) return false;
    
    (this.data[collection] as any[]).splice(index, 1);
    this.save(this.data);
    return true;
  }

  count<K extends keyof DatabaseSchema>(
    collection: K,
    predicate?: (item: DatabaseSchema[K][number]) => boolean
  ): number {
    if (!predicate) {
      return this.data[collection].length;
    }
    return this.data[collection].filter(predicate as any).length;
  }
}

export const db = new Database();
