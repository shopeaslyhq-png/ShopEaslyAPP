// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBc6k6L9A9wF68AXgeYRR1UYoyPccbds9U",
  authDomain: "shopeasly-workshop.firebaseapp.com",
  projectId: "shopeasly-workshop",
  storageBucket: "shopeasly-workshop.firebasestorage.app",
  messagingSenderId: "235888572191",
  appId: "1:235888572191:web:35567a938a0cef7775a22a"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

export { firestore };
