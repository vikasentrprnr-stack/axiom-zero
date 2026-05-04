// utils/db.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AxiomDB extends DBSchema {
  documents: {
    key: string;
    value: {
      id: string; 
      name: string; 
      chunks: any[]; 
      vectors: any[];
      fileBuffer: ArrayBuffer; 
      messages: any[]; 
      timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<AxiomDB>> | null = null;

const getDB = async () => {
  if (!dbPromise) {
    dbPromise = openDB<AxiomDB>('AxiomZeroDB', 1, {
      upgrade(db) { 
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' }); 
        }
      },
      terminated() {
        // If the browser terminates the connection unexpectedly
        dbPromise = null;
      }
    });
  }
  
  const db = await dbPromise;
  
  // THE FIX: Test the connection. Next.js HMR often closes the DB silently.
  // If it's closed, it throws an InvalidStateError. We catch it and reconnect instantly.
  try {
    db.transaction('documents', 'readonly');
  } catch (error: any) {
    if (error.name === 'InvalidStateError') {
      dbPromise = null;
      return getDB(); // Recursively fetch a fresh, live connection
    }
    throw error;
  }
  
  return db;
};

export const saveDocument = async (id: string, name: string, chunks: any[], vectors: any[], fileBuffer: ArrayBuffer, messages: any[] = []) => {
  const db = await getDB();
  await db.put('documents', { id, name, chunks, vectors, fileBuffer, messages, timestamp: Date.now() });
};

export const updateDocumentMessages = async (id: string, messages: any[]) => {
  const db = await getDB();
  const doc = await db.get('documents', id);
  if (doc) {
    doc.messages = messages;
    await db.put('documents', doc);
  }
};

export const getAllSavedDocuments = async () => {
  const db = await getDB();
  const docs = await db.getAll('documents');
  return docs.sort((a, b) => b.timestamp - a.timestamp);
};

export const clearDB = async () => {
  const db = await getDB();
  await db.clear('documents');
};