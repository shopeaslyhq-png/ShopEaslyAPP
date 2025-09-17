// Local JSON storage configuration for ShopEasly V11 (no Firebase required)

// Local JSON-backed DB shim implementing a subset of Firestore-like API
let db = null;

const fs = require('fs');
const path = require('path');

const initializeFirebase = () => {
  // Always use local JSON store (no Firestore required)
  // Allow override via DATA_DIR for production deployments (e.g., Render Disk)
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const fileFor = (name) => path.join(dataDir, `${name}.json`);
  const readLocal = (name) => {
    try {
      const f = fileFor(name);
      if (!fs.existsSync(f)) return [];
      const raw = fs.readFileSync(f, 'utf8');
      return JSON.parse(raw || '[]');
    } catch (e) { return []; }
  };
  const writeLocal = (name, arr) => {
    const f = fileFor(name);
    fs.writeFileSync(f, JSON.stringify(arr, null, 2));
  };

  const makeQuery = (name, state = {}) => ({
    _name: name,
    _filters: state._filters || [],
    _orderBy: state._orderBy || null,
    _orderDir: state._orderDir || 'desc',
    _limit: state._limit || null,
    where(field, op, value) {
      if (op !== '==') return this; // only equality supported
      return makeQuery(name, { ...this, _filters: [...this._filters, { field, value }] });
    },
    orderBy(field, dir = 'desc') {
      return makeQuery(name, { ...this, _orderBy: field, _orderDir: dir });
    },
    limit(n) {
      return makeQuery(name, { ...this, _limit: Number(n) || null });
    },
    async get() {
      let arr = readLocal(name);
      // apply filters
      for (const f of this._filters) {
        arr = arr.filter(d => d && d[f.field] === f.value);
      }
      // order
      if (this._orderBy) {
        arr.sort((a, b) => {
          const av = a?.[this._orderBy];
          const bv = b?.[this._orderBy];
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (this._orderDir === 'desc' ? -1 : 1);
        });
      }
      // limit
      if (this._limit != null) arr = arr.slice(0, this._limit);
      const docs = arr.map(doc => ({ id: doc.id, data: () => doc }));
      return {
        empty: docs.length === 0,
        docs,
        forEach(cb) { docs.forEach(d => cb(d)); }
      };
    }
  });

  db = {
    collection: (name) => ({
      async add(data) {
        const arr = readLocal(name);
        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const doc = { id, ...data };
        arr.unshift(doc);
        writeLocal(name, arr);
        return { id };
      },
      doc(id) {
        return {
          async get() {
            const arr = readLocal(name);
            const found = arr.find(d => d.id === id);
            return { exists: !!found, id, data: () => found };
          },
          async update(data) {
            const arr = readLocal(name);
            const idx = arr.findIndex(d => d.id === id);
            if (idx === -1) throw new Error('document not found');
            arr[idx] = { ...arr[idx], ...data };
            writeLocal(name, arr);
          },
          async delete() {
            let arr = readLocal(name);
            arr = arr.filter(d => d.id !== id);
            writeLocal(name, arr);
          }
        };
      },
      // simple query support
      where(field, op, value) { return makeQuery(name).where(field, op, value); },
      orderBy(field, dir) { return makeQuery(name).orderBy(field, dir); },
      limit(n) { return makeQuery(name).limit(n); },
      async get() { return makeQuery(name).get(); }
    })
  };

  console.log('🗂 Using local JSON storage (no Firestore required)');
  return db;
};

// Initialize local storage when this module is loaded
const firestore = initializeFirebase();

// Export Firestore instance and admin for use in other modules
module.exports = {
  db: firestore,
  
  // Helper functions for common data operations
  collections: {
    orders: () => firestore.collection('orders'),
    products: () => firestore.collection('products'),
    inventory: () => firestore.collection('inventory'),
    users: () => firestore.collection('users'),
    materials: () => firestore.collection('materials'),
    packaging: () => firestore.collection('packaging'),
    designs: () => firestore.collection('designs'),
  },
  
  // Utility functions
  async createDocument(collectionName, data) {
    try {
      const ts = new Date().toISOString();
      const docRef = await firestore.collection(collectionName).add({
        ...data,
        createdAt: ts,
        updatedAt: ts
      });
      console.log(`✅ Document created in ${collectionName}:`, docRef.id);
      return docRef;
    } catch (error) {
      console.error(`❌ Error creating document in ${collectionName}:`, error);
      throw error;
    }
  },
  
  async getDocument(collectionName, docId) {
    try {
      const doc = await firestore.collection(collectionName).doc(docId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error(`❌ Error getting document from ${collectionName}:`, error);
      throw error;
    }
  },
  
  async updateDocument(collectionName, docId, data) {
    try {
      const ts = new Date().toISOString();
      await firestore.collection(collectionName).doc(docId).update({
        ...data,
        updatedAt: ts
      });
      console.log(`✅ Document updated in ${collectionName}:`, docId);
    } catch (error) {
      console.error(`❌ Error updating document in ${collectionName}:`, error);
      throw error;
    }
  },
  
  async deleteDocument(collectionName, docId) {
    try {
      await firestore.collection(collectionName).doc(docId).delete();
      console.log(`✅ Document deleted from ${collectionName}:`, docId);
    } catch (error) {
      console.error(`❌ Error deleting document from ${collectionName}:`, error);
      throw error;
    }
  },
  
  async getAllDocuments(collectionName, limit = 100) {
    try {
      const snapshot = await firestore.collection(collectionName)
        .limit(limit)
        .orderBy('createdAt', 'desc')
        .get();
      
      const documents = [];
      snapshot.forEach(doc => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      
      return documents;
    } catch (error) {
      console.error(`❌ Error getting documents from ${collectionName}:`, error);
      throw error;
    }
  }
};
