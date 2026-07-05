// Sinh embedding vector cho text bằng Gemini Embedding API.
// Dùng chung API key với GeminiClient (lấy từ localStorage ở app.js).

const EMBEDDING_MODEL = "text-embedding-004"; // kiểm tra tên model mới nhất khi dùng thật

async function embedText(text, apiKey) {
  if (!apiKey) throw new Error("Chưa có API Key để tạo embedding.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] } })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lỗi tạo embedding (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.embedding?.values;
}
