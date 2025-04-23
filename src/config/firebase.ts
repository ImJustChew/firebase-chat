// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAwazwueCiwZZXDTdrxIKPvyy83SmKYS4U",
    authDomain: "fir-chat-e7e3e.firebaseapp.com",
    projectId: "fir-chat-e7e3e",
    storageBucket: "fir-chat-e7e3e.firebasestorage.app",
    messagingSenderId: "583054374119",
    appId: "1:583054374119:web:eea31554818e182b621e42"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);