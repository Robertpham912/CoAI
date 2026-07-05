// Mỗi tool là 1 object: { name, description, parameters (JSON Schema), execute(args) }
// Đăng ký tool mới = thêm 1 object vào mảng EXAMPLE_TOOLS bên dưới.
// Đây là phần dễ mở rộng nhất cho "BYO-API Integration" sau này (gọi API bên thứ 3).

const EXAMPLE_TOOLS = [
  {
    name: "get_current_time",
    description: "Lấy ngày giờ hiện tại trên thiết bị của người dùng.",
    parameters: { type: "object", properties: {}, required: [] },
    execute: async () => {
      const now = new Date();
      return { iso: now.toISOString(), readable: now.toLocaleString("vi-VN") };
    }
  },

  {
    name: "get_battery_status",
    description: "Lấy phần trăm pin hiện tại của thiết bị, nếu trình duyệt hỗ trợ.",
    parameters: { type: "object", properties: {}, required: [] },
    execute: async () => {
      if (!navigator.getBattery) {
        return { error: "Trình duyệt này (Safari trên iOS) không hỗ trợ Battery API." };
      }
      const battery = await navigator.getBattery();
      return {
        level_percent: Math.round(battery.level * 100),
        charging: battery.charging
      };
    }
  },

  {
    name: "vibrate_device",
    description: "Làm rung thiết bị theo một pattern để báo hiệu (haptic feedback).",
    parameters: {
      type: "object",
      properties: {
        pattern_ms: {
          type: "string",
          description: "Danh sách thời gian bật/tắt (ms) cách nhau bởi dấu phẩy, ví dụ '100,50,100'."
        }
      },
      required: []
    },
    execute: async (args) => {
      const pattern = (args.pattern_ms || "100").split(",").map(Number);
      return HAL.vibrate(pattern);
    }
  },

  {
    name: "get_network_status",
    description: "Kiểm tra thiết bị có đang online không và loại kết nối mạng.",
    parameters: { type: "object", properties: {}, required: [] },
    execute: async () => HAL.getNetworkStatus()
  },

  {
    name: "get_current_location",
    description: "Lấy vị trí GPS hiện tại của thiết bị (cần người dùng cấp quyền).",
    parameters: { type: "object", properties: {}, required: [] },
    execute: async () => HAL.getLocation()
  },

  {
    name: "set_reminder",
    description: "Đặt một lời nhắc cục bộ (hiển thị notification) sau một số phút nhất định.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Nội dung lời nhắc." },
        minutes_from_now: { type: "number", description: "Số phút nữa sẽ nhắc." }
      },
      required: ["message", "minutes_from_now"]
    },
    execute: async (args) => {
      const ms = Number(args.minutes_from_now) * 60 * 1000;
      if (Notification.permission !== "granted") {
        await Notification.requestPermission();
      }
      setTimeout(() => {
        if (Notification.permission === "granted") {
          new Notification("Coai nhắc cậu", { body: args.message });
        }
      }, ms);
      return { scheduled: true, in_minutes: args.minutes_from_now };
    }
  }
];
