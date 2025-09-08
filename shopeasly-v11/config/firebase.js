// Firebase Admin SDK Configuration for ShopEasly V11
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// In production, you would use a service account key file
// For development, we'll use the default credentials or environment variables
let db = null;

const initializeFirebase = () => {
  try {
    // Check if Firebase is already initialized
    if (admin.apps.length === 0) {
      // Initialize with default credentials (works when deployed to Firebase)
      // For local development, you can set GOOGLE_APPLICATION_CREDENTIALS
      // or use a service account key file
      
      const app = admin.initializeApp({
        projectId: 'shopeasly-talk-sos-37743',
        // If you have a service account key file, uncomment and use:
        // credential: admin.credential.cert(require('./serviceAccountKey.json'))
      });
      
      console.log('✅ Firebase Admin initialized successfully');
    }
    
    // Get Firestore instance
    db = admin.firestore();
    
    // Configure Firestore settings
    db.settings({
      timestampsInSnapshots: true
    });
    
    return db;
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error);
    throw error;
  }
};

// Initialize Firebase when this module is loaded
const firestore = initializeFirebase();

// Export Firestore instance and admin for use in other modules
module.exports = {
  db: firestore,
  admin,
  
  // Helper functions for common Firestore operations
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
      const docRef = await firestore.collection(collectionName).add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
      await firestore.collection(collectionName).doc(docId).update({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
