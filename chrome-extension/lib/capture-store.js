export const MAX_CAPTURE_AGE = 10 * 60 * 1000;
export const CAPTURE_SESSION_KEY = 'capture-session';
export const CAPTURE_DATABASE = 'premiumshot-capture-handoff';

// Decode the PNG bytes Chrome supplies without fetching or re-encoding them.
// Small, base64-aligned chunks avoid a second screenshot-sized binary string.
export function pngDataURLToBlob(url) {
  const prefix = 'data:image/png;base64,';
  if (typeof url !== 'string' || !url.startsWith(prefix)) {
    throw new Error('Chrome did not return a PNG. Capture the page again.');
  }
  const parts = [];
  for (let offset = prefix.length; offset < url.length; offset += 128 * 1024) {
    const bytes = atob(url.slice(offset, offset + 128 * 1024));
    parts.push(Uint8Array.from(bytes, byte => byte.charCodeAt(0)));
  }
  if (!parts.length) throw new Error('Chrome returned an empty capture. Try again.');
  return new Blob(parts, { type: 'image/png' });
}

export function isPendingCapture(record, sessionId, now = Date.now()) {
  return Boolean(sessionId && record?.sessionId === sessionId
    && Number.isFinite(record.createdAt) && now >= record.createdAt
    && now - record.createdAt < MAX_CAPTURE_AGE
    && record.image instanceof Blob && record.image.type === 'image/png');
}

// Shared by the service worker and editor on the extension's origin. IndexedDB
// holds the Blob; storage.session holds only the current browser-session id.
export class CaptureStore {
  constructor(factory = globalThis.indexedDB, name = CAPTURE_DATABASE) {
    this.factory = factory;
    this.name = name;
    this.opening = null;
  }

  open() {
    if (!this.opening) {
      this.opening = new Promise((resolve, reject) => {
        const request = this.factory.open(this.name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('captures', { keyPath: 'id' });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => { database.close(); this.opening = null; };
          resolve(database);
        };
      }).catch(error => { this.opening = null; throw error; });
    }
    return this.opening;
  }

  async transaction(work) {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('captures', 'readwrite');
      let value;
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = () => reject(transaction.error || new Error('The capture could not be stored. Try again.'));
      try { work(transaction.objectStore('captures'), result => { value = result; }); }
      catch (error) { transaction.abort(); reject(error); }
    });
  }

  put(record) {
    if (!record?.id || !isPendingCapture(record, record.sessionId, Date.now())) {
      return Promise.reject(new Error('The capture expired before it could be stored. Capture again.'));
    }
    return this.transaction(store => store.put(record));
  }

  take(id, sessionId, now = Date.now()) {
    return this.transaction((store, result) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result;
        store.delete(id);
        result(isPendingCapture(record, sessionId, now) ? record : null);
      };
    });
  }

  remove(id) { return this.transaction(store => store.delete(id)); }

  removeWhere(predicate) {
    return this.transaction(store => {
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (predicate(cursor.value)) cursor.delete();
        cursor.continue();
      };
    });
  }

  prune(sessionId, now = Date.now()) {
    return this.removeWhere(record => !isPendingCapture(record, sessionId, now));
  }

  removeForTab(tabId) { return this.removeWhere(record => record.sourceTabId === tabId); }
}
