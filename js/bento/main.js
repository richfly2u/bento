// ============================================
// 權限與狀態追蹤
// ============================================
// 學長請將這裡換成您指定的管理員 Email
const ADMIN_EMAILS = ['admin@example.com', 'your_email@gmail.com']; 
let currentCloudDocId = null; // 紀錄目前正在編輯的雲端作品 ID，若為 null 代表是新建

// 判斷權限的輔助函式
function hasPermission(docOwnerUid) {
    if (!window.currentUser) return false;
    if (ADMIN_EMAILS.includes(window.currentUser.email)) return true; // 管理員最大
    if (window.currentUser.uid === docOwnerUid) return true;          // 本人可修改
    return false;
}

// ============================================
// 上傳實體便當照片邏輯 (升級版：解決圖層覆蓋問題)
// ============================================
let pendingPhotoFile = null; 

window.uploadRealBentoPhoto = function(input) {
    if (!input.files || input.files.length === 0) return;
    pendingPhotoFile = input.files[0];
    input.value = ""; 
    
    // 顯示遮罩與彈窗，並手動確保遮罩圖層在彈窗之下
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('photo-category-modal');
    
    overlay.style.display = 'block';
    overlay.style.zIndex = '99990'; 
    
    modal.style.display = 'flex';
    
    document.getElementById('confirm-photo-upload-btn').onclick = executePhotoUpload;
};

window.executePhotoUpload = async function() {
    if (!pendingPhotoFile) return;
    const category = document.getElementById('photo-category-select').value;
    
    // 關閉選擇視窗，開啟載入中的畫面
    document.getElementById('photo-category-modal').style.display = 'none';
    const savingOverlay = document.getElementById('saving-overlay');
    savingOverlay.innerHTML = `📤 照片壓縮與上傳中 (${category})...`;
    savingOverlay.style.display = 'flex';
    savingOverlay.style.zIndex = '999999';

    try {
        // ▼▼▼ 新增：上傳前先進行圖片壓縮瘦身 ▼▼▼
        
        // 1. 先把圖片讀取成 Data URL
        const dataUrl = await new Promise(res => { 
            const reader = new FileReader(); 
            reader.onload = e => res(e.target.result); 
            reader.readAsDataURL(pendingPhotoFile); 
        });
        
        // 2. 呼叫您原本寫好的 compressImage，把最大寬度設為 1000px (畫質夠清楚，檔案又小)
        const compressedBase64 = await compressImage(dataUrl, 1000);
        
        // 3. 把壓縮後的 Base64 轉換回 Blob 檔案格式，準備傳給 Firebase
        const byteString = atob(compressedBase64.split(',')[1]);
        const mimeString = compressedBase64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const compressedBlob = new Blob([ab], { type: mimeString });
        // ▲▲▲ 壓縮瘦身完成 ▲▲▲

        // Firebase 上傳邏輯 (改上傳瘦身後的 compressedBlob，並副檔名改為 webp)
        const fileName = `bento_photos/${window.currentUser.uid}_${Date.now()}.webp`;
        const storageRef = window.fbRef(window.firebaseStorage, fileName);
        await window.fbUploadBytes(storageRef, compressedBlob);
        const fileUrl = await window.fbGetDownloadURL(storageRef);

        await window.fbAddDoc(window.fbCollection(window.firebaseDb, "bento_photos"), {
            imageUrl: fileUrl,
            category: category, 
            uid: window.currentUser.uid,
            authorEmail: window.currentUser.email,
            createdAt: window.fbServerTimestamp()
        });

        // 成功後清理畫面
        savingOverlay.style.display = 'none';
        document.getElementById('overlay').style.display = 'none';
        pendingPhotoFile = null; 
        
        showCenteredConfirm(`✅ 成功上傳一張【${category}】便當照片！`, null);
        document.querySelector('#centered-confirm .btn-no').style.display = 'none';
        
    } catch (error) {
        console.error("上傳照片失敗:", error);
        savingOverlay.style.display = 'none';
        document.getElementById('overlay').style.display = 'none';
        showCenteredConfirm("❌ 上傳失敗，請檢查網路連線。", null);
        document.querySelector('#centered-confirm .btn-no').style.display = 'none';
    }
};
// ============================================
// 會員中心邏輯 (含彈窗美化)
// ============================================

window.handleEmailAuth = async function(type) {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    
    if(!email || !pass) {
        showCenteredConfirm("⚠️ 請輸入完整的 Email 與密碼", null);
        document.querySelector('#centered-confirm .btn-no').style.display = 'none';
        return;
    }
    if(pass.length < 6) {
        showCenteredConfirm("🔑 密碼安全性不足，至少需要 6 位數喔！", null);
        document.querySelector('#centered-confirm .btn-no').style.display = 'none';
        return;
    }

    try {
        if (type === 'register') {
            await window.registerWithEmail(email, pass);
            showCenteredConfirm("✨ 註冊成功！<br>歡迎加入大廚擺盤大師行列", () => {
                document.getElementById('email-login-panel').style.display = 'none';
            });
        } else {
            await window.loginWithEmail(email, pass);
            showCenteredConfirm("👋 歡迎回來，大廚！<br>準備好開始擺盤了嗎？", () => {
                document.getElementById('email-login-panel').style.display = 'none';
            });
        }
        document.querySelector('#centered-confirm .btn-no').style.display = 'none';
        
    } catch (error) {
        console.error("驗證失敗：", error.code);
        let msg = "❌ 驗證失敗，請檢查輸入內容";
        if (error.code === 'auth/email-already-in-use') msg = "⚠️ 此 Email 已經被註冊過囉，請直接登入";
        if (error.code === 'auth/wrong-password') msg = "🔑 密碼輸入錯誤，再試一次吧！";
        if (error.code === 'auth/invalid-email') msg = "📧 Email 格式似乎不正確";
        if (error.code === 'auth/user-not-found') msg = "🔍 找不到此帳號，請先註冊喔";

        showCenteredConfirm(msg, null);
        document.querySelector('#centered-confirm .btn-no').style.display = 'none';
    }
};

window.handleAuthClick = function() {
    if (window.currentUser) {
        showCenteredConfirm("🚪 確定要登出系統嗎？", () => {
            window.logout();
        });
        document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
    } else {
        const panel = document.getElementById('email-login-panel');
        if (panel) {
            panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
        }
    }
};

// ============================================
// 原有防盜啟動
// ============================================
!function(){const a=["kindhome.neocities.org","localhost","127.0.0.1",""],b=window.location.hostname;if(""!==b&&!a.some(c=>b.includes(c)))return document.body.innerHTML='<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#2B1810;color:white;font-size:24px;font-weight:bold;">\uD83D\uDEA8 \u8B66\u544A\uFF1A\u6B64\u7A0B\u5F0F\u78BC\u70BA\u672A\u6388\u6B0A\u76DC\u7528\uFF01</div>',void window.stop();document.addEventListener("contextmenu",a=>a.preventDefault()),document.addEventListener("keydown",a=>{"F12"!==a.key&&(!a.ctrlKey||!a.shiftKey||"I"!==a.key&&"i"!==a.key&&"J"!==a.key&&"j"!==a.key)&&(!a.ctrlKey||"U"!==a.key&&"u"!==a.key)||a.preventDefault()})}();
    
    const PRELOADED_TEMPLATES = [
        {
            "name": "九宮格", "w": 550, "h": 360,
            "slots": [{"l":113,"t":31,"w":99,"h":90,"a":0},{"l":225,"t":30,"w":104,"h":90,"a":0},{"l":340,"t":33,"w":102,"h":88,"a":0},{"l":225,"t":134,"w":105,"h":90,"a":0},{"l":224,"t":238,"w":103,"h":90,"a":0},{"l":108,"t":134,"w":107,"h":90,"a":0},{"l":108,"t":236,"w":105,"h":90,"a":0},{"l":341,"t":134,"w":104,"h":90,"a":0},{"l":342,"t":234,"w":102,"h":89,"a":0}],
            "bgUrl": "boxstyles/9.png"
        },
        {
            "name": "上三左右下二", "w": 550, "h": 360,
            "slots": [{"l":50,"t":28,"w":262,"h":150,"a":0},{"l":342,"t":22,"w":157,"h":69,"a":0},{"l":343,"t":109,"w":157,"h":69,"a":0},{"l":42,"t":205,"w":278,"h":132,"a":0},{"l":359,"t":203,"w":151,"h":147,"a":0}],
            "bgUrl": "boxstyles/u3lrd2.png"
        },
        {
            "name": "上三下二", "w": 550, "h": 360,
            "slots": [{"l":36,"t":15,"w":144,"h":132,"a":0},{"l":208,"t":15,"w":144,"h":132,"a":0},{"l":377,"t":17,"w":152,"h":132,"a":0},{"l":42,"t":187,"w":166,"h":159,"a":0},{"l":224,"t":181,"w":170,"h":164,"a":0},{"l":424,"t":174,"w":115,"h":168,"a":0}],
            "bgUrl": boxstyles/"u3d2.png"
        },
        {
            "name": "上三下一", "w": 550, "h": 360,
            "slots": [{"l":43,"t":26,"w":137,"h":150,"a":0},{"l":197,"t":28,"w":131,"h":146,"a":0},{"l":354,"t":30,"w":137,"h":146,"a":0},{"l":48,"t":198,"w":138,"h":150,"a":0},{"l":199,"t":199,"w":137,"h":150,"a":0},{"l":352,"t":201,"w":137,"h":150,"a":0}],
            "bgUrl": "boxstyles/u3d1.png"
        }
    ];

    let currentCategoryVal = '全部';
    let moveTargetVal = '待分類';
    let batchMoveTargetVal = '待分類';
    let currentBentoBgUrl = ''; 

    const defaultCats = [
        {val: '待分類', icon: '💡'}, {val: '主食類', icon: '🍚'}, {val: '鮮蔬類', icon: '🥬'},
        {val: '菇果類', icon: '🍄'}, {val: '豆製品', icon: '🍢'}, {val: '烤煎類', icon: '🔥'},
        {val: '酥炸類', icon: '🍤'}, {val: '點心類', icon: '🥟'}
    ];

    function getCategories() { 
        let saved = localStorage.getItem('bento_custom_categories');
        let cats = saved ? JSON.parse(saved) : defaultCats;
        if (cats.length === 0 || cats[0].val !== '全部') {
            cats = [{val: '全部', icon: '🌟'}, ...cats.filter(c => c.val !== '全部')];
        }
        return cats;
    }
    
    function toggleCatSelect() { document.getElementById('catSelectOptions').classList.toggle('open'); }
    function toggleMoveSelect() { document.getElementById('moveSelectOptions').classList.toggle('open'); }
    function toggleBatchMoveSelect() { document.getElementById('batchMoveSelectOptions').classList.toggle('open'); }

function toggleLibMenu() {
    const menu = document.getElementById('lib-menu');
    const fab = document.getElementById('lib-fab');
    const isOpen = menu.classList.toggle('open');
    fab.classList.toggle('open', isOpen);
    document.getElementById('lib-fab-icon').innerText = isOpen ? '✕' : '⚙️';
}

