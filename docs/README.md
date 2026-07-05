# Coai Agent — PWA (Phase 1)

App web (PWA) chạy thẳng trên Safari iPhone, không cần Xcode, không cần Mac.
Đây là bản hiện thực Phase 1 của blueprint COAI: **Function Calling structure + nền tảng Background Service (service worker)** cho Gemini API.

## Chạy thử NGAY (không cần deploy)

1. Cài Node.js nếu chưa có, hoặc dùng bất kỳ static server nào. Cách nhanh nhất:
   ```bash
   cd CoAI-PWA
   python3 -m http.server 8000
   ```
2. Mở `http://localhost:8000` trên máy tính để test nhanh giao diện.
   (Service worker + "Add to Home Screen" cần chạy qua HTTPS thật, xem bước deploy bên dưới để test trên iPhone.)

## Deploy lên GitHub Pages để test trên iPhone (miễn phí, ~2 phút)

Cậu đã có repo `CoAI` trên GitHub rồi, nên làm luôn trên đó:

1. Copy toàn bộ nội dung thư mục `CoAI-PWA/` vào repo `CoAI` (ví dụ vào thư mục con `docs/`).
2. Vào repo trên GitHub → **Settings → Pages** → chọn source là branch `main`, thư mục `/docs`.
3. Đợi 1-2 phút, GitHub sẽ cấp link dạng `https://<username>.github.io/CoAI/`.
4. Mở link đó bằng **Safari** trên iPhone.
5. Bấm nút Share (hình vuông có mũi tên) → **"Thêm vào MH chính" (Add to Home Screen)**.
6. Giờ Coai đã có icon riêng trên iPhone, mở full-screen như app thật.

## Lấy Gemini API Key

1. Vào https://aistudio.google.com/app/apikey
2. Tạo key mới (miễn phí, có giới hạn quota).
3. Mở app Coai → bấm ⚙ (góc trên phải) → dán key vào ô "Gemini API Key" → Lưu.

## Cấu trúc code (map với blueprint — đã đủ khung sườn Phase 1-5)

| File | Vai trò trong blueprint |
|---|---|
| `js/gemini-client.js` | Gọi Gemini API + vòng lặp Function Calling (`runAgentTurn`) — "Dynamic Intent Router" |
| `js/tool-registry.js` | Đăng ký/thực thi tool, guardrail khi lỗi — "Self-Healing & Guardrails" |
| `js/tools/example-tools.js` | Tool mẫu: giờ, pin, rung, mạng, vị trí, nhắc nhở — chỗ thêm "BYO-API Integration" |
| `js/vault/crypto.js` + `vault-db.js` | Mã hóa AES-GCM + IndexedDB — "Local Data Vault" (Phase 2) |
| `js/vault/embeddings.js` | Sinh vector embedding qua Gemini — phục vụ tìm kiếm ngữ nghĩa trong Vault |
| `js/hal/hal-interface.js` | Hardware Abstraction Layer — rung, vị trí, mạng, notification, stub IoT (Phase 3) |
| `js/multimodal/file-pipeline.js` | Đọc ảnh/PDF/code/txt, chuyển thành part gửi Gemini (Phase 4) |
| `js/multi-agent/agent-simulation.js` | Dev → Tester → PM phản biện tuần tự (Phase 5) |
| `service-worker.js` | Cache app shell — bước đầu "Local Fallback" |
| Web Speech API trong `app.js` | Điểm khởi đầu "Voice Live" (chưa phải audio-to-audio streaming thật) |

## Cách dùng tính năng mới

- **Multi-Agent**: bật toggle "🧑‍💻 Multi-Agent" phía trên ô nhập, gõ câu hỏi/bài toán → thấy lần lượt Dev, Tester, PM phản hồi.
- **Đính kèm file**: bấm 📎, chọn ảnh/PDF/code/txt → gõ thêm câu hỏi (hoặc để trống) → Gửi.
- **Vault (bộ nhớ dài hạn)**: mở ⚙ Cài đặt → đặt mật khẩu Vault → "Mở khóa Vault". Sau đó Coai có thể tự dùng tool `save_memory`/`search_memory` khi trò chuyện. **Vault tự khóa lại mỗi khi tải lại trang** — cần mở khóa lại mỗi phiên (đây là chủ đích, không phải bug).

## Giới hạn hiện tại (thành thật với cậu)

- **Vault mã hóa thật (AES-GCM) nhưng API key/lịch sử chat thường vẫn ở `localStorage` chưa mã hóa** — ai đụng được máy/trình duyệt vẫn đọc được 2 thứ đó. Đủ dùng để test, KHÔNG dùng cho dữ liệu nhạy cảm thật.
- **Không có Background Sync thật khi app đóng** — iOS Safari giới hạn PWA chạy nền rất chặt.
- **HAL chỉ làm được những gì Safari cho phép** — rung/vị trí/mạng/notification có thật, nhưng IoT Gateway (Bluetooth/HomeKit) chỉ là stub trả về "chưa hỗ trợ".
- **Multi-Agent chạy tuần tự, không song song thật** — vẫn tốn 3 lần gọi API cho 1 câu hỏi.
- Muốn có bản đầy đủ (Haptic pattern riêng, HAL sâu, background service thật) → cần app native (Swift/Xcode) — đúng hướng cậu định làm khi có Mac.

## Tiếp theo: port sang Xcode

Khi cậu ngồi vào Mac, mỗi module JS ở trên có thể map 1-1 sang Swift:
- `gemini-client.js` → `URLSession` + Codable (đã có bản Swift nháp ở phần đầu hội thoại)
- `vault/*` → `CryptoKit` + Core Data/SQLite
- `hal-interface.js` → `CoreHaptics`, `CoreLocation`, `Network`, `UNUserNotificationCenter`, `CoreBluetooth`
- `multimodal/file-pipeline.js` → `PhotosUI`, `PDFKit`, `UIDocumentPickerViewController`
- `multi-agent/agent-simulation.js` → logic giữ nguyên, chỉ đổi cách gọi API
