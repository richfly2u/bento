<script type="module">
      import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
      import { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
      import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
      import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

      const firebaseConfig = {
        apiKey: "AIzaSyCRazQsleeTILp7VO5zYbeiy9dtOxrVenc",
        authDomain: "bentodish-alan.firebaseapp.com",
        projectId: "bentodish-alan",
        storageBucket: "bentodish-alan.firebasestorage.app",
        messagingSenderId: "652937239500",
        appId: "1:652937239500:web:2c4c3b28b2311f2b12db69"
      };

      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      const storage = getStorage(app);
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();

      // 掛載工具到 window
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
      
      // 檢查是否登入，已登入則執行動作，未登入則跳出提示
      window.checkAuthAndRun = function(callback) {
          if (window.currentUser) {
              callback();
          } else {
              showCenteredConfirm("🔒 此為專屬功能，請先登入會員喔！", () => {
                  const panel = document.getElementById('email-login-panel');
                  if (panel) panel.style.display = 'block';
              });
              const noBtn = document.querySelector('#centered-confirm .btn-no');
              if (noBtn) noBtn.style.display = 'none';
          }
      };

      onAuthStateChanged(auth, (user) => {
        const loginBtn = document.getElementById('login-btn');
        const panel = document.getElementById('email-login-panel');
        if (user) {
          window.currentUser = user;
          const displayName = user.displayName || user.email.split('@')[0];
          if(loginBtn) loginBtn.innerHTML = `👤 ${displayName} (登出)`;
          if(panel) panel.style.display = 'none'; 
        } else {
          window.currentUser = null;
          if(loginBtn) loginBtn.innerHTML = `🔑 會員登入`;
        }
      });
      console.log("✅ 全方位認人系統已上線！");
   // ============================================
// 圖片放大預覽 (Lightbox) 邏輯
// ============================================
window.openLightbox = function(data, type, docId) {
    const lightbox = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    const title = document.getElementById('lightbox-title');
    const actionDiv = document.getElementById('lightbox-action');

    // 判斷要顯示哪種圖片網址與標題
    img.src = type === 'combinations' ? data.thumbnail : data.imageUrl;
    title.innerText = type === 'combinations' ? data.name : (data.category ? `【${data.category}】便當照片` : '實體便當照片');
    
    actionDiv.innerHTML = '';
    
    // 如果是擺盤作品，給他一個載入修改的按鈕
    if (type === 'combinations') {
        const loadBtn = document.createElement('button');
        loadBtn.style.cssText = 'background:var(--gold); font-size:16px; padding:10px 30px; border:none; border-radius:8px; color:white; cursor:pointer; font-weight:bold; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: 0.2s;';
        loadBtn.innerHTML = '📥 載入至畫布進行修改';
        loadBtn.onmouseover = () => loadBtn.style.transform = 'scale(1.05)';
        loadBtn.onmouseout = () => loadBtn.style.transform = 'scale(1)';
        loadBtn.onclick = () => {
            closeLightbox();
            loadPlatedBento(data);       // 載入畫面
            currentCloudDocId = docId;   // 記錄雲端ID以便覆蓋儲存
        };
        actionDiv.appendChild(loadBtn);
    }

    lightbox.style.display = 'flex';
};

window.closeLightbox = function() {
    document.getElementById('image-lightbox').style.display = 'none';
};
    </script>
