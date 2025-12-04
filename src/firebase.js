// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBPz3IuCfBBAXuCIF2kfufxOT-62jbzYFo",
  authDomain: "barberpro-app-36c6e.firebaseapp.com",
  projectId: "barberpro-app-36c6e",
  storageBucket: "barberpro-app-36c6e.firebasestorage.app",
  messagingSenderId: "219195978888",
  appId: "1:219195978888:web:05a55510d73766a9709b3d"
};

// Inicializamos la App
const app = initializeApp(firebaseConfig);
// Exportamos la base de datos para usarla en App.jsx
export const db = getFirestore(app);