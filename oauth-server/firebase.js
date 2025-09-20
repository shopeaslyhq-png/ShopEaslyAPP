// Firebase Admin SDK setup for OAuth server
const admin = require('firebase-admin');
const serviceAccount = require('../shopeasly-v11/config/firebase.js');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
