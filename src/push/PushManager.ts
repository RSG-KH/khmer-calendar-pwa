// Copyright (c) 2026 RSG-KH | Apache-2.0 License

export class WebPushManager {
  static isSupported(): boolean {
    return typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
  }

  static getPermissionState(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  static async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch (e) {
      console.warn('Failed to request notification permission:', e);
      return false;
    }
  }

  static async subscribe(vapidPublicKey?: string): Promise<PushSubscription | null> {
    if (!this.isSupported()) return null;
    const granted = await this.requestPermission();
    if (!granted) return null;

    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub && vapidPublicKey) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey) as any as any
        });
      }
      return sub;
    } catch (e) {
      console.warn('Failed to subscribe to push notifications:', e);
      return null;
    }
  }

  static async showLocalNotification(title: string, body: string, url: string = '/'): Promise<void> {
    if (!this.isSupported() || Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: '/icons/app-logo.png',
        badge: '/icons/apple-touch-icon.png',
        data: url,
        tag: 'khmer-calendar-alert',
        renotify: true
      } as any);
    } catch (e) {
      // Fallback
      new Notification(title, { body, icon: '/icons/app-logo.png' } as any);
    }
  }

  private static urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
