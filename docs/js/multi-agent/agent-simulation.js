// Multi-Agent Simulation (Phase 5): thay vì 1 lần gọi Gemini, chạy tuần tự nhiều "vai" với
// system instruction khác nhau, mỗi vai phản biện câu trả lời của vai trước, cuối cùng PM
// tổng hợp thành giải pháp cuối. Đây là bản tuần tự đơn giản (không phải song song thật),
// đủ để mô phỏng ý tưởng "multi-agent debate" trong blueprint.

const AGENT_ROLES = [
  {
    key: "dev",
    label: "Dev",
    systemInstruction: "Bạn là một Senior Developer khó tính. Đưa ra giải pháp kỹ thuật cụ thể, khả thi. Chỉ ra rủi ro triển khai nếu có."
  },
  {
    key: "tester",
    label: "Tester",
    systemInstruction: "Bạn là một QA Engineer đa nghi. Đọc đề xuất của Dev, chỉ ra các edge case, lỗ hổng, tình huống dễ vỡ mà Dev có thể đã bỏ sót. Không tự đưa giải pháp thay Dev, chỉ phản biện."
  },
  {
    key: "pm",
    label: "PM",
    systemInstruction: "Bạn là Product Manager. Đọc đề xuất của Dev và phản biện của Tester, đưa ra quyết định cuối cùng: giữ gì, sửa gì, đánh đổi gì. Trả lời ngắn gọn, rõ ràng, có thể hành động ngay."
  }
];

/**
 * Chạy mô phỏng multi-agent cho 1 câu hỏi/bài toán.
 * onEvent({ role, label, text }) được gọi sau mỗi vai trả lời để UI hiển thị tiến trình.
 * Trả về bản tổng hợp cuối cùng (câu trả lời của PM).
 */
async function runMultiAgentSimulation({ client, question, onEvent }) {
  let transcript = `Bài toán / yêu cầu ban đầu:\n${question}`;
  let finalAnswer = "";

  for (const role of AGENT_ROLES) {
    const contents = [{ role: "user", parts: [{ text: transcript }] }];

    const data = await client.generateContent({
      contents,
      systemInstruction: role.systemInstruction
    });

    const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text || "(không có phản hồi)";

    onEvent({ role: role.key, label: role.label, text });

    transcript += `\n\n[Ý kiến của ${role.label}]:\n${text}`;
    finalAnswer = text; // vai cuối cùng (PM) là câu trả lời tổng hợp
  }

  return finalAnswer;
}
