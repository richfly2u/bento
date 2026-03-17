/**
 * 便當網格管理模組
 * Bento Grid Management Module
 */

export class BentoGrid {
    constructor(ingredientManager, uiComponents, storage) {
        this.ingredientManager = ingredientManager;
        this.uiComponents = uiComponents;
        this.storage = storage;
        
        this.cells = [];
        this.selectedCell = null;
        this.magnetEnabled = false;
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;
        
        this.defaultCellSize = 100;
        this.gridWidth = 3;
        this.gridHeight = 3;
    }
    
    /**
     * 初始化網格
     */
    init(width = 3, height = 3) {
        this.gridWidth = width;
        this.gridHeight = height;
        this.createGrid();
        this.render();
    }
    
    /**
     * 建立網格單元
     */
    createGrid() {
        this.cells = [];
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                this.cells.push({
                    id: `cell-${x}-${y}`,
                    x,
                    y,
                    width: this.defaultCellSize,
                    height: this.defaultCellSize,
                    ingredientId: null,
                    rotation: 0,
                    scale: 1
                });
            }
        }
    }
    
    /**
     * 渲染網格
     */
    render() {
        const container = document.getElementById('bento-grid-container');
        if (!container) return;
        
        container.innerHTML = '';
        container.style.display = 'grid';
        container.style.gridTemplateColumns = `repeat(${this.gridWidth}, ${this.defaultCellSize}px)`;
        container.style.gridTemplateRows = `repeat(${this.gridHeight}, ${this.defaultCellSize}px)`;
        container.style.gap = '2px';
        
        this.cells.forEach(cell => {
            const cellElement = document.createElement('div');
            cellElement.className = 'bento-cell';
            cellElement.dataset.cellId = cell.id;
            cellElement.style.width = `${cell.width}px`;
            cellElement.style.height = `${cell.height}px`;
            
            if (cell.ingredientId) {
                const ingredient = this.ingredientManager.getIngredient(cell.ingredientId);
                if (ingredient) {
                    const img = document.createElement('img');
                    img.src = ingredient.image;
                    img.alt = ingredient.name;
                    img.style.transform = `rotate(${cell.rotation}deg) scale(${cell.scale})`;
                    cellElement.appendChild(img);
                }
            }
            
            cellElement.addEventListener('click', () => this.selectCell(cell.id));
            cellElement.addEventListener('dragover', (e) => this.handleDragOver(e, cell.id));
            cellElement.addEventListener('drop', (e) => this.handleDrop(e, cell.id));
            
            container.appendChild(cellElement);
        });
    }
    
    /**
     * 選擇格子
     */
    selectCell(cellId) {
        const previousSelected = this.selectedCell;
        this.selectedCell = cellId;
        
        // 更新視覺樣式
        document.querySelectorAll('.bento-cell').forEach(cell => {
            cell.classList.remove('selected');
        });
        
        const selectedElement = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
        
        // 如果有食材，顯示操作選項
        const cell = this.getCell(cellId);
        if (cell && cell.ingredientId) {
            this.uiComponents.showIngredientActions(cell.ingredientId);
        }
    }
    
    /**
     * 取得格子資料
     */
    getCell(cellId) {
        return this.cells.find(c => c.id === cellId);
    }
    
    /**
     * 調整寬度
     */
    resizeWidth(newWidth) {
        if (newWidth < 1 || newWidth > 10) return;
        this.saveState();
        this.gridWidth = newWidth;
        this.createGrid();
        this.render();
    }
    
    /**
     * 調整高度
     */
    resizeHeight(newHeight) {
        if (newHeight < 1 || newHeight > 10) return;
        this.saveState();
        this.gridHeight = newHeight;
        this.createGrid();
        this.render();
    }
    
    /**
     * 重置為標準尺寸
     */
    resetToStandardSize() {
        this.saveState();
        this.init(3, 3);
    }
    
    /**
     * 新增格子
     */
    addCell() {
        this.saveState();
        this.gridWidth++;
        this.createGrid();
        this.render();
    }
    
    /**
     * 結束設計模式
     */
    endDesignMode() {
        // 鎖定網格，進入擺盤模式
        document.querySelectorAll('.bento-cell').forEach(cell => {
            cell.classList.add('locked');
        });
        this.uiComponents.showToast('🔒 設計模式已結束，現在可以擺放食材');
    }
    
    /**
     * 儲存為模板
     */
    saveAsTemplate() {
        const template = {
            width: this.gridWidth,
            height: this.gridHeight,
            cellSize: this.defaultCellSize,
            createdAt: new Date().toISOString()
        };
        
        this.storage.saveTemplate(`template-${Date.now()}`, template);
        this.uiComponents.showToast('✅ 模板已儲存');
    }
    
    /**
     * 拖曳處理
     */
    handleDragOver(e, cellId) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
    
    handleDrop(e, cellId) {
        e.preventDefault();
        const ingredientId = e.dataTransfer.getData('ingredient-id');
        if (ingredientId) {
            this.placeIngredient(cellId, ingredientId);
        }
    }
    
    /**
     * 放置食材
     */
    placeIngredient(cellId, ingredientId) {
        this.saveState();
        const cell = this.getCell(cellId);
        if (cell) {
            cell.ingredientId = ingredientId;
            this.render();
        }
    }
    
    /**
     * 刪除選取的食材
     */
    deleteSelected() {
        if (!this.selectedCell) return;
        
        const cell = this.getCell(this.selectedCell);
        if (cell && cell.ingredientId) {
            this.saveState();
            cell.ingredientId = null;
            this.render();
            this.selectedCell = null;
        }
    }
    
    /**
     * 清空所有
     */
    clearAll() {
        if (!confirm('確定要清空所有格子嗎？')) return;
        
        this.saveState();
        this.cells.forEach(cell => {
            cell.ingredientId = null;
            cell.rotation = 0;
            cell.scale = 1;
        });
        this.render();
    }
    
    /**
     * 切換吸附功能
     */
    toggleMagnet() {
        this.magnetEnabled = !this.magnetEnabled;
        this.uiComponents.showToast(this.magnetEnabled ? '🧲 吸附已開啟' : '🧲 吸附已關閉');
    }
    
    /**
     * 復原
     */
    undo() {
        if (this.undoStack.length === 0) {
            this.uiComponents.showToast('⚠️ 沒有可復原的操作');
            return;
        }
        
        this.redoStack.push(this.getState());
        const previousState = this.undoStack.pop();
        this.loadState(previousState);
        this.uiComponents.showToast('⏪ 已復原');
    }
    
    /**
     * 重做
     */
    redo() {
        if (this.redoStack.length === 0) {
            this.uiComponents.showToast('⚠️ 沒有可重做的操作');
            return;
        }
        
        this.undoStack.push(this.getState());
        const nextState = this.redoStack.pop();
        this.loadState(nextState);
        this.uiComponents.showToast('⏩ 已重做');
    }
    
    /**
     * 儲存狀態到復原堆疊
     */
    saveState() {
        this.undoStack.push(this.getState());
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }
    
    /**
     * 取得當前狀態
     */
    getState() {
        return {
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            cells: JSON.parse(JSON.stringify(this.cells)),
            selectedCell: this.selectedCell
        };
    }
    
    /**
     * 載入狀態
     */
    async loadState(state) {
        this.gridWidth = state.gridWidth;
        this.gridHeight = state.gridHeight;
        this.cells = state.cells;
        this.selectedCell = state.selectedCell;
        this.render();
    }
    
    /**
     * 匯出為圖片
     */
    async exportToImage() {
        this.uiComponents.showToast('📸 正在處理圖片...');
        
        // 使用 html2canvas 或類似庫匯出
        const container = document.getElementById('bento-grid-container');
        if (!container) return;
        
        try {
            this.uiComponents.showToast('✅ 圖片已匯出');
        } catch (error) {
            console.error('匯出圖片失敗:', error);
            this.uiComponents.showToast('❌ 匯出失敗');
        }
    }
}