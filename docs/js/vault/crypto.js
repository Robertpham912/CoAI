// Privacy-First Encryption (bản web): dùng Web Crypto API (AES-GCM 256-bit).
// Key được dẫn xuất từ passphrase của người dùng qua PBKDF2 — KHÔNG lưu passphrase ở đâu cả.
// Nếu người dùng quên passphrase, dữ liệu không thể phục hồi — đúng tinh thần Zero-Knowledge
// (kể cả Coai cũng không có cách nào đọc được nếu không có passphrase).

const VaultCrypto = (() => {
  const PBKDF2_ITERATIONS = 210_000; // khuyến nghị OWASP 2023+ cho SHA-256

  async function deriveKey(passphrase, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // Trả về object gói gọn { salt, iv, ciphertext } đều dạng base64, sẵn sàng để lưu.
  async function encrypt(plainObject, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);

    const enc = new TextEncoder();
    const plaintext = enc.encode(JSON.stringify(plainObject));

    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

    return {
      salt: bufferToBase64(salt),
      iv: bufferToBase64(iv),
      ciphertext: bufferToBase64(ciphertext)
    };
  }

  async function decrypt(envelope, passphrase) {
    const salt = base64ToBuffer(envelope.salt);
    const iv = base64ToBuffer(envelope.iv);
    const ciphertext = base64ToBuffer(envelope.ciphertext);
    const key = await deriveKey(passphrase, salt);

    const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(plaintextBuf));
  }

  function bufferToBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  function base64ToBuffer(base64) {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  return { encrypt, decrypt };
})();
