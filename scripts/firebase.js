import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7LY3WyVii2o_OwjYspWW5hFW8vRfs_uA",
  authDomain: "hss-motor-dealers.firebaseapp.com",
  projectId: "hss-motor-dealers",
  storageBucket: "hss-motor-dealers.firebasestorage.app",
  messagingSenderId: "485609737841",
  appId: "1:485609737841:web:e9d218a924949e75c215d0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