document.addEventListener('click', function(e) {
    const ft = document.getElementById('lib-floating-tools');
    if (ft && !ft.contains(e.target)) {
        document.getElementById('lib-menu')?.classList.remove('open');
        document.getElementById('lib-fab')?.classList.remove('open');
        const icon = document.getElementById('lib-fab-icon');
        if (icon) icon.innerText = '⚙️';
    }
});

    function renameCategory(oldVal) {
        const cats = getCategories();
        const cat = cats.find(c => c.val === oldVal);
        if (!cat) return;
        if (oldVal === '全部') { showCenteredConfirm('⚠️「全部」為系統分類，無法改名。', null); document.querySelector('#centered-confirm .btn-no').style.display='none'; return; }
        showPrompt({
            icon: '✏️', title: '分類改名',
            label: '新分類名稱', defaultVal: oldVal,
            label2: 'Emoji 圖示', defaultVal2: cat.icon
        }, (newName, newIcon) => {
            if (!newName || !newName.trim() || newName.trim() === oldVal) return;
            if (getCategories().find(c => c.val === newName.trim())) { showCenteredConfirm('⚠️ 此分類名稱已存在！', null); document.querySelector('#centered-confirm .btn-no').style.display='none'; return; }
            const cats = getCategories();
            const c = cats.find(c => c.val === oldVal);
            c.val = newName.trim(); c.icon = (newIcon.trim() || cat.icon);
            localStorage.setItem('bento_custom_categories', JSON.stringify(cats));
            const store = getStore('readwrite');
            store.openCursor().onsuccess = e => {
                const cursor = e.target.result;
                if (cursor) {
                    if (cursor.value.category === oldVal) { cursor.value.category = newName.trim(); cursor.update(cursor.value); }
                    cursor.continue();
                } else {
                    if (currentCategoryVal === oldVal) currentCategoryVal = newName.trim();
                    renderCategories(); loadCategory(currentCategoryVal);
                }
            };
        });
    }

    function renderCategories() {
        const cats = getCategories();
        const catOptions = document.getElementById('catSelectOptions'); 
        const catSelected = document.getElementById('catSelectSelected');
        
        if(catOptions && catSelected) {
            catOptions.innerHTML = ''; 
            let foundCurrent = false;
            cats.forEach(c => {
                const opt = document.createElement('div'); 
                opt.className = 'custom-option';
                opt.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
                const label = document.createElement('span');
                label.innerHTML = `${c.icon} ${c.val}`;
                label.style.flex = '1';
                label.onclick = () => { 
                    currentCategoryVal = c.val; 
                    catSelected.innerHTML = `${c.icon} ${c.val}`; 
                    document.getElementById('catSelectOptions').classList.remove('open'); 
                    if (libEditMode) toggleLibEditMode();
                    if (batchSelectMode) exitBatchSelectMode();
                    loadCategory(c.val); 
                };
                opt.appendChild(label);
                if (c.val !== '全部') {
                    const editBtn = document.createElement('span');
                    editBtn.innerHTML = '✏️';
                    editBtn.title = '改名此分類';
                    editBtn.style.cssText = 'font-size:13px; padding:2px 4px; cursor:pointer; opacity:0.5; flex-shrink:0;';
                    editBtn.onmouseenter = () => editBtn.style.opacity = '1';
                    editBtn.onmouseleave = () => editBtn.style.opacity = '0.5';
                    editBtn.onclick = (e) => { e.stopPropagation(); document.getElementById('catSelectOptions').classList.remove('open'); renameCategory(c.val); };
                    opt.appendChild(editBtn);
                }
                catOptions.appendChild(opt); 
                if(c.val === currentCategoryVal) { 
                    foundCurrent = true; 
                    catSelected.innerHTML = `${c.icon} ${c.val}`; 
                }
            });
            if(!foundCurrent && cats.length > 0) { 
                currentCategoryVal = cats[0].val; 
                catSelected.innerHTML = `${cats[0].icon} ${cats[0].val}`; 
            }
        }

        const moveOptions = document.getElementById('moveSelectOptions'); 
        const moveSelected = document.getElementById('moveSelectSelected');
        if(moveOptions && moveSelected) {
            moveOptions.innerHTML = ''; 
            let foundMove = false;
            cats.filter(c => c.val !== '全部').forEach(c => {
                const opt = document.createElement('div'); 
                opt.className = 'custom-option'; 
                opt.innerHTML = `${c.icon} ${c.val}`;
                opt.onclick = () => { 
                    moveTargetVal = c.val; 
                    moveSelected.innerHTML = `${c.icon} ${c.val}`; 
                    document.getElementById('moveSelectOptions').classList.remove('open'); 
                };
                moveOptions.appendChild(opt); 
                if(c.val === moveTargetVal) { 
                    foundMove = true; 
                    moveSelected.innerHTML = `${c.icon} ${c.val}`; 
                }
            });
            if(!foundMove && moveOptions.children.length > 0) { 
                moveTargetVal = cats.find(c => c.val !== '全部').val; 
                moveSelected.innerHTML = `${cats.find(c => c.val !== '全部').icon} ${moveTargetVal}`; 
            }
        }

        const batchMoveOptions = document.getElementById('batchMoveSelectOptions');
        const batchMoveSelected = document.getElementById('batchMoveSelectSelected');
        if (batchMoveOptions && batchMoveSelected) {
            batchMoveOptions.innerHTML = '';
            let foundBatchMove = false;
            cats.filter(c => c.val !== '全部').forEach(c => {
                const opt = document.createElement('div');
                opt.className = 'custom-option';
                opt.innerHTML = `${c.icon} ${c.val}`;
                opt.onclick = () => {
                    batchMoveTargetVal = c.val;
                    batchMoveSelected.innerHTML = `${c.icon} ${c.val}`;
                    document.getElementById('batchMoveSelectOptions').classList.remove('open');
                };
                batchMoveOptions.appendChild(opt);
                if (c.val === batchMoveTargetVal) {
                    foundBatchMove = true;
                    batchMoveSelected.innerHTML = `${c.icon} ${c.val}`;
                }
            });
            if (!foundBatchMove && batchMoveOptions.children.length > 0) {
                const firstCat = cats.find(c => c.val !== '全部');
                if (firstCat) {
                    batchMoveTargetVal = firstCat.val;
                    batchMoveSelected.innerHTML = `${firstCat.icon} ${firstCat.val}`;
                }
            }
        }
    }
    
    window.addEventListener('storage', function(e) { 
        if (e.key === 'bento_custom_categories') renderCategories(); 
    });

    let batchSelectMode = false;
    let batchSelectedIds = new Set();

    function toggleBatchSelectMode() {
        if (batchSelectMode) {
            exitBatchSelectMode();
        } else {
            enterBatchSelectMode();
        }
        if (window.innerWidth <= 850) toggleLibMenu();
    }

    function enterBatchSelectMode() {
        if (libEditMode) toggleLibEditMode(); 
        batchSelectMode = true;
        batchSelectedIds.clear();
        const grid = document.getElementById('libGrid');
        const btn = document.getElementById('libBatchBtn');
        grid.classList.add('batch-select-mode');
        btn.classList.add('batch-active');
        document.getElementById('batch-toolbar').classList.add('visible');
        document.querySelector('.sidebar').style.paddingBottom = '130px';
        updateBatchToolbar();
        grid.querySelectorAll('.dish-card').forEach(card => {
            card.addEventListener('click', batchCardClickHandler);
        });
    }

    function exitBatchSelectMode() {
        batchSelectMode = false;
        batchSelectedIds.clear();
        const grid = document.getElementById('libGrid');
        const btn = document.getElementById('libBatchBtn');
        grid.classList.remove('batch-select-mode');
        btn.classList.remove('batch-active');
        document.getElementById('batch-toolbar').classList.remove('visible');
        document.querySelector('.sidebar').style.paddingBottom = '';
        grid.querySelectorAll('.dish-card').forEach(card => {
            card.classList.remove('batch-selected');
            card.removeEventListener('click', batchCardClickHandler);
        });
    }

    function batchCardClickHandler(e) {
        if (!batchSelectMode) return;
        e.stopPropagation();
        const card = this;
        const id = parseInt(card.dataset.dishId);
        if (batchSelectedIds.has(id)) {
            batchSelectedIds.delete(id);
            card.classList.remove('batch-selected');
        } else {
            batchSelectedIds.add(id);
            card.classList.add('batch-selected');
        }
        updateBatchToolbar();
    }

    function updateBatchToolbar() {
        const count = batchSelectedIds.size;
        document.getElementById('batch-count-label').innerText = `已選 ${count} 項`;
        document.getElementById('batch-del-btn').disabled = count === 0;
        document.getElementById('batch-move-btn').disabled = count === 0;
        const totalCards = document.querySelectorAll('#libGrid .dish-card').length;
        document.getElementById('batch-select-all-btn').innerText = 
            count === totalCards && totalCards > 0 ? '取消全選' : '全選';
    }

    function batchSelectAll() {
        const cards = document.querySelectorAll('#libGrid .dish-card');
        const count = batchSelectedIds.size;
        const total = cards.length;
        if (count === total && total > 0) {
            batchSelectedIds.clear();
            cards.forEach(card => card.classList.remove('batch-selected'));
        } else {
            cards.forEach(card => {
                const id = parseInt(card.dataset.dishId);
                if (!isNaN(id)) {
                    batchSelectedIds.add(id);
                    card.classList.add('batch-selected');
                }
            });
        }
        updateBatchToolbar();
    }

    function confirmBatchDelete() {
        const count = batchSelectedIds.size;
        if (count === 0) return;
        document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
        showCenteredConfirm(`🚨 確定要刪除選取的 ${count} 道食材嗎？\n此動作無法復原！`, () => {
            executeBatchDelete();
        });
    }

    // 【修改後】
function executeBatchDelete() {
    const ids = Array.from(batchSelectedIds);
    if (ids.length === 0) return;
    
    // ✨ 新增：收集準備刪除的食材名稱 ✨
    const namesToDelete = [];
    ids.forEach(id => {
        // 從畫面上找到被選取的卡片，提取名稱
        const card = document.querySelector(`.dish-card[data-dish-id="${id}"]`);
        if (card) {
            const nameEl = card.querySelector('.dish-name');
            if (nameEl) namesToDelete.push(nameEl.innerText);
        }
    });

    // ✨ 新增：同步移除畫布上的這些食材 ✨
    if (namesToDelete.length > 0) {
        const canvasFoods = document.querySelectorAll('#drawCanvas .food');
        canvasFoods.forEach(food => {
            if (namesToDelete.includes(food.dataset.name)) {
                food.remove();
            }
        });
        activeTarget = null;
        updateGlobalCtrl();
        saveState();
    }

    // 以下為原本的刪除邏輯
    const store = getStore('readwrite');
    let done = 0;
    ids.forEach(id => {
        store.delete(id).onsuccess = () => {
            done++;
            if (done === ids.length) {
                const deletedCount = ids.length;
                exitBatchSelectMode();
                loadCategory(currentCategoryVal);
                document.querySelector('#centered-confirm .btn-no').style.display = 'none';
                showCenteredConfirm(`✅ 成功刪除 ${deletedCount} 道食材！`, null);
            }
        };
    });
}

    function openBatchMoveModal() {
        const count = batchSelectedIds.size;
        if (count === 0) return;
        document.getElementById('batch-move-title').innerText = `批量移動 ${count} 道食材`;
        document.getElementById('batch-move-label').innerText = `請選擇目標分類：`;
        batchMoveTargetVal = '';
        const list = document.getElementById('batchCatList');
        list.innerHTML = '';
        const okBtn = document.getElementById('batchMoveOkBtn');
        okBtn.disabled = true;
        getCategories().filter(c => c.val !== '全部').forEach(c => {
            const btn = document.createElement('button');
            btn.style.cssText = `
                display:flex; align-items:center; gap:10px;
                background:transparent; border:1px solid #2d3340; border-radius:10px;
                padding:10px 14px; cursor:pointer; font-size:14px; font-weight:bold;
                color:#e0e6ed; text-align:left; transition:0.15s; width:100%;
            `;
            btn.innerHTML = `<span style="font-size:20px;">${c.icon}</span><span>${c.val}</span>`;
            btn.onclick = () => {
                list.querySelectorAll('button').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.borderColor = '#2d3340';
                    b.style.color = '#e0e6ed';
                    b.style.boxShadow = 'none';
                });
                btn.style.background = 'rgba(212,168,67,0.15)';
                btn.style.borderColor = 'var(--gold)';
                btn.style.color = 'var(--gold)';
                btn.style.boxShadow = '0 0 0 3px rgba(212,168,67,0.25)';
                batchMoveTargetVal = c.val;
                okBtn.disabled = false;
            };
            list.appendChild(btn);
        });
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('batch-move-modal').style.display = 'flex';
    }

    function executeBatchMove() {
        const ids = Array.from(batchSelectedIds);
        if (ids.length === 0 || !batchMoveTargetVal) { cancelPopup(); return; }
        const store = getStore('readwrite');
        let done = 0;
        ids.forEach(id => {
            store.get(id).onsuccess = e => {
                const data = e.target.result;
                if (data) {
                    data.category = batchMoveTargetVal;
                    store.put(data).onsuccess = () => {
                        done++;
                        if (done === ids.length) {
                            cancelPopup();
                            const movedCount = ids.length;
                            exitBatchSelectMode();
                            loadCategory(currentCategoryVal);
                            document.querySelector('#centered-confirm .btn-no').style.display = 'none';
                            showCenteredConfirm(`✅ 已將 ${movedCount} 道食材移至【${batchMoveTargetVal}】！`, null);
                        }
                    };
                } else {
                    done++;
                }
            };
        });
    }

    let currentScale = 1;
    
    function autoScaleBento() {
        const container = document.getElementById('workspaceContainer');
        const bento = document.getElementById('shotArea');
        const scaleWrapper = document.getElementById('scaleWrapper');
        bento.style.transition = 'none';

        if (isDesignMode) {
            bento.style.transform = 'scale(1)';
            bento.style.transformOrigin = '';
            bento.style.position = '';
            bento.style.top = '';
            bento.style.left = '';
            scaleWrapper.style.width = '';
            scaleWrapper.style.height = '';
            scaleWrapper.style.overflow = '';
            scaleWrapper.style.margin = '';
            scaleWrapper.style.position = '';
            currentScale = 1;
            container.style.height = 'auto';
            updateGlobalCtrl();
            return;
        }

        if (window.innerWidth <= 850) {
            bento.style.removeProperty('transform');
            bento.style.removeProperty('transform-origin');
            bento.style.removeProperty('position');
            bento.style.removeProperty('top');
            bento.style.removeProperty('left');
            bento.style.removeProperty('margin-left');
            bento.style.removeProperty('display');
            scaleWrapper.style.width = '';
            scaleWrapper.style.height = '';
            scaleWrapper.style.position = '';
            scaleWrapper.style.overflow = '';
            scaleWrapper.style.margin = '';
            scaleWrapper.style.flexShrink = '';

            const bw2 = bento.offsetWidth;
            const bh2 = bento.offsetHeight;
            if (bw2 === 0 || bh2 === 0) { setTimeout(autoScaleBento, 200); return; }

            const sw = window.innerWidth;
            let scale = (sw * 0.96) / bw2;
            if (scale > 1) scale = 1;
            currentScale = scale;

            const scaledW = Math.ceil(bw2 * scale);
            const scaledH = Math.ceil(bh2 * scale);

            scaleWrapper.style.width = scaledW + 'px';
            scaleWrapper.style.height = scaledH + 'px';
            scaleWrapper.style.position = 'relative';
            scaleWrapper.style.overflow = 'hidden';
            scaleWrapper.style.margin = '0';
            scaleWrapper.style.flexShrink = '0';

            bento.style.setProperty('transform-origin', 'top left', 'important');
            bento.style.setProperty('transform', `scale(${scale})`, 'important');
            bento.style.setProperty('position', 'absolute', 'important');
            bento.style.setProperty('top', '0', 'important');
            bento.style.setProperty('left', '0', 'important');

            container.style.height = (scaledH + 16) + 'px';
            container.style.overflow = 'visible';
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'flex-start';
            container.style.padding = '8px 0';
        } else {
            bento.style.position = '';
            bento.style.top = '';
            bento.style.left = '';
            bento.style.marginLeft = '';
            scaleWrapper.style.position = '';
            scaleWrapper.style.width = '';
            scaleWrapper.style.height = '';
            scaleWrapper.style.overflow = '';
            scaleWrapper.style.margin = '';
            scaleWrapper.style.flexShrink = '';
            container.style.display = '';
            container.style.justifyContent = '';
            container.style.alignItems = '';

            bento.style.transform = 'scale(1)';
            const bw = bento.offsetWidth;
            const bh = bento.offsetHeight;
            if (bw === 0 || bh === 0) { setTimeout(autoScaleBento, 200); return; }

            const availableW = container.clientWidth - 40;
            const availableH = container.clientHeight - 40;
            if (availableW <= 0 || availableH <= 0) { 
                setTimeout(autoScaleBento, 300); 
                return; 
            }
            let scale = Math.min(availableW / bw, availableH / bh);
            if (scale > 1) scale = 1;
            currentScale = scale;
            bento.style.transformOrigin = 'center center';
            bento.style.transform = `scale(${scale})`;
            container.style.height = 'auto';
        }

        setTimeout(() => {
            bento.style.transition = 'transform 0.2s ease-out';
            updateGlobalCtrl();
        }, 50);
    }
    
    window.addEventListener('resize', autoScaleBento);
    document.getElementById('workspaceContainer').addEventListener('scroll', updateGlobalCtrl);

    const DB_NAME = 'ChefBentoCloudDB', STORE_NAME = 'dishes', DB_VERSION =5 ; 
    let db; 
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = e => { 
        db = e.target.result; 
        let store;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true }); 
        } else {
            store = e.target.transaction.objectStore(STORE_NAME);
        }
        if (!store.indexNames.contains('category')) {
            store.createIndex('category', 'category', { unique: false });
        }
        if (!db.objectStoreNames.contains('bentos')) {
            db.createObjectStore('bentos', { keyPath: 'id', autoIncrement: true }); 
        }
    }; 
    
    request.onsuccess = e => { 
        db = e.target.result; 
        renderCategories(); 
        loadCategory(currentCategoryVal); 
        
        let tpls = JSON.parse(localStorage.getItem('custom_bento_tpls') || '[]');
        if (tpls.length === 0 && PRELOADED_TEMPLATES.length > 0) {
            localStorage.setItem('custom_bento_tpls', JSON.stringify(PRELOADED_TEMPLATES));
            tpls = PRELOADED_TEMPLATES;
        }

        renderCustomTemplates(); 
        
        if(tpls.length > 0) {
            selectedCustomTplIndex = 0; 
            executeLoadCustomTemplate(tpls[0]);
            updateSelectedCustomDisplay();
            setTimeout(autoScaleBento, 500);
        } else {
            drawCanvas.innerHTML = ''; 
            currentBentoBgUrl = '';
            bentoOuter.style.backgroundImage = 'none'; 
            bentoOuter.style.backgroundColor = 'var(--wood)'; 
            bentoOuter.style.border = '5px solid #3d2518';
            document.getElementById('boxW').value = 550; 
            document.getElementById('boxH').value = 360;
            drawWrapper.style.width = "550px"; 
            drawWrapper.style.height = "360px";
            setTimeout(autoScaleBento, 300);
            checkAndPreloadFoods();
        }
    };
    
    function getStore(mode = 'readonly') { 
        return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME); 
    }
    
    function b64toBlobUrl(b64Data) { 
        if(!b64Data || !b64Data.includes(',')) return ''; 
        const parts = b64Data.split(';base64,'); 
        const contentType = parts[0].split(':')[1]; 
        const raw = window.atob(parts[1]); 
        const uInt8Array = new Uint8Array(raw.length); 
        for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i); 
        return URL.createObjectURL(new Blob([uInt8Array], { type: contentType })); 
    }
    
    async function compressImage(src, maxWidth=400) { 
        return new Promise((resolve) => { 
            const img = new Image(); 
            img.onload = () => { 
                const c = document.createElement('canvas'); 
                const scale = Math.min(maxWidth / img.width, 1); 
                c.width = img.width * scale; 
                c.height = img.height * scale; 
                const ctx = c.getContext('2d'); 
                ctx.drawImage(img, 0, 0, c.width, c.height); 
                resolve(c.toDataURL('image/webp', 0.8)); 
            }; 
            img.src = src; 
        }); 
    }
    
    window.alert = function(msg) {
        const isSuccess = String(msg).includes("成功") || String(msg).includes("✅");
        showCenteredConfirm(msg, null);
        setTimeout(() => {
            const noBtn = document.querySelector('#centered-confirm .btn-no');
            if (noBtn) noBtn.style.display = 'none';
            const yesBtn = document.querySelector('#centered-confirm .btn-yes');
            if (yesBtn) yesBtn.innerHTML = isSuccess ? '🎉 太棒了' : '知道了';
        }, 10);
    };

    let pendingCenteredAction = null;
    let pendingCenteredCancelAction = null;

    function showCenteredConfirm(msg, action, cancelAction = null) { 
        cancelPopup(); 
        const msgEl = document.getElementById('centered-msg');
        msgEl.innerHTML = String(msg).replace(/\n/g, '<br>'); 
        
        pendingCenteredAction = action; 
        pendingCenteredCancelAction = cancelAction;
        
        document.getElementById('overlay').style.display = 'block';
        const confirmBox = document.getElementById('centered-confirm');
        confirmBox.style.display = 'flex'; 
        
        const noBtn = confirmBox.querySelector('.btn-no');
        if (noBtn) {
            noBtn.style.display = cancelAction || action ? 'inline-block' : 'none';
            noBtn.innerHTML = '取消';
        }
        const yesBtn = confirmBox.querySelector('.btn-yes');
        if (yesBtn) yesBtn.innerHTML = '✅ 確定';
    }
    
    function execCenteredConfirm() { 
        if(pendingCenteredAction) pendingCenteredAction(); 
        cancelPopup(); 
    }
    
    function execCenteredCancel() { 
        if(pendingCenteredCancelAction) pendingCenteredCancelAction(); 
        cancelPopup(); 
    }

    let promptCallback = null;
    function showPrompt(config, callback) {
        cancelPopup();
        document.getElementById('prompt-icon').innerText = config.icon || '✏️';
        document.getElementById('prompt-title').innerText = config.title || '請輸入';
        document.getElementById('prompt-label').innerText = config.label || '';
        const inp = document.getElementById('prompt-input');
        inp.value = config.defaultVal || ''; inp.placeholder = config.placeholder || '';
        const lbl2 = document.getElementById('prompt-label2');
        const inp2 = document.getElementById('prompt-input2');
        if (config.label2) {
            lbl2.innerText = config.label2; lbl2.style.display = 'block';
            inp2.value = config.defaultVal2 || ''; inp2.placeholder = config.placeholder2 || ''; inp2.style.display = 'block';
        } else {
            lbl2.style.display = 'none'; inp2.style.display = 'none';
        }
        document.getElementById('prompt-ok-btn').innerText = config.okText || '✅ 確定';
        promptCallback = callback;
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('custom-prompt').style.display = 'flex';
        setTimeout(() => inp.focus(), 100);
        inp.onkeydown = inp2.onkeydown = (e) => { if (e.key === 'Enter') confirmCustomPrompt(); };
    }
    
    function confirmCustomPrompt() {
        const v1 = document.getElementById('prompt-input').value;
        const v2 = document.getElementById('prompt-input2').value;
        if (promptCallback) promptCallback(v1, v2);
        cancelPopup();
    }
    function cancelCustomPrompt() { cancelPopup(); }

    function promptAddCategory() {
        showPrompt({
            icon: '➕', title: '新增食材分類',
            label: '分類名稱（例如：湯品類）', placeholder: '請輸入分類名稱',
            label2: 'Emoji 圖示', defaultVal2: '🍱', placeholder2: '請輸入一個 Emoji'
        }, (name, icon) => {
            if (!name || !name.trim()) return;
            icon = icon.trim() || '🍱';
            const cats = getCategories();
            if (cats.find(c => c.val === name.trim())) { showCenteredConfirm("⚠️ 此分類已經存在！", null); document.querySelector('#centered-confirm .btn-no').style.display='none'; return; }
            cats.push({val: name.trim(), icon}); 
            localStorage.setItem('bento_custom_categories', JSON.stringify(cats));
            currentCategoryVal = name.trim(); renderCategories();
        });
    }

