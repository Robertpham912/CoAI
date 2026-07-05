// Local Data Vault (Phase 2): "Vector Database" tối giản chạy trong trình duyệt.
// - Lưu trữ: IndexedDB (bền vững hơn localStorage, không giới hạn ~5MB)
// - Mã hóa: mỗi entry được mã hóa bằng VaultCrypto trước khi ghi xuống đĩa
// - Tìm kiếm ngữ nghĩa: cosine similarity thủ công trên embedding vector
//   (đủ nhanh cho vài nghìn entry cá nhân; không cần thư viện vector DB chuyên dụng ở quy mô này)

const Vault = (() => {
  const DB_NAME = "coai_vault";
  const STORE_NAME = "memories";
  const DB_VERSION = 1;

  let dbPromise = null;
  let unlockedPassphrase = null; // chỉ giữ trong RAM khi vault đang "mở", KHÔNG bao giờ lưu xuống đĩa

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function unlock(passphrase) {
    unlockedPassphrase = passphrase;
  }

  function lock() {
    unlockedPassphrase = null;
  }

  function isUnlocked() {
    return unlockedPassphrase !== null;
  }

  // entry: { text, embedding: number[], metadata?: object }
  async function addMemory(entry) {
    if (!isUnlocked()) throw new Error("Vault đang khóa. Gọi Vault.unlock(passphrase) trước.");

    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const envelope = await VaultCrypto.encrypt(entry, unlockedPassphrase);

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ id, envelope, createdAt: Date.now() });
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAllDecrypted() {
    if (!isUnlocked()) throw new Error("Vault đang khóa.");

    const db = await openDB();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const decrypted = [];
    for (const record of records) {
      try {
        const entry = await VaultCrypto.decrypt(record.envelope, unlockedPassphrase);
        decrypted.push({ id: record.id, ...entry, createdAt: record.createdAt });
      } catch {
        // Sai passphrase hoặc dữ liệu hỏng — bỏ qua entry đó thay vì crash toàn bộ.
      }
    }
    return decrypted;
  }

  function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }

  // Tìm top-K memory liên quan nhất tới 1 embedding truy vấn.
  async function search(queryEmbedding, topK = 5) {
    const all = await getAllDecrypted();
    return all
      .map((m) => ({ ...m, score: cosineSimilarity(m.embedding, queryEmbedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async function deleteMemory(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function wipeAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return { unlock, lock, isUnlocked, addMemory, getAllDecrypted, search, deleteMemory, wipeAll };
})();
