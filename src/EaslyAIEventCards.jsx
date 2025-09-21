import React from "react";

function formatNumber(num) {
  if (typeof num !== "number" || isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EaslyAIEventCards({ events }) {
  if (!Array.isArray(events) || events.length === 0) {
    return <div style={{ color: '#888', textAlign: 'center', margin: '2em 0' }}>No events to display.</div>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5em', justifyContent: 'center' }}>
      {events.map((event, idx) => {
        switch (event.event) {
          case 'PRODUCT_CREATED': {
            const { payload = {} } = event;
            return (
              <div key={idx} className="card" style={{ minWidth: 320, maxWidth: 400, padding: 24, borderRadius: 12, background: '#fff', boxShadow: '0 2px 8px #0001', margin: 8 }}>
                <h3 style={{ margin: 0 }}>Product Created</h3>
                <div><strong>Name:</strong> {payload.name || '—'}</div>
                <div><strong>Estimated Cost:</strong> ${formatNumber(payload.estimatedCost)}</div>
                <div style={{ marginTop: 8 }}>
                  <strong>Materials:</strong>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {(payload.materials || []).map((m, i) => (
                      <li key={i}>{m.materialId} × {formatNumber(m.qty)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          }
          case 'MATERIAL_ADDED': {
            const { payload = {} } = event;
            return (
              <div key={idx} className="card" style={{ minWidth: 320, maxWidth: 400, padding: 24, borderRadius: 12, background: '#fff', boxShadow: '0 2px 8px #0001', margin: 8 }}>
                <h3 style={{ margin: 0 }}>Material Added</h3>
                <div><strong>Name:</strong> {payload.name || '—'}</div>
                <div><strong>Quantity:</strong> {formatNumber(payload.qty)}</div>
                <div><strong>Unit Cost:</strong> ${formatNumber(payload.unitCost)}</div>
                <div><strong>Total Value:</strong> ${formatNumber((payload.unitCost || 0) * (payload.qty || 0))}</div>
              </div>
            );
          }
          case 'SHOP_STATUS': {
            const { payload = {} } = event;
            return (
              <div key={idx} className="card" style={{ minWidth: 320, maxWidth: 400, padding: 24, borderRadius: 12, background: '#fff', boxShadow: '0 2px 8px #0001', margin: 8 }}>
                <h3 style={{ margin: 0 }}>Shop Status</h3>
                <div><strong>Total Inventory Value:</strong> ${formatNumber(payload.totalValue)}</div>
                <div><strong>Total Products:</strong> {formatNumber(payload.productCount)}</div>
                <div style={{ marginTop: 8 }}>
                  <strong>Low Stock Materials:</strong>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {(payload.lowStock || []).length === 0 ? (
                      <li style={{ color: '#888' }}>None</li>
                    ) : (
                      payload.lowStock.map((m, i) => (
                        <li key={i} style={{ color: 'red' }}>{m.name} (Qty: {formatNumber(m.qty)})</li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            );
          }
          case 'PRODUCT_IDEAS': {
            const { ideas = [] } = event;
            return (
              <div key={idx} className="card" style={{ minWidth: 320, maxWidth: 400, padding: 24, borderRadius: 12, background: '#f9f7ff', boxShadow: '0 2px 8px #0001', margin: 8 }}>
                <h3 style={{ margin: 0 }}>Brainstorm Board</h3>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {ideas.length === 0 ? <li style={{ color: '#888' }}>No ideas</li> : ideas.map((idea, i) => (
                    <li key={i}>
                      <strong>{idea.name}</strong>
                      <div style={{ fontSize: '0.95em', color: '#555', marginLeft: 4 }}>Materials: {Array.isArray(idea.suggestedMaterials) ? idea.suggestedMaterials.join(', ') : '—'}</div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
