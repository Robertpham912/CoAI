// Tương đương ToolRegistry + ToolExecutor bên bản Swift.

class ToolRegistry {
  constructor(tools = []) {
    this.tools = new Map();
    tools.forEach((t) => this.register(t));
  }

  register(tool) {
    this.tools.set(tool.name, tool);
  }

  get(name) {
    return this.tools.get(name);
  }

  // Định dạng khai báo gửi lên Gemini API (field "tools")
  geminiDeclarations() {
    if (this.tools.size === 0) return undefined;
    return [{
      function_declarations: Array.from(this.tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))
    }];
  }

  // Self-Healing & Guardrails: tool lỗi không làm sập app, trả lỗi có cấu trúc
  // để Gemini tự quyết định bước tiếp theo.
  async handleFunctionCall(functionCall) {
    const tool = this.get(functionCall.name);
    if (!tool) {
      return { name: functionCall.name, response: { error: `Tool '${functionCall.name}' không tồn tại.` } };
    }
    try {
      const result = await tool.execute(functionCall.args || {});
      return { name: functionCall.name, response: result };
    } catch (err) {
      return {
        name: functionCall.name,
        response: { error: err.message || String(err), recoverable: true }
      };
    }
  }
}
