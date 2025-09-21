import React from 'react';
import { Order } from '../state/appState';
import { OrderItemRow } from '../components/OrderItemRow';

interface OrderFormProps {
  order?: Order;
  onSave: (order: Order) => void;
  onCancel: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({ order, onSave, onCancel }) => {
  const [customer, setCustomer] = React.useState(order?.customer || '');
  const [status, setStatus] = React.useState(order?.status || 'New');
  const [notes, setNotes] = React.useState(order?.notes || '');
  const [items, setItems] = React.useState(order?.items || [{ productId: '', quantity: 1 }]);

  const handleItemChange = (idx: number, item: { productId: string; quantity: number }) => {
    setItems(items => items.map((it, i) => i === idx ? item : it));
  };
  const handleItemRemove = (idx: number) => {
    setItems(items => items.filter((_, i) => i !== idx));
  };
  const handleAddItem = () => {
    setItems(items => [...items, { productId: '', quantity: 1 }]);
  };

  // Auto-update price display for each item
  const total = items.reduce((sum, item) => {
    const product = item.productId ? require('../services/productsService').productsService.getById(item.productId) : null;
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: order?.id || Date.now(),
      customer,
      status,
      notes,
      items,
      date: order?.date || new Date().toISOString(),
    });
  };

  return (
    <form className="order-form" onSubmit={handleSubmit}>
      <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name" required />
      <select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="New">New</option>
        <option value="In Production">In Production</option>
        <option value="Completed">Completed</option>
      </select>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" />
      {items.map((item, idx) => (
        <OrderItemRow
          key={idx}
          value={item}
          onChange={it => handleItemChange(idx, it)}
          onRemove={() => handleItemRemove(idx)}
        />
      ))}
      <button type="button" onClick={handleAddItem}>Add Item</button>
      <div className="order-total">Total: ${total.toFixed(2)}</div>
      <button type="submit">Save Order</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
};
