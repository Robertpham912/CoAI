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

const STORAGE_KEYS = { apiKey: "coai_api_key", model: "coai_model", history: "coai_history" };

const registry = new ToolRegistry(EXAMPLE_TOOLS);

let history = loadHistory();
let client = new GeminiClient({
  apiKey: localStorage.getItem(STORAGE_KEYS.apiKey) || "",
  model: localStorage.getItem(STORAGE_KEYS.model) || undefined
});

const SYSTEM_INSTRUCTION =
  "Bạn là Coai, một trợ lý agentic OS trên iPhone. Trả lời ngắn gọn, tiếng Việt, thân thiện. " +
  "Dùng tool khi cần dữ liệu thực tế (giờ, pin, đặt nhắc nhở) thay vì đoán.";

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
  if (!text.trim()) return;

  renderMessage("user", text);
  history.push({ role: "user", parts: [{ text }] });
  saveHistory();

  textInput.value = "";
  setThinking(true);

  try {
    if (!navigator.onLine) {
      throw new Error("OFFLINE_FALLBACK");
    }

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
