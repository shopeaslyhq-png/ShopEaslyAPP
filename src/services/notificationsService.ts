// Service for notifications logic
import { appState, Notification } from '../state/appState';

export const notificationsService = {
  getAll(): Notification[] {
    return appState.notifications;
  },
  markRead(id: number): void {
    const idx = appState.notifications.findIndex(n => n.id === id);
    if (idx > -1) {
      appState.notifications[idx].read = true;
    }
  },
  clearAll(): void {
    appState.notifications.forEach(n => n.read = true);
  },
  add(notification: Notification): void {
    appState.notifications.unshift(notification);
  }
};
