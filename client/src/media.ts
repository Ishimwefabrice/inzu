const DB_NAME = "inzu-media-v1";
const STORE = "files";
const PHOTO_MAX = 2 * 1024 * 1024; // 2 MB
const DOC_MAX = 5 * 1024 * 1024; // 5 MB
const MAX_DOCS_PER_PERSON = 8;

export type MediaKind = "photo" | "doc";

export type MediaMeta = {
  id: string;
  personId: string;
  kind: MediaKind;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
};

export type MediaRecord = MediaMeta & { blob: Blob };

export type BackupFile = MediaMeta & { dataBase64: string };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("personId", "personId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB aborted"));
  });
}

export function photoLimitBytes() {
  return PHOTO_MAX;
}

export function docLimitBytes() {
  return DOC_MAX;
}

export function maxDocsPerPerson() {
  return MAX_DOCS_PER_PERSON;
}

export async function putMedia(record: MediaRecord) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(record);
  await txDone(tx);
  db.close();
}

export async function getMedia(id: string): Promise<MediaRecord | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).get(id);
  const result = await new Promise<MediaRecord | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as MediaRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return result || null;
}

export async function deleteMedia(id: string) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function deleteMediaForPerson(personId: string) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const index = store.index("personId");
  const req = index.getAllKeys(personId);
  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  for (const key of keys) store.delete(key);
  await txDone(tx);
  db.close();
}

export async function listMediaForPerson(personId: string): Promise<MediaRecord[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).index("personId").getAll(personId);
  const rows = await new Promise<MediaRecord[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as MediaRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows;
}

export async function exportAllMedia(): Promise<BackupFile[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).getAll();
  const rows = await new Promise<MediaRecord[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as MediaRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();

  const out: BackupFile[] = [];
  for (const row of rows) {
    const dataBase64 = await blobToBase64(row.blob);
    out.push({
      id: row.id,
      personId: row.personId,
      kind: row.kind,
      name: row.name,
      mime: row.mime,
      size: row.size,
      createdAt: row.createdAt,
      dataBase64,
    });
  }
  return out;
}

export async function importMediaFiles(files: BackupFile[]) {
  for (const file of files) {
    const blob = base64ToBlob(file.dataBase64, file.mime);
    await putMedia({
      id: file.id,
      personId: file.personId,
      kind: file.kind,
      name: file.name,
      mime: file.mime,
      size: file.size || blob.size,
      createdAt: file.createdAt,
      blob,
    });
  }
}

export async function clearAllMedia() {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).clear();
  await txDone(tx);
  db.close();
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "photoType";
  if (file.size > PHOTO_MAX) return "photoTooBig";
  return null;
}

export function validateDocFile(file: File): string | null {
  const ok =
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.type.startsWith("text/") ||
    file.type === "application/msword" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!ok) return "docType";
  if (file.size > DOC_MAX) return "docTooBig";
  return null;
}

export function objectUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mime: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}
