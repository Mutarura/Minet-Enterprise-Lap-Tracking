import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAJ5z1U0Uy4KiYVjfRNNKike55PC0g35b4",
    authDomain: "minet-insurance-laptoptracking.firebaseapp.com",
    projectId: "minet-insurance-laptoptracking",
    storageBucket: "minet-insurance-laptoptracking.firebasestorage.app",
    messagingSenderId: "460757682837",
    appId: "1:460757682837:web:1c803cdc57b71636e2699c",
    measurementId: "G-LDJZGJCDCJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Secondary app for creating users without logging out the current admin
const secondaryApp = initializeApp(firebaseConfig, "secondary");
const secondaryAuth = getAuth(secondaryApp);

export { app, analytics, db, storage, auth, secondaryAuth };
