// Hardware Abstraction Layer (Phase 3) — bản web.
// Mỗi hàm dưới đây là 1 "khả năng phần cứng" được trừu tượng hóa.
// Cột "Native mapping" ghi chú API Swift/iOS tương ứng để port sau này.
//
// LƯU Ý QUAN TRỌNG: Safari trên iOS chặn rất nhiều API phần cứng vì lý do bảo mật/pin
// (Battery API, Vibration API đầy đủ, v.v.). Những hàm dưới đây sẽ tự báo "not_supported"
// thay vì lỗi im lặng, để tầng gọi phía trên (Intent Router) biết mà xử lý tiếp.

const HAL = {
  /**
   * Rung phản hồi theo pattern (ms bật/tắt xen kẽ).
   * Native mapping: UIImpactFeedbackGenerator / UINotificationFeedbackGenerator (Core Haptics)
   */
  vibrate(pattern = [100]) {
    if (!navigator.vibrate) {
      return { supported: false, reason: "Thiết bị/trình duyệt không hỗ trợ Vibration API (Safari iOS chặn)." };
    }
    const ok = navigator.vibrate(pattern);
    return { supported: true, triggered: ok };
  },

  /**
   * Lấy thông tin mạng hiện tại (loại kết nối, có tiết kiệm dữ liệu không).
   * Native mapping: NWPathMonitor (Network framework)
   */
  getNetworkStatus() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) {
      return { supported: false, online: navigator.onLine };
    }
    return {
      supported: true,
      online: navigator.onLine,
      effectiveType: conn.effectiveType,
      saveData: conn.saveData
    };
  },

  /**
   * Xin quyền và gửi local notification.
   * Native mapping: UNUserNotificationCenter
   */
  async notify(title, body) {
    if (!("Notification" in window)) {
      return { supported: false, reason: "Trình duyệt không hỗ trợ Notification API." };
    }
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission !== "granted") {
      return { supported: true, sent: false, reason: "Người dùng chưa cấp quyền thông báo." };
    }
    new Notification(title, { body });
    return { supported: true, sent: true };
  },

  /**
   * Lấy vị trí hiện tại (nếu người dùng cho phép).
   * Native mapping: CoreLocation (CLLocationManager)
   */
  getLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ supported: false, reason: "Trình duyệt không hỗ trợ Geolocation API." });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          supported: true,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy
        }),
        (err) => resolve({ supported: true, error: err.message }),
        { timeout: 8000 }
      );
    });
  },

  /**
   * IoT Gateway (Phase 3 nâng cao): placeholder cho giao thức điều khiển thiết bị ngoại vi.
   * Web không có quyền truy cập Bluetooth/IoT sâu như native, nên đây chỉ là điểm mở rộng
   * — khi port sang Swift, thay bằng CoreBluetooth / HomeKit / Matter SDK.
   */
  async sendIoTCommand(deviceId, command) {
    return {
      supported: false,
      reason: "IoT Gateway chưa triển khai ở bản web. Cần CoreBluetooth/HomeKit khi port sang native.",
      requested: { deviceId, command }
    };
  }
};
