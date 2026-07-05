// Multimodal Input Pipeline (Phase 4): đọc ảnh, PDF, code, văn bản do người dùng đưa vào,
// chuyển thành định dạng "part" mà Gemini API hiểu (inline_data base64 cho ảnh/PDF,
// hoặc text thuần cho code/txt).

const MultimodalPipeline = (() => {
  const TEXT_LIKE_EXTENSIONS = ["txt", "md", "js", "ts", "py", "cpp", "c", "h", "java", "json", "csv", "html", "css", "swift"];

  function extensionOf(filename) {
    return filename.split(".").pop().toLowerCase();
  }

  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result dạng "data:<mime>;base64,<data>" — tách lấy phần data
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Chuyển 1 File (ảnh, PDF, code, txt...) thành GeminiPart tương ứng.
   * Trả về { part, previewLabel } để UI hiển thị + gửi kèm request.
   */
  async function fileToGeminiPart(file) {
    const ext = extensionOf(file.name);

    if (file.type.startsWith("image/") || file.type === "application/pdf") {
      const base64 = await readAsBase64(file);
      return {
        part: { inline_data: { mime_type: file.type, data: base64 } },
        previewLabel: `📎 ${file.name} (${file.type})`
      };
    }

    if (TEXT_LIKE_EXTENSIONS.includes(ext) || file.type.startsWith("text/")) {
      const text = await readAsText(file);
      return {
        part: { text: `--- Nội dung file: ${file.name} ---\n${text}\n--- Hết file ---` },
        previewLabel: `📄 ${file.name} (đã đọc dạng văn bản)`
      };
    }

    return {
      part: null,
      previewLabel: `⚠️ Không hỗ trợ đọc định dạng "${file.type || ext}" trong bản web này.`
    };
  }

  return { fileToGeminiPart };
})();
