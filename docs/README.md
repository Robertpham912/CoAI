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

## Cấu trúc code (map với blueprint)

| File | Vai trò trong blueprint |
|---|---|
| `js/gemini-client.js` | Gọi Gemini API + vòng lặp Function Calling (`runAgentTurn`) — chính là "Dynamic Intent Router" bản tối giản |
| `js/tool-registry.js` | Đăng ký/thực thi tool, có guardrail khi tool lỗi — nền cho "Self-Healing & Guardrails" |
| `js/tools/example-tools.js` | 3 tool mẫu: giờ hiện tại, pin thiết bị, đặt nhắc nhở — chỗ để thêm "BYO-API Integration" sau này |
| `service-worker.js` | Cache app shell — bước đầu của "Local Fallback" khi mất mạng |
| `js/app.js` | UI, lưu lịch sử vào localStorage — bản tối giản của "Dynamic Context Cache" |
| Web Speech API trong `app.js` | Điểm khởi đầu cho "Voice Live" (chưa phải audio-to-audio streaming thật) |

## Giới hạn hiện tại (thành thật với cậu)

- **Không mã hóa Zero-Knowledge thật** — API key và lịch sử chat đang nằm ở `localStorage`, ai đụng được máy/trình duyệt là đọc được. Đủ dùng để test, KHÔNG dùng cho dữ liệu nhạy cảm thật.
- **Không có Background Sync thật khi app đóng** — iOS Safari giới hạn PWA chạy nền rất chặt, service worker chỉ giúp cache/offline chứ chưa "thức dậy" định kỳ như blueprint mô tả.
- **Không điều khiển được phần cứng** (Hardware Control Gateway, Haptic pattern riêng) — web không có quyền truy cập sâu vào phần cứng iPhone như app native.
- Muốn có 3 thứ trên đầy đủ → bắt buộc phải quay lại app native (Swift/Xcode) ở giai đoạn sau, khi cậu có Mac.

## Tiếp theo

Khi cậu sẵn sàng, Phase 2 (Vector DB cho bộ nhớ dài hạn + mã hóa) có thể làm bằng IndexedDB + Web Crypto API — vẫn chạy được trong bản PWA này, không cần Xcode.
