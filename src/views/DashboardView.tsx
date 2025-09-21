// Dashboard view composed of giant buttons and notifications
import React from 'react';
import { appState } from '../state/appState';
import { DashboardShell } from '../components/DashboardShell';
import { GiantButton } from '../components/GiantButton';
import { NotificationList } from '../components/NotificationList';

export const DashboardView: React.FC = () => {
  const [notifications, setNotifications] = React.useState(appState.notifications);

  const handleMarkRead = (id: number) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <DashboardShell>
      <div className="dashboard-btns-row">
        <GiantButton label="Products" count={appState.products.length} icon="📦" onClick={() => {}} />
        <GiantButton label="Materials" count={appState.materials.length} icon="🧵" onClick={() => {}} />
        <GiantButton label="Packaging" count={appState.packaging.length} icon="🎁" onClick={() => {}} />
        <GiantButton label="Orders" count={appState.orders.length} icon="📝" onClick={() => {}} />
      </div>
      <NotificationList notifications={notifications} onMarkRead={handleMarkRead} />
    </DashboardShell>
  );
};
