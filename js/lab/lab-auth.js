import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCRazQsleeTILp7VO5zYbeiy9dtOxrVenc",
  authDomain: "bentodish-alan.firebaseapp.com",
  projectId: "bentodish-alan",
  storageBucket: "bentodish-alan.firebasestorage.app",
  messagingSenderId: "652937239500",
  appId: "1:652937239500:web:2c4c3b28b2311f2b12db69"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

window.showAuthAlert = function() {
    alert("🔒 此功能僅限會員使用，請回主頁面登入！");
    // ✅ 已更新未登入的阻擋跳轉連結
    window.location.replace('https://richfly2u.github.io/bento/'); 
};

onAuthStateChanged(auth, (user) => {
   const masks = document.querySelectorAll('.auth-mask');
   const btns = document.querySelectorAll('.auth-btn');
   if (user) {
       masks.forEach(m => m.classList.remove('locked'));
       btns.forEach(b => b.classList.remove('locked'));
   } else {
       masks.forEach(m => m.classList.add('locked'));
       btns.forEach(b => b.classList.add('locked'));
   }
});
