/**
 * UI 元件模組
 * UI Components Module
 */

export class UIComponents {
    constructor() {
        this.modalStack = [];
        this.toastContainer = null;
    }
    
    init() {
        this.createToastContainer();
    }
    
    createToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }
        this.toastContainer = container;
    }
    
    showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.cssText = `
            padding: 12px 24px;
            background: #333;
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    showConfirm(message) {
        return new Promise((resolve) => {
            const modal = this.createModal('confirm-modal');
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-message">${message}</div>
                    <div class="modal-actions">
                        <button class="btn-cancel">取消</button>
                        <button class="btn-confirm">確定</button>
                    </div>
                </div>
            `;
            
            modal.querySelector('.btn-cancel').onclick = () => {
                this.closeModal(modal);
                resolve(false);
            };
            
            modal.querySelector('.btn-confirm').onclick = () => {
                this.closeModal(modal);
                resolve(true);
            };
            
            this.openModal(modal);
        });
    }
    
    showPrompt(message, defaultValue = '') {
        return new Promise((resolve) => {
            const modal = this.createModal('prompt-modal');
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-message">${message}</div>
                    <input type="text" class="modal-input" value="${defaultValue}" 
                           style="width: 100%; padding: 8px; margin: 16px 0;">
                    <div class="modal-actions">
                        <button class="btn-cancel">取消</button>
                        <button class="btn-confirm">確定</button>
                    </div>
                </div>
            `;
            
            const input = modal.querySelector('.modal-input');
            
            modal.querySelector('.btn-cancel').onclick = () => {
                this.closeModal(modal);
                resolve(null);
            };
            
            modal.querySelector('.btn-confirm').onclick = () => {
                this.closeModal(modal);
                resolve(input.value);
            };
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    modal.querySelector('.btn-confirm').click();
                }
            });
            
            this.openModal(modal);
            input.focus();
        });
    }
    
    async showSaveDialog(state) {
        const defaultName = `擺盤作品-${new Date().toLocaleDateString()}`;
        const name = await this.showPrompt('請確認擺盤作品名稱：', defaultName);
        return name;
    }
    
    showIngredientActions(ingredientId) {
        const menu = document.getElementById('ingredient-actions-menu');
        if (menu) {
            menu.style.display = 'block';
            menu.dataset.ingredientId = ingredientId;
        }
    }
    
    async showGalleryModal(works) {
        const modal = this.createModal('gallery-modal');
        
        let worksHtml = '';
        if (works.length === 0) {
            worksHtml = '<p class="empty-message">尚未儲存任何作品</p>';
        } else {
            worksHtml = works.map(work => `
                <div class="gallery-item" data-work-id="${work.id}">
                    <div class="work-preview">${work.thumbnail || '🖼️'}</div>
                    <div class="work-info">
                        <h4>${work.name}</h4>
                        <span class="work-date">${new Date(work.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="work-actions">
                        <button class="btn-load">載入</button>
                        <button class="btn-delete">刪除</button>
                    </div>
                </div>
            `).join('');
        }
        
        modal.innerHTML = `
            <div class="modal-content gallery-content">
                <div class="modal-header">
                    <h2>🍱 我的圖庫</h2>
                    <button class="btn-close">×</button>
                </div>
                <div class="gallery-grid">
                    ${worksHtml}
                </div>
                <button class="btn-close-modal">關閉圖庫</button>
            </div>
        `;
        
        modal.querySelector('.btn-close').onclick = () => this.closeModal(modal);
        modal.querySelector('.btn-close-modal').onclick = () => this.closeModal(modal);
        
        modal.querySelectorAll('.btn-load').forEach(btn => {
            btn.onclick = () => {
                this.showToast('📂 載入作品中...');
                this.closeModal(modal);
            };
        });
        
        modal.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = async () => {
                const confirmed = await this.showConfirm('確定要刪除此作品嗎？');
                if (confirmed) {
                    this.showToast('🗑️ 作品已刪除');
                    this.closeModal(modal);
                }
            };
        });
        
        this.openModal(modal);
    }
    
    createModal(id) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = id;
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        return modal;
    }
    
    openModal(modal) {
        this.modalStack.push(modal);
        document.body.appendChild(modal);
    }
    
    closeModal(modal) {
        modal.remove();
        this.modalStack.pop();
    }
    
    closeAllModals() {
        while (this.modalStack.length > 0) {
            this.closeModal(this.modalStack[0]);
        }
    }
}

if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}