// js/bento/ui.js
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
            // 注意：這裡會呼叫擺盤大師的主邏輯功能
            if (typeof loadPlatedBento === 'function') {
                loadPlatedBento(data);       // 載入畫面
            }
            window.currentCloudDocId = docId;   // 記錄雲端ID以便覆蓋儲存
        };
        actionDiv.appendChild(loadBtn);
    }

    lightbox.style.display = 'flex';
};

window.closeLightbox = function() {
    document.getElementById('image-lightbox').style.display = 'none';
};
