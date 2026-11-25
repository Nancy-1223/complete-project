/* Cart store: one object of { productId: quantity }, saved to localStorage,
   with a tiny subscribe/notify so any part of the UI can react. */
const KEY = "parcel.cart.v1";
const MAX_QTY = 99;
const listeners = new Set();
let items = load();

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn());
}

export const getCart = () => ({ ...items });
export const count = () => Object.values(items).reduce((sum, qty) => sum + qty, 0);

export function add(id, qty = 1) {
  items[id] = Math.min(MAX_QTY, (items[id] || 0) + qty);
  commit();
}

export function setQty(id, qty) {
  if (qty <= 0) delete items[id];
  else items[id] = Math.min(MAX_QTY, qty);
  commit();
}

export function remove(id) {
  delete items[id];
  commit();
}

export function clear() {
  items = {};
  commit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