const tooltip = document.createElement('div');
tooltip.id = 'custom-tooltip';
tooltip.style.cssText = `
    position: fixed;
    background: var(--lacquer);
    color: var(--gold);
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s, transform 0.2s;
    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    border: 1px solid var(--gold);
    z-index: 999999;
    transform: translateY(4px);
`;
document.body.appendChild(tooltip);

document.querySelectorAll('.lib-menu-item').forEach(el => {
    el.addEventListener('mouseenter', function(e) {
        const tip = this.dataset.tip;
        if (!tip) return;
        tooltip.innerText = tip;
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0)';
        const rect = this.getBoundingClientRect();
        tooltip.style.left = (rect.left + rect.width/2 - tooltip.offsetWidth/2) + 'px';
        tooltip.style.top = (rect.top - 38) + 'px';
    });
    el.addEventListener('mouseleave', function() {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(4px)';
    });
});

    async function batchAdd(input) { 
        const files = Array.from(input.files); 
        if (files.length === 0) return; 
        let targetCat = currentCategoryVal === '全部' ? '待分類' : currentCategoryVal;
        for(let f of files) { 
            const dataUrl = await new Promise(res => { 
                const reader = new FileReader(); 
                reader.onload = e => res(e.target.result); 
                reader.readAsDataURL(f); 
            }); 
            const compressedUrl = await compressImage(dataUrl); 
            getStore('readwrite').add({ src: compressedUrl, name: f.name.replace(/\.[^/.]+$/, "") || "新食材", category: targetCat }); 
        } 
        document.querySelector('#centered-confirm .btn-no').style.display = 'none'; 
        showCenteredConfirm(`✅ 成功將 ${files.length} 道菜匯入至【${targetCat}】！`, null);
        loadCategory(currentCategoryVal); 
        input.value = ""; 
    }
    
    function deleteAllDishes() {
        document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
        showCenteredConfirm("🚨 警告：確定要清除整個資料庫嗎？\n(包含所有食材與您的擺盤作品，此動作無法復原！)", () => {
            getStore('readwrite').clear();
            db.transaction('bentos', 'readwrite').objectStore('bentos').clear().onsuccess = () => {
                loadCategory(currentCategoryVal); 
                document.querySelector('#centered-confirm .btn-no').style.display = 'none'; 
                showCenteredConfirm("✅ 資料庫已完全清空！", null);
            };
        });
    }

    let libEditMode = false;
    function toggleLibEditMode() {
        libEditMode = !libEditMode;
        const grid = document.getElementById('libGrid');
        const btn = document.getElementById('libEditBtn');
        if (libEditMode) {
            if (batchSelectMode) exitBatchSelectMode();
            grid.classList.add('lib-edit-mode');
            btn.classList.add('edit-active');
            btn.title = '結束編輯';
            btn.innerText = '✅';
        } else {
            grid.classList.remove('lib-edit-mode');
            btn.classList.remove('edit-active');
            btn.title = '編輯食材（改名/換分類/刪除）';
            btn.innerText = '✏️';
        }
    }

    function clearCurrentCategory() {
        if (currentCategoryVal === '全部') { deleteAllDishes(); return; }
        document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
        showCenteredConfirm(`🚨 確定要清空【${currentCategoryVal}】裡的所有食材嗎？\n(此動作無法復原！)`, () => {
            const store = getStore('readwrite');
            let req = store.indexNames.contains('category') ? store.index('category').openCursor(IDBKeyRange.only(currentCategoryVal)) : store.openCursor();
            req.onsuccess = e => {
                const cursor = e.target.result;
                if (cursor) { 
                    if (cursor.value.category === currentCategoryVal) cursor.delete(); 
                    cursor.continue(); 
                } else {
                    loadCategory(currentCategoryVal); 
                    const cats = getCategories(); 
                    const isDefault = defaultCats.find(c => c.val === currentCategoryVal);
                    if (!isDefault) {
                        setTimeout(() => {
                            document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
                            showCenteredConfirm(`【${currentCategoryVal}】已經空了。\n請問要將此自訂分類從清單中刪除嗎？`, () => {
                                const newCats = cats.filter(c => c.val !== currentCategoryVal && c.val !== '全部');
                                localStorage.setItem('bento_custom_categories', JSON.stringify(newCats));
                                currentCategoryVal = '全部'; 
                                renderCategories(); 
                                loadCategory('全部');
                            });
                        }, 500);
                    }
                }
            };
        });
    }

    let activeBlobUrls = []; 
    let pendingActionId = null; 
    let pendingActionCard = null;

    function loadCategory(cat) { 
        const grid = document.getElementById('libGrid'); 
        const loader = document.getElementById('loading-indicator');
        grid.innerHTML = ''; 
        loader.style.display = 'block';
        activeBlobUrls.forEach(url => URL.revokeObjectURL(url)); 
        activeBlobUrls = [];
        if (batchSelectMode) {
            batchSelectedIds.clear();
            updateBatchToolbar();
        }
        const store = getStore();
        let dbRequest = (cat === '全部') 
            ? store.openCursor() 
            : (store.indexNames.contains('category') ? store.index('category').openCursor(IDBKeyRange.only(cat)) : store.openCursor());
        const fragment = document.createDocumentFragment();
        let itemCount = 0;
        dbRequest.onsuccess = e => { 
            const cursor = e.target.result; 
            if (cursor) { 
                if (cat === '全部' || cursor.value.category === cat) { 
                    itemCount++;
                    const d = cursor.value; 
                    const blobUrl = b64toBlobUrl(d.src); 
                    activeBlobUrls.push(blobUrl); 
                    const card = document.createElement('div'); 
                    card.className = 'dish-card'; 
                    card.dataset.dishId = d.id; 
                    card.draggable = true; 
                    card.ondragstart = evt => evt.dataTransfer.setData('text/plain', d.src + '|||' + d.name); 
                    card.onclick = (evt) => { 
                        if(evt.target.classList.contains('dish-name')) return;
                        if(evt.target.closest('.card-tag-btn') || evt.target.closest('.card-del-btn')) return;
                        if(batchSelectMode) return; 
                        if(document.getElementById('libGrid').classList.contains('lib-edit-mode')) return;
                        addFoodByClick(d.src, d.name); 
                    }; 
                    card.innerHTML = `
                        <div class="card-tag-btn" style="position:absolute;top:3px;left:3px;background:var(--gold);color:white;width:22px;height:22px;font-size:11px;cursor:pointer;border-radius:50%;z-index:5;box-shadow:0 1px 3px rgba(0,0,0,0.3);justify-content:center;align-items:center;" onclick="event.stopPropagation();showMoveConfirm(event, ${d.id}, '${d.category}', this.parentElement)" title="更換分類">🏷️</div>
                        <div class="card-del-btn" style="position:absolute;top:3px;right:3px;background:#f44336;color:white;width:22px;height:22px;font-size:14px;cursor:pointer;border-radius:50%;z-index:5;box-shadow:0 1px 3px rgba(0,0,0,0.3);justify-content:center;align-items:center;font-weight:bold;line-height:1;" onclick="event.stopPropagation();showDeleteConfirm(event, ${d.id}, this.parentElement)" title="刪除食材">×</div>
                        <img src="${blobUrl}">
                        <div class="dish-name" contenteditable="true" onblur="updateName(${d.id}, this.innerText)" title="${d.name}">${d.name}</div>
                    `; 
                    if (batchSelectMode) {
                        card.addEventListener('click', batchCardClickHandler);
                    }
                    fragment.appendChild(card); 
                } 
                cursor.continue(); 
            } else { 
                if (itemCount === 0) {
                    grid.innerHTML = `
                        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: #999; font-size: 13px; line-height: 1.8;">
                            📭 此分類目前空空如也<br>
                            <button onclick="document.getElementById('imgIn').click()" style="margin-top: 15px; padding: 10px 20px; background: var(--blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 3px 10px rgba(33,150,243,0.3);">
                                📥 點擊匯入食材
                            </button>
                        </div>
                    `;
                } else {
                    grid.appendChild(fragment); 
                }
                loader.style.display = 'none'; 
            }
        }; 
    }
    
    function getClientPos(e) {
        let x, y;
        if (e.touches && e.touches.length > 0) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
        else if (e.changedTouches && e.changedTouches.length > 0) { x = e.changedTouches[0].clientX; y = e.changedTouches[0].clientY; }
        else { x = e.clientX; y = e.clientY; }
        if (currentScale !== 1) {
            const dw = document.getElementById('drawCanvasWrapper');
            const dwRect = dw.getBoundingClientRect();
            x = (x - dwRect.left) / currentScale;
            y = (y - dwRect.top) / currentScale;
        }
        return { x, y };
    }

    function getPopupPosition(e, boxEl) {
        boxEl.style.display = 'flex'; 
        const pos = getClientPos(e);
        let left = pos.x + 15; 
        let top = pos.y + 15;
        const rect = boxEl.getBoundingClientRect();
        if (left + rect.width > window.innerWidth) left = pos.x - rect.width - 15;
        if (top + rect.height > window.innerHeight) top = pos.y - rect.height - 15;
        return { left, top };
    }

    function showDeleteConfirm(e, id, cardEl) {
        cancelPopup(); 
        pendingActionId = id; 
        pendingActionCard = cardEl; 
        const box = document.getElementById('custom-confirm');
        box.style.display = 'flex';
        box.style.position = 'fixed';
        box.style.left = '50%';
        box.style.top = '50%';
        box.style.transform = 'translate(-50%, -50%)';
        document.getElementById('overlay').style.display = 'block';
    }

    function showMoveConfirm(e, id, currentCat, cardEl) {
        cancelPopup(); 
        pendingActionId = id; 
        pendingActionCard = cardEl; 
        const box = document.getElementById('custom-move');
        moveTargetVal = currentCat; 
        const cats = getCategories(); 
        const catObj = cats.find(c => c.val === currentCat) || cats[1]; 
        document.getElementById('moveSelectSelected').innerHTML = `${catObj.icon} ${catObj.val}`;
        const pos = getPopupPosition(e, box); 
        box.style.left = pos.left + 'px'; 
        box.style.top = pos.top + 'px';
    }

    // 【修改後】
