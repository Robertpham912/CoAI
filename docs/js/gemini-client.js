// Tương đương GeminiAPIClient bên bản Swift, port sang fetch() thuần.

const GEMINI_CONFIG = {
  // LƯU Ý: "Gemini 3.5 Flash" trong blueprint chưa chắc khớp tên model chính thức.
  // Kiểm tra tên đúng tại https://ai.google.dev/gemini-api/docs/models trước khi đổi.
  defaultModel: "gemini-2.0-flash",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/models"
};

class GeminiClient {
  constructor({ apiKey, model }) {
    this.apiKey = apiKey;
    this.model = model || GEMINI_CONFIG.defaultModel;
  }

  async generateContent({ contents, tools, systemInstruction }) {
    if (!this.apiKey) {
      throw new Error("Chưa có API Key. Mở Cài đặt (⚙) để nhập.");
    }

    const url = `${GEMINI_CONFIG.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      contents,
      ...(tools ? { tools } : {}),
      ...(systemInstruction ? { system_instruction: { role: "system", parts: [{ text: systemInstruction }] } } : {}),
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Lỗi HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();

    if (data.promptFeedback?.blockReason) {
      throw new Error(`Bị chặn bởi chính sách nội dung: ${data.promptFeedback.blockReason}`);
    }

    return data;
  }
}

/**
 * Dynamic Intent Router (bản tối giản):
 * Gửi hội thoại lên Gemini, nếu model trả về functionCall thì thực thi tool tương ứng,
 * feed kết quả ngược lại, lặp tiếp cho tới khi model trả về text cuối cùng.
 *
 * onEvent(event) được gọi để UI cập nhật theo từng bước:
 *   { type: "tool_call", name, args }
 *   { type: "tool_result", name, result }
 *   { type: "final_text", text }
 */
async function runAgentTurn({ client, registry, history, systemInstruction, onEvent, maxSteps = 4 }) {
  const tools = registry.geminiDeclarations();
  let steps = 0;

  while (steps < maxSteps) {
    steps += 1;

    const data = await client.generateContent({ contents: history, tools, systemInstruction });
    const candidate = data.candidates?.[0];
    if (!candidate) {
      onEvent({ type: "final_text", text: "Coai không nhận được phản hồi hợp lệ từ mô hình." });
      return;
    }

    const parts = candidate.content?.parts || [];
    history.push({ role: "model", parts });

    const functionCallPart = parts.find((p) => p.functionCall);

    if (functionCallPart) {
      const fc = functionCallPart.functionCall;
      onEvent({ type: "tool_call", name: fc.name, args: fc.args });

      const functionResponse = await registry.handleFunctionCall(fc);
      onEvent({ type: "tool_result", name: functionResponse.name, result: functionResponse.response });

      history.push({
        role: "function",
        parts: [{ functionResponse }]
      });
      continue; // lặp lại: gửi kết quả tool lên cho model đọc tiếp
    }

    const textPart = parts.find((p) => p.text);
    onEvent({ type: "final_text", text: textPart?.text || "(không có nội dung)" });
    return;
  }

  onEvent({ type: "final_text", text: "Coai dừng lại vì vòng lặp gọi tool vượt giới hạn an toàn." });
}
