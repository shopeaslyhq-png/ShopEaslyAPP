// Notification list for dashboard
import React from 'react';
import { Notification } from '../state/appState';

interface NotificationListProps {
  notifications: Notification[];
  onMarkRead: (id: number) => void;
}

export const NotificationList: React.FC<NotificationListProps> = ({ notifications, onMarkRead }) => (
  <div className="notification-list">
    {notifications.length === 0 ? (
      <div className="notification-empty">No notifications</div>
    ) : notifications.map(n => (
      <div key={n.id} className={`notification-item${n.read ? ' read' : ''}`}>
        <span className="notification-icon">{n.icon}</span>
        <span className="notification-text">{n.text}</span>
        <span className="notification-time">{new Date(n.time).toLocaleTimeString()}</span>
        {!n.read && <button onClick={() => onMarkRead(n.id)}>Mark read</button>}
      </div>
    ))}
  </div>
);