function executeDelete() { 
    if (pendingActionId !== null) { 
        // 1. 取得要刪除的卡片上的圖片網址或名稱，用來比對畫布上的食材
        let targetSrc = "";
        let targetName = "";
        if (pendingActionCard) {
            const imgEl = pendingActionCard.querySelector('img');
            if (imgEl) targetSrc = imgEl.src;
            const nameEl = pendingActionCard.querySelector('.dish-name');
            if(nameEl) targetName = nameEl.innerText;
            
            pendingActionCard.remove(); 
        }
        
        // 2. 從 IndexedDB 中刪除
        getStore('readwrite').delete(pendingActionId); 
        
        // 3. ✨ 同步檢查並移除畫布上的同名/同圖食材 ✨
        if (targetName) {
            const canvasFoods = document.querySelectorAll('#drawCanvas .food');
            canvasFoods.forEach(food => {
                // 如果畫布上的食材名稱與刪除的食材名稱相同，就將其移除
                if (food.dataset.name === targetName) {
                    food.remove();
                }
            });
            // 由於畫面有變動，建議重新儲存歷史紀錄，並重置選取狀態
            activeTarget = null;
            updateGlobalCtrl();
            saveState();
        }
    } 
    cancelPopup(); 
}

    function cancelPopup() {
        pendingActionId = null; 
        pendingActionCard = null; 
        pendingCenteredAction = null; 
        pendingCenteredCancelAction = null;
        promptCallback = null;
        document.getElementById('custom-confirm').style.display = 'none';
        document.getElementById('custom-move').style.display = 'none';
        document.getElementById('centered-confirm').style.display = 'none';
        document.getElementById('save-modal').style.display = 'none';
        document.getElementById('gallery-modal').style.display = 'none';
        document.getElementById('custom-prompt').style.display = 'none';
        document.getElementById('summary-modal').style.display = 'none';
        document.getElementById('ai-modal').style.display = 'none';
        document.getElementById('batch-move-modal').style.display = 'none';
        document.getElementById('overlay').style.display = 'none';
        const btnYes = document.querySelector('#centered-confirm .btn-yes');
        if(btnYes) btnYes.innerHTML = '✅ 確定';
        const btnNo = document.querySelector('#centered-confirm .btn-no');
        if(btnNo) btnNo.innerHTML = '取消';
    }

    function showSummaryModal() {
        const foods = document.querySelectorAll('.food');
        const slots = document.querySelectorAll('.slot');
        const body = document.getElementById('summary-body');
        const items = [];
        foods.forEach(f => {
            const name = f.dataset.name || '未知食材';
            const src = f.querySelector('img')?.src || '';
            items.push({ name, src });
        });
        const unique = [...new Map(items.map(i => [i.name, i])).values()];
        body.innerHTML = `
            <div class="sum-stat">
                <span class="sum-chip">🗂️ ${slots.length} 格</span>
                <span class="sum-chip">🍽️ ${foods.length} 份食材</span>
                <span class="sum-chip">🌈 ${unique.length} 種</span>
            </div>
        `;
        unique.forEach(item => {
            const row = document.createElement('div');
            row.className = 'sum-row';
            row.innerHTML = `
                <img class="sum-thumb" src="${item.src}">
                <div class="sum-info">
                    <div class="sum-name">${item.name}</div>
                    <div class="sum-cat">已放入便當</div>
                </div>
            `;
            body.appendChild(row);
        });
        if (unique.length === 0) {
            body.innerHTML += `<div style="text-align:center;color:#999;padding:20px;font-size:13px;">📭 便當內尚無食材</div>`;
        }
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('summary-modal').style.display = 'flex';
    }

    let aiGeneratedSvg = null;
    let geminiApiKey = localStorage.getItem('gemini_api_key') || '';

    function openAiModal() {
        cancelPopup();
        document.getElementById('ai-input').value = '';
        document.getElementById('ai-preview').innerHTML = '✨ 點擊生成後會在此顯示';
        document.getElementById('ai-status').innerText = '';
        document.getElementById('ai-save-btn').style.display = 'none';
        document.getElementById('ai-gen-ok').disabled = false;
        document.getElementById('ai-gen-ok').innerText = '✨ 生成';
        const keyRow = document.getElementById('ai-key-row');
        if (keyRow) {
            document.getElementById('ai-key-input').value = geminiApiKey;
            keyRow.style.display = geminiApiKey ? 'none' : 'flex';
        }
        aiGeneratedSvg = null;
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('ai-modal').style.display = 'flex';
        setTimeout(() => document.getElementById('ai-input').focus(), 100);
        document.getElementById('ai-input').onkeydown = (e) => { if(e.key==='Enter') aiGenerate(); };
    }

    async function aiGenerate() {
        const name = document.getElementById('ai-input').value.trim();
        if (!name) return;

        const keyInput = document.getElementById('ai-key-input');
        if (keyInput && keyInput.value.trim()) {
            geminiApiKey = keyInput.value.trim();
            localStorage.setItem('gemini_api_key', geminiApiKey);
            document.getElementById('ai-key-row').style.display = 'none';
        }
        if (!geminiApiKey) {
            document.getElementById('ai-status').innerHTML = '⚠️ 請先輸入 Gemini API Key';
            document.getElementById('ai-key-row').style.display = 'flex';
            return;
        }

        const btn = document.getElementById('ai-gen-ok');
        btn.disabled = true; btn.innerText = '⏳ 生成中...';
        document.getElementById('ai-status').innerText = 'AI 正在繪製食材插圖，請稍候...';
        document.getElementById('ai-preview').innerHTML = '<div style="font-size:28px;animation:spin 1s linear infinite;display:inline-block;">⚙️</div>';
        document.getElementById('ai-save-btn').style.display = 'none';
        aiGeneratedSvg = null;

        const prompt = `請用 SVG 繪製「${name}」放在便當格子裡俯視的插圖。

規定：
- 只輸出 <svg viewBox="0 0 200 200"> 標籤，不含任何說明文字或 markdown
- 透明背景，不加背景矩形
- 俯視角度，食材佔畫面 65-75%
- 煮熟後的真實顏色：炒菜有油亮深綠、肉類有焦褐色、蛋有焦黃、醬汁要深色
- 用 linearGradient/radialGradient 做立體感
- 食物形狀要寫實，禁止畫成圓球或氣球狀`;

        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 3000 }
                    })
                }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const msg = err.error?.message || `HTTP ${res.status}`;
                if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
                    throw new Error('已達免費配額上限，請稍後幾分鐘再試，或前往 Google AI Studio 升級方案。');
                }
                if (msg.includes('API_KEY') || res.status === 400 || res.status === 403) {
                    throw new Error('API Key 無效，請按 🔑 重新輸入。');
                }
                throw new Error(msg);
            }
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const clean = text.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
            const match = clean.match(/<svg[\s\S]*<\/svg>/i);
            if (match) {
                aiGeneratedSvg = match[0];
                document.getElementById('ai-preview').innerHTML = aiGeneratedSvg;
                document.getElementById('ai-status').innerText = `✅ 「${name}」生成完成！`;
                document.getElementById('ai-save-btn').style.display = 'inline-block';
                btn.innerText = '🔄 重新生成';
            } else {
                document.getElementById('ai-status').innerText = '⚠️ 生成結果異常，請重試。';
                document.getElementById('ai-preview').innerHTML = '❌';
                btn.innerText = '✨ 重試';
            }
        } catch(e) {
            document.getElementById('ai-status').innerText = `⚠️ 錯誤：${e.message}`;
            document.getElementById('ai-preview').innerHTML = '❌';
            btn.innerText = '✨ 重試';
        }
        btn.disabled = false;
    }

    function aiSaveToLib() {
        if (!aiGeneratedSvg || !db) return;
        const name = document.getElementById('ai-input').value.trim() || 'AI食材';
        const blob = new Blob([aiGeneratedSvg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas'); c.width = 200; c.height = 200;
            const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 200, 200);
            URL.revokeObjectURL(url);
            const dataUrl = c.toDataURL('image/webp', 0.9);
            const cat = currentCategoryVal || '待分類';
            const store = db.transaction(['dishes'], 'readwrite').objectStore('dishes');
            store.add({ src: dataUrl, name, category: cat }).onsuccess = () => {
                cancelPopup();
                loadCategory(currentCategoryVal);
                showCenteredConfirm(`✅ 「${name}」已成功存入【${cat}】！`, null);
                document.querySelector('#centered-confirm .btn-no').style.display = 'none';
            };
        };
        img.src = url;
    }

    function handleOutsideClick(e) {
        const isTouch = e.type.startsWith('touch');
        const evtTarget = isTouch && e.touches && e.touches.length > 0 ? e.touches[0].target : e.target;
        const c1 = document.getElementById('custom-confirm'); 
        const c2 = document.getElementById('custom-move');
        if ((c1.style.display === 'flex' && !c1.contains(evtTarget) && !evtTarget.closest('.dish-card')) ||
            (c2.style.display === 'flex' && !c2.contains(evtTarget) && !evtTarget.closest('.dish-card'))) { 
            cancelPopup(); 
        }
        if (!evtTarget.closest('#customTplWrapper')) document.getElementById('customTplOptions')?.classList.remove('open');
        if (!evtTarget.closest('#catSelectWrapper')) document.getElementById('catSelectOptions')?.classList.remove('open');
        if (!evtTarget.closest('#moveSelectWrapper')) document.getElementById('moveSelectOptions')?.classList.remove('open');
        if (!evtTarget.closest('#batchMoveSelectWrapper')) document.getElementById('batchMoveSelectOptions')?.classList.remove('open');
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, {passive: true});

    function updateName(id, newName) { 
        const store = getStore('readwrite'); 
        store.get(id).onsuccess = e => { let data = e.target.result; data.name = newName; store.put(data); }; 
    }

    async function exportDatabase() {
        document.getElementById('saving-overlay').style.display = 'flex';
        document.getElementById('saving-overlay').innerHTML = "📦 正在打包系統資料，請稍候...";
        try {
            let backupData = {
                categories: JSON.parse(localStorage.getItem('bento_custom_categories') || 'null'),
                templates: JSON.parse(localStorage.getItem('custom_bento_tpls') || 'null'),
                dishes: [], bentos: []
            };
            backupData.dishes = await new Promise(res => { const req = getStore('readonly').getAll(); req.onsuccess = () => res(req.result); });
            backupData.bentos = await new Promise(res => { const req = db.transaction('bentos', 'readonly').objectStore('bentos').getAll(); req.onsuccess = () => res(req.result); });
            const blob = new Blob([JSON.stringify(backupData)], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `大廚擺盤系統備份_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            document.getElementById('saving-overlay').style.display = 'none';
            document.querySelector('#centered-confirm .btn-no').style.display = 'none';
            showCenteredConfirm("✅ 備份檔已成功下載！請妥善保存該 .json 檔案。", null);
        } catch (e) {
            document.getElementById('saving-overlay').style.display = 'none';
            alert("❌ 備份發生錯誤。");
        }
    }

    function importDatabase(input) {
        const file = input.files[0]; 
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.dishes || !data.bentos) throw new Error("格式錯誤");
                document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
                showCenteredConfirm("🚨 警告：還原將會「完全覆蓋」目前所有的食材、模板與作品！\n確定要執行還原嗎？", async () => {
                    document.getElementById('saving-overlay').style.display = 'flex';
                    document.getElementById('saving-overlay').innerHTML = "📥 正在還原資料，請勿關閉視窗...";
                    if (data.categories) localStorage.setItem('bento_custom_categories', JSON.stringify(data.categories));
                    if (data.templates) localStorage.setItem('custom_bento_tpls', JSON.stringify(data.templates));
                    await new Promise(res => { const req = getStore('readwrite').clear(); req.onsuccess = res; });
                    await new Promise(res => { const req = db.transaction('bentos', 'readwrite').objectStore('bentos').clear(); req.onsuccess = res; });
                    const dishTx = db.transaction('dishes', 'readwrite').objectStore('dishes');
                    data.dishes.forEach(d => dishTx.add(d));
                    const bentoTx = db.transaction('bentos', 'readwrite').objectStore('bentos');
                    data.bentos.forEach(b => bentoTx.add(b));
                    bentoTx.transaction.oncomplete = () => { alert("✅ 資料還原成功！系統將重新整理。"); location.reload(); };
                });
            } catch (err) { alert("❌ 備份檔讀取失敗，請確認檔案是否正確。"); }
            input.value = "";
        };
        reader.readAsText(file);
    }

    let isDesignMode = false;
    const drawCanvas = document.getElementById('drawCanvas');
    const drawWrapper = document.getElementById('drawCanvasWrapper');
    const bentoOuter = document.getElementById('shotArea');

    drawWrapper.style.width = "550px";
    drawWrapper.style.height = "360px";
    bentoOuter.style.backgroundColor = 'var(--wood)';
    bentoOuter.style.border = '5px solid #3d2518';
    bentoOuter.style.boxShadow = '0 25px 60px rgba(0,0,0,0.5)';
    bentoOuter.style.backgroundImage = 'none';
    window.addEventListener('load', () => { setTimeout(autoScaleBento, 100); setTimeout(autoScaleBento, 500); });

    function startNewDesign() {
        const executeClearAndDesign = (withPhoto) => {
            drawCanvas.innerHTML = ''; 
            currentBentoBgUrl = '';
            bentoOuter.style.backgroundImage = 'none'; 
            bentoOuter.style.backgroundColor = 'var(--wood)'; 
            bentoOuter.style.border = '5px solid #3d2518';
            document.getElementById('boxW').value = 550; 
            document.getElementById('boxH').value = 360;
            drawWrapper.style.width = "550px"; 
            drawWrapper.style.height = "360px";
            if (!isDesignMode) toggleDesignMode();
            if (withPhoto) { setTimeout(() => document.getElementById('bgImgIn').click(), 100); }
            if (window.innerWidth <= 850) {
                setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 150);
            }
        };
        const promptForPhoto = () => {
            document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
            document.querySelector('#centered-confirm .btn-yes').innerHTML = '🖼️ 載入照片'; 
            document.querySelector('#centered-confirm .btn-no').innerHTML = '⬜ 略過，直接畫';
            showCenteredConfirm("💡 繪製新模板提醒\n\n強烈建議您先【載入實體便當盒照片】作為底圖，\n這樣設計出來的格子比例會更真實精準喔！\n\n請問要現在載入照片嗎？", 
                () => { executeClearAndDesign(true); }, 
                () => { executeClearAndDesign(false); }
            );
        };
        if(drawCanvas.innerHTML.trim() !== '') {
            document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
            showCenteredConfirm("這將會清空目前的擺盤畫面，進入「全新模板設計」模式，確定嗎？", () => { setTimeout(promptForPhoto, 300); });
            return;
        }
        promptForPhoto();
    }

    async function loadBentoBackground(input) {
        if (!input.files || !input.files[0]) return;
        const dataUrl = await new Promise(res => { const reader = new FileReader(); reader.onload = e => res(e.target.result); reader.readAsDataURL(input.files[0]); }); 
        const img = new Image();
        img.onload = async () => {
            const maxWidth = 800; 
            const scale = Math.min(maxWidth / img.width, 1);
            const c = document.createElement('canvas'); 
            c.width = img.width * scale; 
            c.height = img.height * scale; 
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); 
            currentBentoBgUrl = c.toDataURL('image/webp', 0.8);
            document.getElementById('boxW').value = 550;
            document.getElementById('boxH').value = 360;
            drawWrapper.style.width = "550px";
            drawWrapper.style.height = "360px";
            bentoOuter.style.backgroundImage = `url(${currentBentoBgUrl})`;
            bentoOuter.style.backgroundColor = 'transparent';
            bentoOuter.style.border = 'none'; 
            bentoOuter.style.boxShadow = 'none'; 
            bentoOuter.style.backgroundSize = '100% 100%'; 
            input.value = "";
            if (!isDesignMode) toggleDesignMode();
            updateBoxSize(); 
            autoScaleBento();
        };
        img.src = dataUrl;
    }

    function toggleDesignMode() {
        isDesignMode = !isDesignMode;
        if(isDesignMode) {
            document.body.classList.add('design-mode');
            document.getElementById('boxW').value = parseInt(drawWrapper.style.width) || drawWrapper.offsetWidth;
            document.getElementById('boxH').value = parseInt(drawWrapper.style.height) || drawWrapper.offsetHeight;
            activeTarget = null; 
            document.querySelectorAll('.active').forEach(s => s.classList.remove('active')); 
            autoScaleBento();
        } else {
            document.body.classList.remove('design-mode');
            activeTarget = null; 
            document.querySelectorAll('.active').forEach(s => s.classList.remove('active')); 
            autoScaleBento();
        }
        updateGlobalCtrl();
    }

    function resetStandardSize() { 
        document.getElementById('boxW').value = 550; 
        document.getElementById('boxH').value = 360; 
        updateBoxSize(); 
    }

    function updateBoxSize() {
        const oldW = parseFloat(drawWrapper.style.width) || drawWrapper.offsetWidth; 
        const oldH = parseFloat(drawWrapper.style.height) || drawWrapper.offsetHeight;
        let newW = parseFloat(document.getElementById('boxW').value); 
        let newH = parseFloat(document.getElementById('boxH').value);
        if (isNaN(newW) || newW < 200) newW = 200; 
        if (isNaN(newH) || newH < 200) newH = 200;
        drawWrapper.style.width = newW + "px"; 
        drawWrapper.style.height = newH + "px";
        const ratioX = newW / oldW; 
        const ratioY = newH / oldH;
        document.querySelectorAll('.slot').forEach(s => {
            s.style.left = (parseFloat(s.style.left) * ratioX) + "px"; 
            s.style.top = (parseFloat(s.style.top) * ratioY) + "px";
            s.style.width = (parseFloat(s.style.width) * ratioX) + "px"; 
            s.style.height = (parseFloat(s.style.height) * ratioY) + "px";
        });
        updateGlobalCtrl();
    }

    function addNewSlot() { 
        const w = 150, h = 150; 
        const l = (drawWrapper.offsetWidth - w) / 2; 
        const t = (drawWrapper.offsetHeight - h) / 2; 
        addSlot(l, t, w, h); 
    }

    let copiedSlotData = null;
    document.addEventListener('keydown', (e) => {
        if (!isDesignMode) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            if (activeTarget && activeTarget.classList.contains('slot')) {
                copiedSlotData = { w: parseFloat(activeTarget.style.width), h: parseFloat(activeTarget.style.height), l: parseFloat(activeTarget.style.left), t: parseFloat(activeTarget.style.top), a: parseFloat(activeTarget.dataset.angle) || 0 };
                const btnStatus = document.getElementById('db-status');
                btnStatus.innerText = `✅ 格子已複製`;
                btnStatus.style.display = 'block';
                setTimeout(() => { btnStatus.style.display = 'none'; }, 1000);
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            if (copiedSlotData) {
                e.preventDefault();
                copiedSlotData.l += 20; copiedSlotData.t += 20;
                addSlot(copiedSlotData.l, copiedSlotData.t, copiedSlotData.w, copiedSlotData.h, copiedSlotData.a);
                const slots = document.querySelectorAll('.slot');
                const newSlot = slots[slots.length - 1];
                document.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
                newSlot.classList.add('active');
                activeTarget = newSlot; 
                updateGlobalCtrl(); 
                saveState();
            }
        }
    });

    function saveCustomTemplate() {
        showPrompt({
            icon: '💾', title: '儲存實體模板',
            label: '請為模板命名', defaultVal: '大師特製實體盒',
            okText: '💾 儲存'
        }, (name) => {
            if (!name || !name.trim()) return;
            const w = parseFloat(drawWrapper.style.width) || drawWrapper.offsetWidth; 
            const h = parseFloat(drawWrapper.style.height) || drawWrapper.offsetHeight;
            const slots = [];
            document.querySelectorAll('.slot').forEach(s => { 
                slots.push({ l: parseFloat(s.style.left), t: parseFloat(s.style.top), w: parseFloat(s.style.width), h: parseFloat(s.style.height), a: parseFloat(s.dataset.angle) || 0 }); 
            });
            let tpls = JSON.parse(localStorage.getItem('custom_bento_tpls') || '[]'); 
            tpls.push({ name: name.trim(), w, h, slots, bgUrl: currentBentoBgUrl }); 
            localStorage.setItem('custom_bento_tpls', JSON.stringify(tpls));
            selectedCustomTplIndex = tpls.length - 1; 
            renderCustomTemplates(); 
            toggleDesignMode(); 
            document.querySelector('#centered-confirm .btn-no').style.display = 'none'; 
            showCenteredConfirm("✅ 實體模板已成功儲存！", null);
        });
    }

    let selectedCustomTplIndex = -1;
    function toggleCustomSelect() { document.getElementById('customTplOptions').classList.toggle('open'); }

    function renderCustomTemplates() {
        const optionsContainer = document.getElementById('customTplOptions'); 
        const selectedContainer = document.getElementById('customTplSelected');
        optionsContainer.innerHTML = '';
        let tpls = JSON.parse(localStorage.getItem('custom_bento_tpls') || '[]');
        if(tpls.length === 0) { selectedContainer.innerHTML = '-- 尚無模板 --'; selectedCustomTplIndex = -1; return; }
        if (selectedCustomTplIndex >= tpls.length || selectedCustomTplIndex < 0) { selectedCustomTplIndex = 0; }
        tpls.forEach((tpl, index) => {
            const maxW = 40; const scale = maxW / tpl.w; const h = tpl.h * scale;
            const bgStyle = tpl.bgUrl ? `background-image: url(${tpl.bgUrl}); border: none; background-size: 100% 100%;` : '';
            let miniLayout = `<div class="mini-layout" style="width:${maxW}px; height:${h}px; ${bgStyle}">`;
            tpl.slots.forEach(s => { 
                let angleStyle = s.a ? `transform: rotate(${s.a}deg);` : '';
                miniLayout += `<div class="mini-slot" style="left:${s.l*scale}px; top:${s.t*scale}px; width:${s.w*scale}px; height:${s.h*scale}px; ${angleStyle}"></div>`; 
            });
            miniLayout += `</div>`;
            const opt = document.createElement('div'); 
            opt.className = 'custom-option'; 
            opt.style.justifyContent = 'space-between';
            opt.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; flex:1;" title="點擊載入此模板">
                    ${miniLayout} <span style="font-weight:bold; color:var(--blue);">${tpl.name}</span>
                </div>
                <div style="padding: 5px; border-radius: 4px; color: #f44336; font-size: 14px;" onmouseover="this.style.background='#ffebee'" onmouseout="this.style.background='transparent'" onclick="event.stopPropagation(); deleteCustomTemplate(${index});" title="刪除模板">🗑️</div>
            `;
            opt.firstElementChild.onclick = (e) => { 
                e.stopPropagation(); selectedCustomTplIndex = index; updateSelectedCustomDisplay(); 
                document.getElementById('customTplOptions').classList.remove('open'); loadSelectedCustomTemplate();
                if (window.innerWidth <= 850) {
                    setTimeout(() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 100);
                }
            };
            optionsContainer.appendChild(opt);
        });
        updateSelectedCustomDisplay();
    }

    function updateSelectedCustomDisplay() {
        let tpls = JSON.parse(localStorage.getItem('custom_bento_tpls') || '[]');
        if(selectedCustomTplIndex >= 0 && selectedCustomTplIndex < tpls.length) {
            const tpl = tpls[selectedCustomTplIndex];
            const maxW = 30; const scale = maxW / tpl.w; const h = tpl.h * scale;
            const bgStyle = tpl.bgUrl ? `background-image: url(${tpl.bgUrl}); border: none; background-size: 100% 100%;` : '';
            let miniLayout = `<div class="mini-layout" style="width:${maxW}px; height:${h}px; border-width:1px; ${bgStyle}">`;
            tpl.slots.forEach(s => { 
                let angleStyle = s.a ? `transform: rotate(${s.a}deg);` : '';
                miniLayout += `<div class="mini-slot" style="left:${s.l*scale}px; top:${s.t*scale}px; width:${s.w*scale}px; height:${s.h*scale}px; ${angleStyle}"></div>`; 
            });
            miniLayout += `</div>`;
            document.getElementById('customTplSelected').innerHTML = `${miniLayout} <span>${tpl.name}</span>`;
        }
    }

    function loadSelectedCustomTemplate() {
        if(selectedCustomTplIndex === -1) return;
        let tpls = JSON.parse(localStorage.getItem('custom_bento_tpls') || '[]');
        const tpl = tpls[selectedCustomTplIndex];
        if(!tpl) return;
        if(drawCanvas.innerHTML.trim() !== '') {
            document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
            showCenteredConfirm("載入模板將會清空目前的畫面，確定嗎？", () => { executeLoadCustomTemplate(tpl); });
        } else { executeLoadCustomTemplate(tpl); }
    }

    function executeLoadCustomTemplate(tpl) {
        drawCanvas.innerHTML = ''; 
        document.querySelectorAll('.food').forEach(f => f.remove());
        
        // 🌟 新增這行：只要換了新的空便當盒，就忘記舊的 ID，當作全新作品！
        currentCloudDocId = null; 

        drawWrapper.style.width = tpl.w + "px"; 
        drawWrapper.style.height = tpl.h + "px";
        document.getElementById('boxW').value = Math.round(tpl.w); 
        document.getElementById('boxH').value = Math.round(tpl.h);
        currentBentoBgUrl = tpl.bgUrl || '';
        
        if (currentBentoBgUrl) {
            bentoOuter.style.backgroundImage = `url(${currentBentoBgUrl})`; 
            bentoOuter.style.backgroundColor = 'transparent'; 
            bentoOuter.style.border = 'none'; 
            bentoOuter.style.boxShadow = 'none';
            bentoOuter.style.backgroundSize = '100% 100%';
            const bgImg = new Image();
            bgImg.onload = () => { setTimeout(autoScaleBento, 50); };
            bgImg.onerror = () => { setTimeout(autoScaleBento, 50); };
            bgImg.src = currentBentoBgUrl;
        } else {
            bentoOuter.style.backgroundImage = 'none'; 
            bentoOuter.style.backgroundColor = 'var(--wood)'; 
            bentoOuter.style.border = '5px solid #3d2518'; 
            bentoOuter.style.boxShadow = '0 25px 60px rgba(0,0,0,0.5)';
            setTimeout(autoScaleBento, 300);
        }
        
        tpl.slots.forEach(s => addSlot(s.l, s.t, s.w, s.h, s.a)); 
        saveState();
    }
    function generateAutoName() {
        const slotCount = document.querySelectorAll('.slot').length;
        const foodNodes = document.querySelectorAll('.food');
        let names = [];
        foodNodes.forEach(f => { if (f.dataset.name && f.dataset.name !== '新食材' && f.dataset.name !== '未知食材') names.push(f.dataset.name); });
        names = [...new Set(names)];
        let foodStr = names.slice(0, 3).join('+');
        if (names.length > 3) foodStr += '...';
        return `${slotCount}格_${foodStr || '空盒'}`;
    }

    function initSavePlatedBento() {
        if(isDesignMode) { 
            document.querySelector('#centered-confirm .btn-no').style.display = 'none'; 
            showCenteredConfirm("請先離開「設計空盒」模式，再儲存擺盤作品！", null); 
            return; 
        }
        cancelPopup(); 
        document.getElementById('save-bento-name').value = generateAutoName(); 
        document.getElementById('save-modal').style.display = 'flex';
    }

  // ============================================
    // 儲存擺盤作品 (高畫質極速版)
    // ============================================
    async function confirmSavePlatedBento() {
        const name = document.getElementById('save-bento-name').value || "未命名擺盤作品";
        cancelPopup(); 
        activeTarget = null; 
        isDragging = false;
        document.querySelectorAll('.active').forEach(f => f.classList.remove('active')); 
        updateGlobalCtrl();

        const savingOverlay = document.getElementById('saving-overlay');
        savingOverlay.innerHTML = "📸 正在極速儲存雲端，請稍候...";
        savingOverlay.style.display = 'flex';
        savingOverlay.style.zIndex = '999999';

        try {
            // 拍照擷取縮圖
            const area = document.getElementById('shotArea'); 
            const oldTransform = area.style.transform;
            area.style.transition = 'none'; 
            area.style.transform = 'scale(1)';
            await new Promise(r => requestAnimationFrame(r));
            
            // 恢復 100% 原始解析度，並給予 80% 的高畫質 WebP
            const cvs = await html2canvas(area, { scale: 1, useCORS: true, backgroundColor: null }); 
            const thumbnailBase64 = cvs.toDataURL('image/webp', 0.8);
            
            area.style.transform = oldTransform; 
            setTimeout(() => area.style.transition = 'transform 0.2s ease-out', 50);

            // 上傳縮圖到 Storage
            const byteString = atob(thumbnailBase64.split(',')[1]);
            const mimeString = thumbnailBase64.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const thumbnailBlob = new Blob([ab], { type: mimeString });

            const thumbName = `gallery_thumbs/${window.currentUser.uid}_${Date.now()}.webp`;
            const thumbRef = window.fbRef(window.firebaseStorage, thumbName);
            await window.fbUploadBytes(thumbRef, thumbnailBlob);
            const thumbnailUrl = await window.fbGetDownloadURL(thumbRef);

            // 直接寫入已經瘦身的 HTML 結構
            const w = drawWrapper.style.width; 
            const h = drawWrapper.style.height; 
            const htmlContent = drawCanvas.innerHTML;

            const payload = {
                name: name,
                w: w,
                h: h,
                html: htmlContent, 
                bgUrl: currentBentoBgUrl,
                thumbnail: thumbnailUrl, 
                uid: window.currentUser.uid, 
                authorEmail: window.currentUser.email,
                updatedAt: window.fbServerTimestamp()
            };

            // 執行 Firestore 儲存
            if (currentCloudDocId) {
                const docRef = window.fbDoc(window.firebaseDb, "bento_combinations", currentCloudDocId);
                await window.fbUpdateDoc(docRef, payload);
            } else {
                payload.createdAt = window.fbServerTimestamp();
                const docRef = await window.fbAddDoc(window.fbCollection(window.firebaseDb, "bento_combinations"), payload);
                currentCloudDocId = docRef.id; 
            }

            db.transaction('bentos', 'readwrite').objectStore('bentos').add({ 
                name, w, h, html: htmlContent, bgUrl: currentBentoBgUrl, thumbnail: thumbnailUrl, timestamp: Date.now() 
            });
            
            savingOverlay.style.display = 'none';
            showSummaryModal(); 

        } catch (error) {
            console.error("雲端存檔失敗：", error);
            savingOverlay.style.display = 'none';
            showCenteredConfirm("❌ 儲存失敗，請確認網路連線。\n" + error.message, null);
            document.querySelector('#centered-confirm .btn-no').style.display = 'none';
        }
    }
