// Giant dashboard button for entity summary (products, materials, etc.)
import React from 'react';

interface GiantButtonProps {
  label: string;
  count: number;
  icon: string;
  onClick: () => void;
}

export const GiantButton: React.FC<GiantButtonProps> = ({ label, count, icon, onClick }) => (
  <button className="giant-btn" onClick={onClick}>
    <span className="giant-btn-icon">{icon}</span>
    <span className="giant-btn-label">{label}</span>
    <span className="giant-btn-count">{count}</span>
  </button>
);
