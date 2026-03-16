// js/core/auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 1. Firebase 設定
const firebaseConfig = {
    apiKey: "AIzaSyCRazQsleeTILp7VO5zYbeiy9dtOxrVenc",
    authDomain: "bentodish-alan.firebaseapp.com",
    projectId: "bentodish-alan",
    storageBucket: "bentodish-alan.firebasestorage.app",
    messagingSenderId: "652937239500",
    appId: "1:652937239500:web:2c4c3b28b2311f2b12db69"
};

// 2. 初始化並匯出功能 (Export)
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// 3. 把原本掛載在 window 的工具打包 (這能讓你在其他檔案繼續使用)
export function initFirebaseWindow() {
    window.firebaseDb = db;
    window.firebaseStorage = storage;
    window.fbAuth = auth;
    window.fbCollection = collection;
    window.fbAddDoc = addDoc;
    window.fbServerTimestamp = serverTimestamp;
    window.fbRef = ref;
    window.fbUploadBytes = uploadBytes;
    window.fbGetDownloadURL = getDownloadURL;
    window.fbDoc = doc;
    window.fbUpdateDoc = updateDoc;
    window.fbDeleteDoc = deleteDoc;
    window.fbGetDocs = getDocs;
    window.fbQuery = query;
    window.fbOrderBy = orderBy;

    window.loginWithGoogle = () => signInWithPopup(auth, provider);
    window.registerWithEmail = (email, pass) => createUserWithEmailAndPassword(auth, email, pass);
    window.loginWithEmail = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
    window.logout = () => signOut(auth);
}

// 4. 登入檢查邏輯
export function listenToAuth(onUserUpdate) {
    onAuthStateChanged(auth, (user) => {
        onUserUpdate(user);
    });
}