let isGalleryEditMode = false;

window.toggleGalleryEditMode = function(e) {
    if (e) e.stopPropagation();
    isGalleryEditMode = !isGalleryEditMode;
    const btns = document.querySelectorAll('.gallery-action-btn');
    btns.forEach(btn => {
        btn.style.display = isGalleryEditMode ? 'flex' : 'none';
    });
    const editToggleBtn = document.getElementById('gallery-edit-toggle');
    if (editToggleBtn) {
        editToggleBtn.innerHTML = isGalleryEditMode ? '✅ 完成編輯' : '✏️ 編輯作品';
        editToggleBtn.style.background = isGalleryEditMode ? '#4CAF50' : 'var(--gold)';
    }
};

async function openCloudGallery(type = 'combinations') {
    cancelPopup(); 
    const wasEditing = isGalleryEditMode;
    isGalleryEditMode = false;

    const modal = document.getElementById('gallery-modal');
    const h3 = modal.querySelector('h3');
    if (h3) {
        h3.innerHTML = `🍱 我的圖庫 <button id="gallery-edit-toggle" onclick="toggleGalleryEditMode(event)" style="margin-left:15px; font-size:13px; padding:5px 12px; background:var(--gold); color:white; border:none; border-radius:6px; cursor:pointer; vertical-align:middle; box-shadow:0 2px 4px rgba(0,0,0,0.2);">✏️ 編輯作品</button>`;
    }

    const grid = document.getElementById('gallery-grid'); 
    grid.innerHTML = '<div style="text-align:center; width:100%;">⏳ 雲端資料載入中...</div>';
    
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('gallery-modal').style.display = 'flex';

    try {
        const collectionName = type === 'combinations' ? "bento_combinations" : "bento_photos";
        const q = window.fbQuery(window.fbCollection(window.firebaseDb, collectionName), window.fbOrderBy("createdAt", "desc"));
        const querySnapshot = await window.fbGetDocs(q);
        
        grid.innerHTML = '';
        if (querySnapshot.empty) { 
            grid.innerHTML = '<div class="gallery-empty">📭 雲端目前沒有任何資料喔！</div>'; 
            return; 
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data(); 
            const docId = docSnap.id;
            const card = document.createElement('div'); 
            card.className = 'gallery-card';
            card.style.position = 'relative'; 
            
            const isMine = window.currentUser && (data.uid === window.currentUser.uid || data.authorEmail === window.currentUser.email);
            const canEdit = isMine || (window.currentUser && ADMIN_EMAILS.includes(window.currentUser.email));
            
            const title = type === 'combinations' ? data.name : (data.authorEmail.split('@')[0] + ' 的便當');
            const safeTitle = title.replace(/'/g, "\\'");
            
            let delBtnHTML = canEdit ? `<div class="gallery-action-btn" onclick="event.stopPropagation(); window.deleteCloudDoc('${collectionName}', '${docId}')" title="刪除作品" style="position:absolute; top:5px; right:5px; background:#f44336; color:white; width:26px; height:26px; border-radius:50%; display:none; justify-content:center; align-items:center; cursor:pointer; font-size:16px; font-weight:bold; z-index:999; box-shadow:0 2px 6px rgba(0,0,0,0.5); line-height:1; pointer-events:auto;">×</div>` : '';
            
            let editBtnHTML = (type === 'combinations' && canEdit) ? `<div class="gallery-action-btn" onclick="event.stopPropagation(); window.renameCloudDoc('${collectionName}', '${docId}', '${safeTitle}')" title="修改名稱" style="position:absolute; top:5px; right:38px; background:var(--gold); color:white; width:26px; height:26px; border-radius:50%; display:none; justify-content:center; align-items:center; cursor:pointer; font-size:14px; z-index:999; box-shadow:0 2px 6px rgba(0,0,0,0.5); pointer-events:auto;">✏️</div>` : '';

            const imgSrc = type === 'combinations' ? data.thumbnail : data.imageUrl;
            
            let categoryBadge = '';
            if (type === 'photos' && data.category) { 
                categoryBadge = `<div style="position:absolute; top:5px; left:5px; background:var(--gold); color:white; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:bold; z-index:999; box-shadow:0 2px 4px rgba(0,0,0,0.4); pointer-events:none;">${data.category}</div>`; 
            }

            card.innerHTML = `
                ${categoryBadge}
                ${editBtnHTML}
                ${delBtnHTML}
                <img src="${imgSrc}" class="gallery-img" style="width:100%; border-radius:8px; display:block;">
                <div class="gallery-name" title="${title}" style="padding:10px 8px; font-size:13px; font-weight:bold; text-align:center; color:#e0e6ed; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
            `;

            card.onclick = () => { openLightbox(data, type, docId); };
            grid.appendChild(card);
        });

        if (wasEditing) {
            toggleGalleryEditMode();
        }

    } catch (error) { 
        console.error("讀取圖庫失敗:", error); 
        grid.innerHTML = '<div class="gallery-empty">❌ 讀取失敗，請確認權限或網路。</div>'; 
    }
}

