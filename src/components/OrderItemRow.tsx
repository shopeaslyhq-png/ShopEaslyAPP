import React from 'react';
import { productsService } from '../services/productsService';

interface OrderItemRowProps {
  value: { productId: string; quantity: number };
  onChange: (item: { productId: string; quantity: number }) => void;
  onRemove: () => void;
}

export const OrderItemRow: React.FC<OrderItemRowProps> = ({ value, onChange, onRemove }) => {
  const products = productsService.getAll();
  const selectedProduct = products.find(p => p.id === value.productId);

  const handleProductChange = (productId: string) => {
    onChange({ productId, quantity: value.quantity });
  };

  const handleQuantityChange = (quantity: number) => {
    onChange({ productId: value.productId, quantity });
  };

  return (
    <div className="order-item-row">
      <select value={value.productId} onChange={e => handleProductChange(e.target.value)}>
        <option value="">Select product</option>
        {products.map(p => (
          <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
        ))}
      </select>
      <input type="number" min={1} value={value.quantity} onChange={e => handleQuantityChange(Number(e.target.value))} />
      <span className="order-item-price">{selectedProduct ? `$${selectedProduct.price}` : ''}</span>
      <button type="button" onClick={onRemove}>Remove</button>
    </div>
  );
};
