import { ref } from "vue";

const supported =
  typeof window !== "undefined" && typeof window.Notification !== "undefined";

const _permission = ref(supported ? Notification.permission : "denied");

export function useNotifications() {
  async function request() {
    if (!supported) return "denied";
    if (_permission.value === "granted") return "granted";
    const result = await Notification.requestPermission();
    _permission.value = result;
    return result;
  }

  function notify(title, body, onClick) {
    if (_permission.value !== "granted") return;
    try {
      const n = new Notification(title, { body, tag: title });
      if (onClick) n.onclick = onClick;
    } catch {
      // Some browsers throw if not invoked from a user gesture; ignore.
    }
  }

  return {
    permission: _permission,
    supported,
    request,
    notify,
  };
}