window.renameCloudDoc = function(collectionName, docId, oldName) {
    const currentType = collectionName === 'bento_combinations' ? 'combinations' : 'photos';
    
    // 隱藏圖庫，避免彈窗重疊導致背景過暗
    document.getElementById('gallery-modal').style.display = 'none';
    
    showPrompt({ 
        icon: '✏️', 
        title: '修改作品名稱', 
        label: '請輸入新的名稱', 
        defaultVal: oldName, 
        okText: '💾 儲存' 
    }, (newName) => {
        setTimeout(async () => {
            if (!newName || !newName.trim() || newName.trim() === oldName) {
                openCloudGallery(currentType); 
                return;
            }
            
            const savingOverlay = document.getElementById('saving-overlay');
            savingOverlay.innerHTML = "⏳ 正在更新名稱，請稍候...";
            savingOverlay.style.display = 'flex';
            savingOverlay.style.zIndex = '999999';

            try {
                const docRef = window.fbDoc(window.firebaseDb, collectionName, docId);
                await window.fbUpdateDoc(docRef, { name: newName.trim() });
                
                savingOverlay.style.display = 'none';
                openCloudGallery(currentType); 
                
            } catch (error) {
                console.error("改名失敗：", error);
                savingOverlay.style.display = 'none';
                alert("❌ 更新失敗，請檢查網路連線或權限。");
                openCloudGallery(currentType);
            }
        }, 10);
    });

    const cancelBtn = document.querySelector('.prompt-cancel');
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            cancelCustomPrompt();
            openCloudGallery(currentType);
        };
    }
};

window.deleteCloudDoc = function(collectionName, docId) {
    const currentType = collectionName === 'bento_combinations' ? 'combinations' : 'photos';
    
    // 隱藏圖庫，避免彈窗重疊導致背景過暗
    document.getElementById('gallery-modal').style.display = 'none';
    document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
    
    showCenteredConfirm("🚨 確定要從雲端刪除這個作品嗎？此動作無法復原！", async () => {
        const savingOverlay = document.getElementById('saving-overlay');
        savingOverlay.innerHTML = "⏳ 正在刪除作品，請稍候...";
        savingOverlay.style.display = 'flex';
        savingOverlay.style.zIndex = '999999';

        try { 
            await window.fbDeleteDoc(window.fbDoc(window.firebaseDb, collectionName, docId)); 
            if (currentCloudDocId === docId) currentCloudDocId = null; 
            savingOverlay.style.display = 'none';
            openCloudGallery(currentType); 
        } catch (error) { 
            savingOverlay.style.display = 'none';
            alert("❌ 刪除失敗，權限不足或網路異常。"); 
            openCloudGallery(currentType);
        }
    }, () => {
        // 取消時重新打開圖庫
        openCloudGallery(currentType);
    });
};
  function loadPlatedBento(bento) {
    document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
    showCenteredConfirm("載入作品將會「覆蓋」目前畫面上的便當，確定要載入嗎？", () => {
        const savingOverlay = document.getElementById('saving-overlay');
        savingOverlay.innerHTML = "⏳ 正在載入作品佈局，請稍候...";
        savingOverlay.style.display = 'flex';
        savingOverlay.style.zIndex = '999999';

        try {
            drawWrapper.style.width = bento.w; 
            drawWrapper.style.height = bento.h;
            document.getElementById('boxW').value = parseInt(bento.w); 
            document.getElementById('boxH').value = parseInt(bento.h);
            currentBentoBgUrl = bento.bgUrl || '';
            
            if (currentBentoBgUrl) {
                bentoOuter.style.backgroundImage = `url(${currentBentoBgUrl})`; 
                bentoOuter.style.backgroundColor = 'transparent'; 
                bentoOuter.style.border = 'none'; 
                bentoOuter.style.boxShadow = 'none';
                bentoOuter.style.backgroundSize = '100% 100%';
            } else {
                bentoOuter.style.backgroundImage = 'none'; 
                bentoOuter.style.backgroundColor = 'var(--wood)'; 
                bentoOuter.style.border = '5px solid #3d2518'; 
                bentoOuter.style.boxShadow = '0 25px 60px rgba(0,0,0,0.5)';
            }
            
            drawCanvas.innerHTML = bento.html || '';

            setTimeout(autoScaleBento, 300); 
            historyStack = []; historyIndex = -1; saveState(); cancelPopup();
            savingOverlay.style.display = 'none';

        } catch (err) {
            console.error("載入失敗:", err);
            savingOverlay.style.display = 'none';
            alert("❌ 作品載入發生錯誤！");
        }
    });
}

