import React from 'react';
import { ordersService } from '../services/ordersService';
import { Order } from '../state/appState';
import { OrderForm } from '../components/OrderForm';

export const OrdersView: React.FC = () => {
  const [orders, setOrders] = React.useState<Order[]>(ordersService.getAll());
  const [editingOrder, setEditingOrder] = React.useState<Order | undefined>();
  const [showForm, setShowForm] = React.useState(false);

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setShowForm(true);
  };
  const handleAdd = () => {
    setEditingOrder(undefined);
    setShowForm(true);
  };
  const handleSave = (order: Order) => {
    if (order.id && orders.find(o => o.id === order.id)) {
      ordersService.update(order.id, order);
    } else {
      ordersService.add(order);
    }
    setOrders(ordersService.getAll());
    setShowForm(false);
  };
  const handleCancel = () => setShowForm(false);

  return (
    <div className="orders-view">
      <h2>Orders</h2>
      <button onClick={handleAdd}>Add Order</button>
      {showForm && (
        <OrderForm order={editingOrder} onSave={handleSave} onCancel={handleCancel} />
      )}
      <ul>
        {orders.map(order => (
          <li key={order.id}>
            {order.customer} - {order.status} - {order.items.length} items
            <button onClick={() => handleEdit(order)}>Edit</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
