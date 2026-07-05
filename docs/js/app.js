const chatEl = document.getElementById("chat");
const emptyState = document.getElementById("emptyState");
const composer = document.getElementById("composer");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const orb = document.getElementById("orb");

const settingsBtn = document.getElementById("settingsBtn");
const modalBackdrop = document.getElementById("modalBackdrop");
const apiKeyInput = document.getElementById("apiKeyInput");
const modelInput = document.getElementById("modelInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const offlineBanner = document.getElementById("offlineBanner");

const multiAgentToggle = document.getElementById("multiAgentToggle");
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const attachPreview = document.getElementById("attachPreview");
const vaultPassInput = document.getElementById("vaultPassInput");
const unlockVaultBtn = document.getElementById("unlockVaultBtn");
const vaultStatus = document.getElementById("vaultStatus");

const STORAGE_KEYS = { apiKey: "coai_api_key", model: "coai_model", history: "coai_history" };

const registry = new ToolRegistry(EXAMPLE_TOOLS);
let pendingFilePart = null; // part multimodal đang chờ gửi kèm tin nhắn tiếp theo

let history = loadHistory();
let client = new GeminiClient({
  apiKey: localStorage.getItem(STORAGE_KEYS.apiKey) || "",
  model: localStorage.getItem(STORAGE_KEYS.model) || undefined
});

const SYSTEM_INSTRUCTION =
  "Bạn là Coai, một trợ lý agentic OS trên iPhone. Trả lời ngắn gọn, tiếng Việt, thân thiện. " +
  "Dùng tool khi cần dữ liệu thực tế (giờ, pin, vị trí, đặt nhắc nhở, tra cứu bộ nhớ đã lưu) thay vì đoán.";

// ---------- Vault tools (Phase 2): đăng ký động vì cần API key để tạo embedding ----------

function registerVaultTools() {
  registry.register({
    name: "save_memory",
    description: "Lưu một thông tin quan trọng vào bộ nhớ dài hạn (Vault) để tra cứu lại sau này.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", description: "Nội dung cần ghi nhớ." } },
      required: ["text"]
    },
    execute: async (args) => {
      if (!Vault.isUnlocked()) return { error: "Vault đang khóa. Mở ⚙ Cài đặt để nhập mật khẩu Vault." };
      const embedding = await embedText(args.text, client.apiKey);
      const id = await Vault.addMemory({ text: args.text, embedding });
      return { saved: true, id };
    }
  });

  registry.register({
    name: "search_memory",
    description: "Tìm trong bộ nhớ dài hạn (Vault) những thông tin liên quan tới một chủ đề.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Chủ đề cần tìm." } },
      required: ["query"]
    },
    execute: async (args) => {
      if (!Vault.isUnlocked()) return { error: "Vault đang khóa. Mở ⚙ Cài đặt để nhập mật khẩu Vault." };
      const queryEmbedding = await embedText(args.query, client.apiKey);
      const results = await Vault.search(queryEmbedding, 5);
      return { results: results.map((r) => ({ text: r.text, score: r.score.toFixed(3) })) };
    }
  });
}
registerVaultTools();

// ---------- Render ----------

function renderMessage(role, text) {
  emptyState.style.display = "none";
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

function renderToolTrace(label) {
  emptyState.style.display = "none";
  const div = document.createElement("div");
  div.className = "msg tool";
  div.textContent = label;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setThinking(isThinking) {
  orb.classList.toggle("thinking", isThinking);
  sendBtn.disabled = isThinking;
}

// ---------- History persistence (Dynamic Context Cache tối giản) ----------

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  // Giới hạn độ dài để tránh phình localStorage
  const trimmed = history.slice(-40);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(trimmed));
}

function replayHistoryToUI() {
  history.forEach((turn) => {
    const textPart = turn.parts?.find((p) => p.text);
    if (!textPart) return;
    renderMessage(turn.role === "user" ? "user" : "agent", textPart.text);
  });
}

// ---------- Send flow ----------