window.renameCloudDoc = function(collectionName, docId, oldName) {
    const currentType = collectionName === 'bento_combinations' ? 'combinations' : 'photos';
    
    document.getElementById('gallery-modal').style.display = 'none';
    
    showPrompt({ 
        icon: '✏️', 
        title: '修改作品名稱', 
        label: '請輸入新的名稱', 
        defaultVal: oldName, 
        okText: '💾 儲存' 
    }, (newName) => {
        setTimeout(async () => {
            if (!newName || !newName.trim() || newName.trim() === oldName) {
                openCloudGallery(currentType); 
                return;
            }
            
            const savingOverlay = document.getElementById('saving-overlay');
            savingOverlay.innerHTML = "⏳ 正在更新名稱，請稍候...";
            savingOverlay.style.display = 'flex';
            savingOverlay.style.zIndex = '999999';

            try {
                const docRef = window.fbDoc(window.firebaseDb, collectionName, docId);
                await window.fbUpdateDoc(docRef, { name: newName.trim() });
                
                savingOverlay.style.display = 'none';
                openCloudGallery(currentType); 
                
            } catch (error) {
                console.error("改名失敗：", error);
                savingOverlay.style.display = 'none';
                alert("❌ 更新失敗，請檢查網路連線或權限。");
                openCloudGallery(currentType);
            }
        }, 10);
    });

    const cancelBtn = document.querySelector('.prompt-cancel');
    if (cancelBtn) {
        cancelBtn.setAttribute('onclick', `cancelCustomPrompt(); openCloudGallery('${currentType}'); document.querySelector('.prompt-cancel').setAttribute('onclick', 'cancelCustomPrompt()');`);
    }
};
    function addSlot(l, t, w, h, a = 0) {
        const slot = document.createElement('div'); 
        slot.className = 'slot'; slot.dataset.angle = a; 
        slot.style.left = parseFloat(l)+"px"; slot.style.top = parseFloat(t)+"px"; 
        slot.style.width = parseFloat(w)+"px"; slot.style.height = parseFloat(h)+"px";
        slot.style.transform = `rotate(${a}deg)`; 
        slot.innerHTML = `<div class="handle h-nw" data-h="nw"></div><div class="handle h-ne" data-h="ne"></div><div class="handle h-sw" data-h="sw"></div><div class="handle h-se" data-h="se"></div><div class="handle h-n" data-h="n"></div><div class="handle h-s" data-h="s"></div><div class="handle h-w" data-h="w"></div><div class="handle h-e" data-h="e"></div><div class="rotate-handle" data-h="rotate" title="旋轉">↻</div>`;
        drawCanvas.appendChild(slot);
    }

    function updateCursors(target, currentAngle) {
        if (currentAngle === undefined) currentAngle = parseFloat(target.dataset.angle) || 0;
        if (currentAngle < 0) currentAngle += 360;
        const baseAngles = { 'n': 0, 'ne': 45, 'e': 90, 'se': 135, 's': 180, 'sw': 225, 'w': 270, 'nw': 315 };
        const cursors = ['n-resize', 'ne-resize', 'e-resize', 'se-resize', 's-resize', 'sw-resize', 'w-resize', 'nw-resize'];
        target.querySelectorAll('.handle').forEach(h => {
            const type = h.dataset.h;
            if (baseAngles[type] !== undefined) {
                let adjustedAngle = (baseAngles[type] + currentAngle) % 360;
                if (adjustedAngle < 0) adjustedAngle += 360;
                h.style.cursor = cursors[Math.round(adjustedAngle / 45) % 8];
            }
        });
    }

    let activeTarget = null, currentHandle = null;
    let startX, startY, startW, startH, startLX, startTY, startCX, startCY, startAngle = 0, startMouseAngle = 0;
    let isResizingBento = false, isDragging = false, hasMoved = false; 
    let startBentoW = 0, startBentoH = 0; 
    let startSlots = [];
    let lastClickedFood = null; 
    let longPressTimer = null;
    let snapEnabled = true;

    function toggleSnap() {
        snapEnabled = !snapEnabled;
        const btn = document.getElementById('snapToggleBtn');
        if (snapEnabled) {
            btn.style.borderColor = '#4CAF50';
            btn.style.color = '#4CAF50';
            btn.querySelector('.txt').innerText = '吸附';
            btn.title = '吸附：開（點擊關閉）';
        } else {
            btn.style.borderColor = '#aaa';
            btn.style.color = '#aaa';
            btn.querySelector('.txt').innerText = '自由';
            btn.title = '吸附：關（點擊開啟）';
        }
    }

    function updateGlobalCtrl() {
        const ctrl = document.getElementById('globalCtrl');
        const resizer = document.getElementById('bentoResizer');
        if (!activeTarget) { ctrl.style.display = 'none'; if(resizer) resizer.style.display = ''; return; }
        if(resizer) resizer.style.display = 'none';
        ctrl.style.display = 'flex'; 
        const rect = activeTarget.getBoundingClientRect();
        const isSlot = activeTarget.classList.contains('slot'); 
        const currentMode = isSlot ? 'slot' : 'food';
        if (ctrl.dataset.mode !== currentMode) {
            if (isSlot) { ctrl.innerHTML = `<button class="del" onclick="globalAction('del')">❌ 刪除格子</button>`; } 
            else { ctrl.innerHTML = `<button onclick="globalAction('up')">🔼 上層</button><button class="del" onclick="globalAction('del')">❌ 刪除</button><button onclick="globalAction('down')">🔽 下層</button>`; }
            ctrl.dataset.mode = currentMode;
        }
        ctrl.style.left = (rect.left + rect.width / 2) + "px"; 
        ctrl.style.top = (rect.top - 80) + "px";
    }

    window.globalAction = function(act) {
        const target = lastClickedFood || activeTarget; 
        if(!target) return;
        if(act === 'del') { 
            target.remove(); 
            if(activeTarget === target) activeTarget = null;
            if(lastClickedFood === target) lastClickedFood = null;
            isDragging = false; updateGlobalCtrl(); saveState(); return; 
        }
        if(!isDesignMode) {
            let z = parseInt(target.style.zIndex || 100);
            if(act === 'up') { z += 1; target.style.zIndex = z; }
            if(act === 'down') { z -= 1; if (z < 11) z = 11; target.style.zIndex = z; }
            saveState(); setTimeout(() => updateGlobalCtrl(), 50);
        }
    };
    
    drawCanvas.ondragover = e => e.preventDefault();
    drawCanvas.ondrop = e => { 
        if(isDesignMode) return; 
        e.preventDefault(); 
        const evt = (e.touches && e.touches.length > 0) ? e.touches[0] : ((e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : e);
        const data = e.dataTransfer.getData('text/plain').split('|||');
        let targetSlot = null;
        const elements = document.elementsFromPoint(evt.clientX, evt.clientY);
        for (let el of elements) { if (el.classList.contains('slot')) { targetSlot = el; break; } }
        createFood(data[0], targetSlot, data[1] || '未知食材'); 
    };
    
    function addFoodByClick(src, name = '未知食材') { 
        if(!isDesignMode) {
            const slots = Array.from(document.querySelectorAll('.slot'));
            const foods = Array.from(document.querySelectorAll('.food'));
            const emptySlot = slots.find(slot => {
                const sL = parseFloat(slot.style.left), sT = parseFloat(slot.style.top);
                const sW = parseFloat(slot.style.width), sH = parseFloat(slot.style.height);
                const hasFood = foods.some(food => {
                    const fL = parseFloat(food.style.left), fT = parseFloat(food.style.top);
                    const fW = parseFloat(food.style.width), fH = parseFloat(food.style.height);
                    const fCx = fL + fW/2, fCy = fT + fH/2;
                    return fCx >= sL && fCx <= sL+sW && fCy >= sT && fCy <= sT+sH;
                });
                return !hasFood;
            });
            createFood(src, emptySlot || null, name);
            if (window.innerWidth <= 850) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }

    function createFood(src, targetSlot = null, name = '未知食材') {
    const img = new Image();
    img.onload = () => {
        const tempC = document.createElement('canvas'); 
        const tCtx = tempC.getContext('2d'); 
        tempC.width = img.width; 
        tempC.height = img.height; 
        tCtx.drawImage(img, 0, 0);
        
        const pixels = tCtx.getImageData(0, 0, img.width, img.height); 
        let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
        
        for (let y = 0; y < img.height; y++) { 
            for (let x = 0; x < img.width; x++) { 
                if (pixels.data[(y * img.width + x) * 4 + 3] > 0) { 
                    if (x < minX) minX = x; 
                    if (x > maxX) maxX = x; 
                    if (y < minY) minY = y; 
                    if (y > maxY) maxY = y; 
                } 
            } 
        }
        
        const fw = maxX - minX, fh = maxY - minY; 
        let pW, pH, initLeft, initTop, pAngle = 0;
        
        if (targetSlot) {
            const slotW = parseFloat(targetSlot.style.width); 
            const slotH = parseFloat(targetSlot.style.height); 
            const slotL = parseFloat(targetSlot.style.left); 
            const slotT = parseFloat(targetSlot.style.top);
            const foodAspect = fw / Math.max(fh, 1); 
            const slotAspect = slotW / Math.max(slotH, 1); 
            const fillRatio = 1.05;
            
            if (foodAspect > slotAspect) { 
                pW = slotW * fillRatio; 
                pH = pW / foodAspect; 
            } else { 
                pH = slotH * fillRatio; 
                pW = pH * foodAspect; 
            }
            initLeft = (slotL + (slotW - pW)/2) + "px"; 
            initTop = (slotT + (slotH - pH)/2) + "px"; 
            pAngle = parseFloat(targetSlot.dataset.angle) || 0;
        } else { 
            pW = 120; 
            pH = 120 * (fh / fw); 
            initLeft = (drawWrapper.offsetWidth / 2 - pW / 2) + "px"; 
            initTop = (drawWrapper.offsetHeight / 2 - pH / 2) + "px"; 
        }
        
        // 🚀 【極速核心】：在記憶體中就把圖片縮小到只比便當格大一點點的尺寸
        const renderW = Math.max(Math.round(pW * 1.5), 50);
        const renderH = Math.max(Math.round(pH * 1.5), 50);
        const cropC = document.createElement('canvas'); 
        cropC.width = renderW; 
        cropC.height = renderH; 
        cropC.getContext('2d').drawImage(img, minX, minY, fw, fh, 0, 0, renderW, renderH);

        document.querySelectorAll('.active').forEach(f => f.classList.remove('active'));
        const food = document.createElement('div'); 
        food.className = 'food'; 
        food.dataset.angle = pAngle; 
        food.dataset.name = name; 
        food.dataset.resized = "false";
        food.style.width = pW + "px"; 
        food.style.height = pH + "px"; 
        food.style.left = initLeft; 
        food.style.top = initTop; 
        food.style.transform = `rotate(${pAngle}deg)`; 
        food.style.zIndex = "100"; 
        
        // 將壓縮後的 WebP 存入 HTML，大幅降低 DOM 肥大問題
        food.innerHTML = `
            <img src="${cropC.toDataURL('image/webp', 0.8)}" draggable="false">
            <div class="handle h-nw" data-h="nw"></div><div class="handle h-ne" data-h="ne"></div>
            <div class="handle h-sw" data-h="sw"></div><div class="handle h-se" data-h="se"></div>
            <div class="handle h-n" data-h="n"></div><div class="handle h-s" data-h="s"></div>
            <div class="handle h-w" data-h="w"></div><div class="handle h-e" data-h="e"></div>
            <div class="rotate-handle" data-h="rotate" title="旋轉">↻</div>
        `;
        drawCanvas.appendChild(food); 
        activeTarget = null; 
        lastClickedFood = food; 
        updateGlobalCtrl(); 
        saveState();
    }; 
    img.src = src;
}

    function handleDown(e) {
        const isTouch = e.type.startsWith('touch');
        const evtTarget = isTouch && e.touches && e.touches.length > 0 ? e.touches[0].target : e.target;
        if (evtTarget && evtTarget.closest) {
            if (evtTarget.closest('#globalCtrl') || evtTarget.closest('.popup-box')) return;
            if (evtTarget.closest('.sidebar') || evtTarget.closest('.header') || evtTarget.closest('.toolbar')) {
                activeTarget = null; isDragging = false; 
                document.querySelectorAll('.active').forEach(el => el.classList.remove('active')); 
                updateGlobalCtrl(); return; 
            }
        }
        if (evtTarget && evtTarget.closest && evtTarget.closest('.bento-resizer')) {
            if (e.cancelable) e.preventDefault();
            isResizingBento = true; 
            const pos = getClientPos(e);
            startX = pos.x; startY = pos.y;
            startBentoW = parseFloat(drawWrapper.style.width) || drawWrapper.offsetWidth; 
            startBentoH = parseFloat(drawWrapper.style.height) || drawWrapper.offsetHeight;
            startSlots = Array.from(document.querySelectorAll('.slot')).map(slot => ({ 
                el: slot, l: parseFloat(slot.style.left)||0, t: parseFloat(slot.style.top)||0, w: parseFloat(slot.style.width)||0, h: parseFloat(slot.style.height)||0 
            }));
            return;
        }
        let targetFood = evtTarget && evtTarget.closest ? evtTarget.closest('.food') : null;
        let targetSlot = evtTarget && evtTarget.closest ? evtTarget.closest('.slot') : null;
        let clickedHandle = evtTarget && evtTarget.closest ? (evtTarget.closest('.handle') || evtTarget.closest('.rotate-handle')) : null;
        let target = null;
        if (isDesignMode) { target = clickedHandle ? clickedHandle.closest('.slot') : targetSlot; }
        else { target = clickedHandle ? clickedHandle.closest('.food') : targetFood; }
        hasMoved = false; 
        if(target) {
            if (e.cancelable) e.preventDefault(); 
            document.querySelectorAll('.active').forEach(el => el.classList.remove('active')); 
            target.classList.add('active'); activeTarget = target; 
            target.style.transition = 'none';
            document.getElementById('globalCtrl').style.display = 'none';
            currentHandle = clickedHandle ? (clickedHandle.getAttribute('data-h') || 'rotate') : null;
            if(!isDesignMode && target.classList.contains('food')) {
                lastClickedFood = target; 
                if (!currentHandle) {
                    clearTimeout(longPressTimer);
                    longPressTimer = setTimeout(() => {
                        if (activeTarget === target) { target.classList.add('grabbed'); target.classList.add('is-moving'); if (navigator.vibrate) navigator.vibrate(40); }
                    }, 250); 
                }
            }
            isDragging = true; 
            const pos = getClientPos(e);
            startX = pos.x; startY = pos.y;
            startW = parseFloat(target.style.width) || 150; 
            startH = parseFloat(target.style.height) || 150;
            startLX = parseFloat(target.style.left) || 0; 
            startTY = parseFloat(target.style.top) || 0;
            startCX = startLX + startW / 2; startCY = startTY + startH / 2;
            startAngle = parseFloat(target.dataset.angle) || 0;
            if (currentHandle === 'rotate') {
                const rect = target.getBoundingClientRect(); const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
                let rawX, rawY;
                if (e.touches && e.touches.length > 0) { rawX = e.touches[0].clientX; rawY = e.touches[0].clientY; }
                else { rawX = e.clientX; rawY = e.clientY; }
                startMouseAngle = Math.atan2(rawY - cy, rawX - cx) * (180 / Math.PI);
            }
            updateCursors(target, startAngle); 
        } else {
            activeTarget = null; isDragging = false; 
            document.querySelectorAll('.active').forEach(el => el.classList.remove('active')); 
            updateGlobalCtrl();
        }
    }

    function handleMove(e) {
        if (!isDragging && !isResizingBento) return;
        if (e.cancelable) e.preventDefault(); 
        document.getElementById('globalCtrl').style.display = 'none';
        const pos = getClientPos(e); 
        const dx = (pos.x - startX); 
        const dy = (pos.y - startY);
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMoved = true;
            if (activeTarget && activeTarget.classList.contains('food') && !currentHandle) {
                clearTimeout(longPressTimer); activeTarget.classList.add('grabbed'); activeTarget.classList.add('is-moving'); 
            }
        }
        if (isResizingBento) {
            let newW = Math.max(200, startBentoW + dx); let newH = Math.max(200, startBentoH + dy);
            drawWrapper.style.width = newW + "px"; drawWrapper.style.height = newH + "px";
            document.getElementById('boxW').value = Math.round(newW); document.getElementById('boxH').value = Math.round(newH);
            const ratioX = newW / startBentoW; const ratioY = newH / startBentoH;
            startSlots.forEach(s => {
                s.el.style.left = (s.l * ratioX) + "px"; s.el.style.top = (s.t * ratioY) + "px";
                s.el.style.width = (s.w * ratioX) + "px"; s.el.style.height = (s.h * ratioY) + "px";
            });
            return;
        }
        if(currentHandle) {
            if (currentHandle === 'rotate') {
                const rect = activeTarget.getBoundingClientRect(); const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
                let rawX, rawY;
                if (e.touches && e.touches.length > 0) { rawX = e.touches[0].clientX; rawY = e.touches[0].clientY; }
                else { rawX = e.clientX; rawY = e.clientY; }
                const currentMouseAngle = Math.atan2(rawY - cy, rawX - cx) * (180 / Math.PI); 
                const angleDiff = currentMouseAngle - startMouseAngle;
                const newAngle = startAngle + angleDiff;
                activeTarget.dataset.angle = newAngle; activeTarget.style.transform = `rotate(${newAngle}deg)`;
                updateCursors(activeTarget, newAngle);
            } else {
                activeTarget.dataset.resized = "true";
                const rad = -startAngle * Math.PI / 180;
                const lDx = dx * Math.cos(rad) - dy * Math.sin(rad); const lDy = dx * Math.sin(rad) + dy * Math.cos(rad);
                let deltaW = 0, deltaH = 0;
                if (currentHandle.includes('e')) deltaW = lDx; if (currentHandle.includes('w')) deltaW = -lDx;
                if (currentHandle.includes('s')) deltaH = lDy; if (currentHandle.includes('n')) deltaH = -lDy;
                let newW = Math.max(30, startW + deltaW); let newH = Math.max(30, startH + deltaH);
                let realDeltaW = newW - startW; let realDeltaH = newH - startH;
                let deltaCX = 0, deltaCY = 0;
                if (currentHandle.includes('e')) deltaCX = realDeltaW / 2; if (currentHandle.includes('w')) deltaCX = -realDeltaW / 2;
                if (currentHandle.includes('s')) deltaCY = realDeltaH / 2; if (currentHandle.includes('n')) deltaCY = -realDeltaH / 2;
                const rad2 = startAngle * Math.PI / 180;
                const gDeltaCX = deltaCX * Math.cos(rad2) - deltaCY * Math.sin(rad2); 
                const gDeltaCY = deltaCX * Math.sin(rad2) + deltaCY * Math.cos(rad2);
                activeTarget.style.width = newW + "px"; activeTarget.style.height = newH + "px";
                activeTarget.style.left = (startCX + gDeltaCX - newW / 2) + "px"; activeTarget.style.top = (startCY + gDeltaCY - newH / 2) + "px";
            }
        } else { 
            activeTarget.style.left = (startLX + dx) + "px"; 
            activeTarget.style.top = (startTY + dy) + "px";
        }
    }

    function handleUp(e) { 
        const isTouch = e.type.startsWith('touch');
        const evtTarget = e.target || (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].target : null);
        if (evtTarget && evtTarget.closest && (evtTarget.closest('#globalCtrl') || evtTarget.closest('.popup-box'))) return;
        const pos = getClientPos(e);
        let screenX, screenY;
        if (e.changedTouches && e.changedTouches.length > 0) { screenX = e.changedTouches[0].clientX; screenY = e.changedTouches[0].clientY; }
        else if (e.touches && e.touches.length > 0) { screenX = e.touches[0].clientX; screenY = e.touches[0].clientY; }
        else { screenX = e.clientX; screenY = e.clientY; }
        clearTimeout(longPressTimer);
        let tempTarget = activeTarget;
        if (tempTarget) { tempTarget.classList.remove('grabbed'); }
        if (hasMoved && tempTarget && tempTarget.classList.contains('food') && !currentHandle && !isResizingBento) {
            if (screenX !== undefined && screenY !== undefined) {
                tempTarget.style.display = 'none'; 
                const elements = document.elementsFromPoint(screenX, screenY);
                tempTarget.style.display = ''; 
                let targetSlot = null;
                for (let el of elements) { if (el.classList.contains('slot')) { targetSlot = el; break; } }
                if (targetSlot && snapEnabled) {
                    tempTarget.style.transition = 'all 0.2s ease-out';
                    const slotW = parseFloat(targetSlot.style.width);
                    const slotH = parseFloat(targetSlot.style.height);
                    const slotL = parseFloat(targetSlot.style.left);
                    const slotT = parseFloat(targetSlot.style.top);
                    const foodW = parseFloat(tempTarget.style.width);
                    const foodH = parseFloat(tempTarget.style.height);
                    const newL = slotL + (slotW - foodW) / 2;
                    const newT = slotT + (slotH - foodH) / 2;
                    tempTarget.style.left = newL + 'px';
                    tempTarget.style.top = newT + 'px';
                    const pAngle = parseFloat(targetSlot.dataset.angle) || 0;
                    tempTarget.dataset.angle = pAngle; tempTarget.style.transform = `rotate(${pAngle}deg)`;
                    const snappedTarget = tempTarget;
                    snappedTarget.classList.remove('active'); snappedTarget.classList.remove('is-moving'); 
                    activeTarget = null; updateGlobalCtrl(); 
                    setTimeout(() => { if (snappedTarget) { snappedTarget.style.transition = 'none'; snappedTarget.style.transition = ''; } }, 200);
                } else {
                    tempTarget.classList.remove('active'); tempTarget.classList.remove('is-moving');
                    activeTarget = null; updateGlobalCtrl();
                }
            }
            saveState(); isDragging = false; return; 
        }
        isDragging = false; 
        if (isResizingBento) { isResizingBento = false; saveState(); updateGlobalCtrl(); return; }
        if (!hasMoved && tempTarget) {
            tempTarget.classList.remove('is-moving'); activeTarget = tempTarget; tempTarget.classList.add('active'); updateGlobalCtrl();
        } else if (hasMoved && currentHandle && tempTarget) {
            tempTarget.classList.remove('is-moving'); activeTarget = tempTarget; updateGlobalCtrl(); saveState();
        }
        currentHandle = null; 
    }

    document.addEventListener('mousedown', handleDown, {passive: false}); 
    document.addEventListener('mousemove', handleMove, {passive: false}); 
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchstart', handleDown, {passive: false}); 
    document.addEventListener('touchmove', handleMove, {passive: false}); 
    document.addEventListener('touchend', handleUp);
    document.addEventListener('touchcancel', handleUp);
    document.addEventListener('contextmenu', e => { if (e.target.closest('.workspace')) e.preventDefault(); });

   function clearBento() { 
        if(isDesignMode) return; 
        drawCanvas.querySelectorAll('.food').forEach(f=>f.remove()); 
        
        // 🌟 新增這行：把雲端記憶清空，這樣下次存檔就會當作「全新作品」！
        currentCloudDocId = null; 
        
        saveState(); 
    }
    
    let historyStack = [], historyIndex = -1;
    
    function saveState() { 
        if(isDesignMode) return; 
        const actives = document.querySelectorAll('.active'); 
        actives.forEach(el => el.classList.remove('active'));
        if(historyIndex < historyStack.length - 1) { historyStack = historyStack.slice(0, historyIndex + 1); }
        historyStack.push({ html: drawCanvas.innerHTML, w: drawWrapper.style.width, h: drawWrapper.style.height }); 
        historyIndex++; 
        if(historyStack.length > 20) { historyStack.shift(); historyIndex--; } 
        actives.forEach(el => el.classList.add('active'));
    }
    
    function undo() { 
        if(isDesignMode) return; 
        if(historyIndex > 0) { 
            historyIndex--; 
            const state = historyStack[historyIndex];
            drawCanvas.innerHTML = state.html; drawWrapper.style.width = state.w; drawWrapper.style.height = state.h;
            document.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
            activeTarget = null; isDragging = false; setTimeout(autoScaleBento, 300); updateGlobalCtrl();
        } 
    }
    
    function redo() { 
        if(isDesignMode) return; 
        if(historyIndex < historyStack.length - 1) { 
            historyIndex++; 
            const state = historyStack[historyIndex];
            drawCanvas.innerHTML = state.html; drawWrapper.style.width = state.w; drawWrapper.style.height = state.h;
            document.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
            activeTarget = null; isDragging = false; setTimeout(autoScaleBento, 300); updateGlobalCtrl();
        } 
    }

    async function exportFinal() {
        if(isDesignMode) { 
            document.querySelector('#centered-confirm .btn-no').style.display = 'none'; 
            showCenteredConfirm("請先點擊「❌ 結束設計」離開設計模式再匯出圖片！", null); return; 
        }
        let defaultName = generateAutoName();
        showPrompt({
            icon: '📸', title: '匯出便當圖片',
            label: '請為圖片命名（留空則自動命名）', defaultVal: defaultName,
            okText: '📥 匯出'
        }, async (dlName) => {
            if (!dlName || dlName.trim() === '') dlName = defaultName;
            activeTarget = null; isDragging = false; updateGlobalCtrl();
            document.querySelectorAll('.active').forEach(f => f.classList.remove('active'));
            const area = document.getElementById('shotArea'); 
            const oldTransform = area.style.transform;
            const oldZoom = area.style.zoom;
            area.style.transition = 'none'; 
            area.style.transform = 'scale(1)';
            area.style.zoom = '1';
            await new Promise(r => requestAnimationFrame(r));
            const cvs = await html2canvas(area, { scale: 2, useCORS: true, backgroundColor: null });
            area.style.transform = oldTransform; 
            area.style.zoom = oldZoom;
            setTimeout(() => area.style.transition = 'transform 0.2s ease-out', 50);
            const a = document.createElement('a'); a.download = `${dlName.trim()}.png`; a.href = cvs.toDataURL(); a.click();
        });
    }

    async function checkAndPreloadFoods() {
        const store = getStore('readonly');
        const countReq = store.count();
        countReq.onsuccess = async () => {
            if (countReq.result === 0) {
                document.getElementById('saving-overlay').style.display = 'flex';
                document.getElementById('saving-overlay').innerHTML = "🍱 首次載入中... 正在為您準備大廚精選食材，請稍候...";
                let successCount = 0;
                for (let i = 1; i <= 40; i++) {
                    const numStr = String(i).padStart(2, '0');
                    const imgUrl = `food/${numStr}.png`; 
                    try {
                        const response = await fetch(imgUrl);
                        if (!response.ok) continue; 
                        const blob = await response.blob();
                        const base64Url = await new Promise(res => { const reader = new FileReader(); reader.onloadend = () => res(reader.result); reader.readAsDataURL(blob); });
                        const compressedUrl = await compressImage(base64Url);
                        await new Promise(res => { const addReq = getStore('readwrite').add({ src: compressedUrl, name: `精選食材 ${numStr}`, category: '待分類' }); addReq.onsuccess = res; });
                        successCount++;
                    } catch (e) { console.log(`無法載入 ${imgUrl}`); }
                }
                document.getElementById('saving-overlay').style.display = 'none';
                if (successCount > 0) {
                    loadCategory(currentCategoryVal); 
                    document.querySelector('#centered-confirm .btn-no').style.display = 'none';
                    showCenteredConfirm(`✅ 成功為您準備了 ${successCount} 道精選素食食材！\n歡迎開始排盤。`, null);
                }
            }
        };
    }
    
    function forceRestoreDefaults() {
        document.querySelector('#centered-confirm .btn-no').style.display = 'inline-block';
        showCenteredConfirm("💡 確定要恢復大廚的 40 道預設食材嗎？\n(這將會先清空您目前的食材，再重新下載預設包)", () => {
            getStore('readwrite').clear().onsuccess = () => { checkAndPreloadFoods(); };
        });
    }

document.addEventListener('contextmenu', function(e) {
    const dish = e.target.closest('.dish-img');
    if (dish) {
        e.preventDefault(); 
        let currentMC = dish.style.getPropertyValue('--mc') || "1";
        let nextMC = (currentMC.trim() === "1") ? "-1" : "1";
        dish.style.setProperty('--mc', nextMC);
        if (typeof showToast === 'function') {
            showToast(nextMC === "-1" ? "🔄 食材已鏡像翻轉" : "🔄 恢復原始方向");
        }
    }
});
