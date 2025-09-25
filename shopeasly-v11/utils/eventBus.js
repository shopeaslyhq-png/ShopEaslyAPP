// utils/eventBus.js
// Lightweight app-wide event bus using Node's EventEmitter
const { EventEmitter } = require('events');
const bus = new EventEmitter();

function emit(type, payload, userId) {
  const evt = { ts: new Date().toISOString(), type, payload, userId };
  try { bus.emit('event', evt); } catch (_) {}
}

function subscribe(listener) {
  bus.on('event', listener);
  return () => bus.off('event', listener);
}

module.exports = { bus, emit, subscribe };