async function sendUserMessage(text) {
  if (!text.trim() && !pendingFilePart) return;

  renderMessage("user", text || "(đã gửi kèm file)");

  const userParts = [];
  if (text) userParts.push({ text });
  if (pendingFilePart) {
    userParts.push(pendingFilePart.part);
    renderToolTrace(pendingFilePart.previewLabel);
  }
  history.push({ role: "user", parts: userParts });
  saveHistory();

  pendingFilePart = null;
  attachPreview.textContent = "";

  textInput.value = "";
  setThinking(true);

  try {
    if (!navigator.onLine) {
      throw new Error("OFFLINE_FALLBACK");
    }

    if (multiAgentToggle.checked) {
      // Multi-Agent Simulation (Phase 5): không dùng tool loop, chạy 3 vai tuần tự.
      const finalAnswer = await runMultiAgentSimulation({
        client,
        question: text,
        onEvent: (event) => renderToolTrace(`🧑‍💻 [${event.label}]: ${event.text}`)
      });
      renderMessage("agent", finalAnswer);
      history.push({ role: "model", parts: [{ text: finalAnswer }] });
    } else {
      await runAgentTurn({
        client,
        registry,
        history,
        systemInstruction: SYSTEM_INSTRUCTION,
        onEvent: (event) => {
          if (event.type === "tool_call") {
            renderToolTrace(`🔧 gọi tool: ${event.name}(${JSON.stringify(event.args || {})})`);
          } else if (event.type === "tool_result") {
            renderToolTrace(`✅ kết quả: ${JSON.stringify(event.result)}`);
          } else if (event.type === "final_text") {
            renderMessage("agent", event.text);
          }
        }
      });
    }

    saveHistory();
  } catch (err) {
    if (err.message === "OFFLINE_FALLBACK") {
      renderMessage("error", localFallbackResponse(text));
    } else {
      renderMessage("error", err.message || "Có lỗi xảy ra.");
    }
  } finally {
    setThinking(false);
  }
}

// Local Fallback tối giản: trả lời cơ bản khi mất mạng, không gọi được Gemini.
function localFallbackResponse(text) {
  return "Đang ngoại tuyến nên Coai chưa gọi được Gemini. Coai đã lưu tin nhắn của cậu, sẽ trả lời khi có mạng lại.";
}

// ---------- Events ----------

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  sendUserMessage(textInput.value);
});

settingsBtn.addEventListener("click", () => {
  apiKeyInput.value = localStorage.getItem(STORAGE_KEYS.apiKey) || "";
  modelInput.value = localStorage.getItem(STORAGE_KEYS.model) || GEMINI_CONFIG.defaultModel;
  modalBackdrop.classList.add("open");
});

modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) modalBackdrop.classList.remove("open");
});

saveSettingsBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || GEMINI_CONFIG.defaultModel;
  localStorage.setItem(STORAGE_KEYS.apiKey, key);
  localStorage.setItem(STORAGE_KEYS.model, model);
  client = new GeminiClient({ apiKey: key, model });
  modalBackdrop.classList.remove("open");
});

clearHistoryBtn.addEventListener("click", () => {
  history = [];
  localStorage.removeItem(STORAGE_KEYS.history);
  chatEl.innerHTML = "";
  chatEl.appendChild(emptyState);
  emptyState.style.display = "block";
  modalBackdrop.classList.remove("open");
});

// ---------- Multimodal file attach (Phase 4) ----------

attachBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const { part, previewLabel } = await MultimodalPipeline.fileToGeminiPart(file);
  attachPreview.textContent = previewLabel;
  pendingFilePart = part ? { part, previewLabel } : null;
  fileInput.value = ""; // cho phép chọn lại cùng 1 file lần sau
});

// ---------- Vault unlock (Phase 2) ----------

unlockVaultBtn.addEventListener("click", () => {
  const pass = vaultPassInput.value;
  if (!pass) {
    vaultStatus.textContent = "Vault: cần nhập mật khẩu trước.";
    return;
  }
  Vault.unlock(pass);
  vaultStatus.textContent = "Vault: đã mở khóa ✅ (chỉ trong phiên này)";
});

// ---------- Voice input (Web Speech API — nền tảng cho "Voice Live" sau này) ----------

let recognizer = null;
let isRecording = false;

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const r = new SpeechRecognition();
  r.lang = "vi-VN";
  r.continuous = false;
  r.interimResults = false;

  r.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    sendUserMessage(transcript);
  };
  r.onend = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
  };
  r.onerror = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
  };
  return r;
}

recognizer = setupSpeechRecognition();

micBtn.addEventListener("click", () => {
  if (!recognizer) {
    renderMessage("error", "Thiết bị/trình duyệt này chưa hỗ trợ ghi âm giọng nói trực tiếp (Web Speech API). Safari trên iOS hiện hạn chế tính năng này.");
    return;
  }
  if (isRecording) {
    recognizer.stop();
    return;
  }
  isRecording = true;
  micBtn.classList.add("recording");
  recognizer.start();
});

// ---------- Offline detection ----------

function updateOnlineStatus() {
  offlineBanner.classList.toggle("show", !navigator.onLine);
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// ---------- Init ----------

replayHistoryToUI();

// Đăng ký service worker (nền tảng cho background/offline behavior)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
