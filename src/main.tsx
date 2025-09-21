// Entry point for React app, renders DashboardView
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardView } from './views/DashboardView';

const root = createRoot(document.getElementById('root')!);
root.render(<DashboardView />);
