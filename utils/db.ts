// utils/db.ts

const DB_NAME = 'AxiomZeroDB';
const STORE_NAME = 'documents';
const DB_VERSION = 3;

/**
 * Initializes the Native IndexedDB connection.
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      console.error('IndexedDB Initialization Error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

/**
 * Saves or updates a document with its vectors, chunks, and message history.
 */
export const saveDocument = async (
  id: string, 
  name: string, 
  chunks: any[], 
  vectors: any[], 
  fileBuffer: ArrayBuffer, 
  messages: any[] = []
): Promise<boolean> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const doc = { 
        id, 
        name, 
        chunks, 
        vectors, 
        fileBuffer, 
        messages, 
        timestamp: Date.now() 
    };

    const request = store.put(doc);
    
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Fetches a specific document by its ID.
 */
export const getDocument = async (id: string): Promise<any> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Fetches all saved documents (sorted by most recently interacted with).
 */
export const getAllSavedDocuments = async (): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const docs = request.result || [];
      docs.sort((a, b) => b.timestamp - a.timestamp);
      resolve(docs);
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Updates the chat message history for an active document.
 */
export const updateDocumentMessages = async (id: string, messages: any[]): Promise<boolean> => {
  const doc = await getDocument(id);
  if (!doc) return false;

  doc.messages = messages;
  doc.timestamp = Date.now(); // Bump timestamp to push to top of sidebar
  
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(doc);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Deletes a specific document and its vectors from memory.
 */
export const deleteDocument = async (id: string): Promise<boolean> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Wipes the entire database clean.
 */
export const clearDB = async (): Promise<boolean> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};