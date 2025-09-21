import React from 'react';
import { productsService } from '../services/productsService';

interface ProductDropdownProps {
  value: string;
  onChange: (productId: string) => void;
}

export const ProductDropdown: React.FC<ProductDropdownProps> = ({ value, onChange }) => {
  const products = productsService.getAll();
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Select product</option>
      {products.map(p => (
        <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
      ))}
    </select>
  );
};
