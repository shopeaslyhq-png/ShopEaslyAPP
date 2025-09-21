// Core UI shell for the dashboard, renders header, main content, and notifications
import React from 'react';

interface DashboardShellProps {
  children: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => (
  <div className="dashboard-shell">
    {/* Header, can add nav or logo here */}
    <header className="dashboard-header">
      <img src="/assets/logo.svg" alt="ShopEasly Logo" height={40} />
      <h1>ShopEasly Dashboard</h1>
    </header>
    <main className="dashboard-main">
      {children}
    </main>
    {/* Notifications, modals, etc. can be portaled here */}
  </div>
);
