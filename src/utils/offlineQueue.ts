export type PendingScan = {
  id: string;
  empId: string;
  employeeName: string;
  serialNumber: string;
  action: "CHECK_IN" | "CHECK_OUT";
  createdAt: number;
};

const DB_NAME = "minet_offline";
const DB_VERSION = 1;
const STORE = "pending_scans";

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("createdAt_idx", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const addPendingScan = async (scan: Omit<PendingScan, "id" | "createdAt">) => {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const record: PendingScan = { id, createdAt: Date.now(), ...scan };
  await new Promise<void>((resolve, reject) => {
    const r = store.add(record);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  db.close();
  return record;
};

export const getAllPendingScans = async (): Promise<PendingScan[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const result = await new Promise<PendingScan[]>((resolve, reject) => {
    const out: PendingScan[] = [];
    const req = store.index("createdAt_idx").openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        out.push(cursor.value as PendingScan);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
};

export const getPendingCount = async (): Promise<number> => {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const count = await new Promise<number>((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return count;
};

export const removePendingScan = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  await new Promise<void>((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
};
