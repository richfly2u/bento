/**
 * 便當擺盤組合大師 - 主應用程式入口
 * Bento Platter Master - Main Application Entry Point
 */

import { BentoGrid } from './bento-grid.js';
import { IngredientManager } from './ingredient-manager.js';
import { OpenAIAPI } from './openai-api.js';
import { UIComponents } from './ui-components.js';
import { Storage } from './storage.js';
import { Utils } from './utils/helpers.js';

class BentoApp {
    constructor() {
        this.grid = null;
        this.ingredientManager = null;
        this.openaiAPI = null;
        this.uiComponents = null;
        this.storage = null;
        this.utils = null;
        
        this.init();
    }
    
    /**
     * 初始化應用程式
     */
    async init() {
        console.log('🍱 便當擺盤組合大師 初始化中...');
        
        // 初始化各模組
        this.storage = new Storage();
        this.utils = new Utils();
        this.uiComponents = new UIComponents();
        this.openaiAPI = new OpenAIAPI(this.storage);
        this.openaiAPI.init();
        this.ingredientManager = new IngredientManager(this.storage, this.openaiAPI);
        this.grid = new BentoGrid(this.ingredientManager, this.uiComponents, this.storage);
        
        // 等待 DOM 載入完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
        
        // 載入已儲存的狀態
        await this.loadSavedState();
        
        console.log('✅ 應用程式初始化完成');
    }
    
    /**
     * 設定事件監聽器
     */
    setupEventListeners() {
        // 便當外框控制
        this.setupGridControls();
        
        // 工具列按鈕
        this.setupToolbarButtons();
        
        // 食材管理
        this.setupIngredientControls();
        
        // AI 生成
        this.setupAIGeneration();
        
        // 儲存與匯出
        this.setupSaveExport();
        
        // 鍵盤快捷鍵
        this.setupKeyboardShortcuts();
    }
    
    /**
     * 設定便當網格控制
     */
    setupGridControls() {
        const widthInput = document.getElementById('grid-width');
        const heightInput = document.getElementById('grid-height');
        const standardSizeBtn = document.getElementById('standard-size-btn');
        const addCellBtn = document.getElementById('add-cell-btn');
        const endDesignBtn = document.getElementById('end-design-btn');
        const saveTemplateBtn = document.getElementById('save-template-btn');
        
        if (widthInput && heightInput) {
            widthInput.addEventListener('change', (e) => this.grid.resizeWidth(parseInt(e.target.value)));
            heightInput.addEventListener('change', (e) => this.grid.resizeHeight(parseInt(e.target.value)));
        }
        
        if (standardSizeBtn) {
            standardSizeBtn.addEventListener('click', () => this.grid.resetToStandardSize());
        }
        
        if (addCellBtn) {
            addCellBtn.addEventListener('click', () => this.grid.addCell());
        }
        
        if (endDesignBtn) {
            endDesignBtn.addEventListener('click', () => this.grid.endDesignMode());
        }
        
        if (saveTemplateBtn) {
            saveTemplateBtn.addEventListener('click', () => this.grid.saveAsTemplate());
        }
    }
    
    /**
     * 設定工具列按鈕
     */
    setupToolbarButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        const clearBtn = document.getElementById('clear-btn');
        const magnetBtn = document.getElementById('magnet-btn');
        
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.grid.undo());
        }
        
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.grid.redo());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.grid.clearAll());
        }
        
        if (magnetBtn) {
            magnetBtn.addEventListener('click', () => this.grid.toggleMagnet());
        }
    }
    
    /**
     * 設定食材控制
     */
    setupIngredientControls() {
        // 食材分類變更
        document.addEventListener('ingredient-category-change', (e) => {
            this.ingredientManager.updateIngredientCategory(e.detail.ingredientId, e.detail.newCategory);
        });
        
        // 批量更換分類
        const batchChangeBtn = document.getElementById('batch-change-category-btn');
        if (batchChangeBtn) {
            batchChangeBtn.addEventListener('click', () => this.ingredientManager.showBatchChangeModal());
        }
    }
    
    /**
     * 設定 AI 生成
     */
    setupAIGeneration() {
        const apiKeyInput = document.getElementById('openai-api-key') || document.getElementById('gemini-api-key');
        const ingredientInput = document.getElementById('ai-ingredient-input');
        const generateBtn = document.getElementById('ai-generate-btn');
        const saveKeyBtn = document.getElementById('save-api-key-btn');
        
        // 載入已儲存的 OpenAI API Key
        const savedApiKey = localStorage.getItem('openai_api_key') || this.storage.getApiKey();
        if (savedApiKey && apiKeyInput) {
            apiKeyInput.value = savedApiKey;
        }

        if (saveKeyBtn && apiKeyInput) {
            saveKeyBtn.addEventListener('click', () => {
                if (apiKeyInput.value) {
                    this.openaiAPI.setApiKey(apiKeyInput.value);
                    this.uiComponents.showToast('✅ OpenAI API Key 已儲存');
                }
            });
        }
        
        if (generateBtn && ingredientInput) {
            generateBtn.addEventListener('click', async () => {
                const ingredientName = ingredientInput.value.trim();
                if (!ingredientName) {
                    this.uiComponents.showToast('⚠️ 請輸入食材名稱');
                    return;
                }
                
                await this.ingredientManager.generateIngredientWithAI(ingredientName);
            });
        }
    }
    
    /**
     * 設定儲存與匯出
     */
    setupSaveExport() {
        const saveWorkBtn = document.getElementById('save-work-btn');
        const exportImageBtn = document.getElementById('export-image-btn');
        const galleryBtn = document.getElementById('gallery-btn');
        
        if (saveWorkBtn) {
            saveWorkBtn.addEventListener('click', () => this.saveCurrentWork());
        }
        
        if (exportImageBtn) {
            exportImageBtn.addEventListener('click', () => this.grid.exportToImage());
        }
        
        if (galleryBtn) {
            galleryBtn.addEventListener('click', () => this.showGallery());
        }
    }
    
    /**
     * 設定鍵盤快捷鍵
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Z: 復原
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.grid.undo();
            }
            
            // Ctrl/Cmd + Shift + Z: 重做
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.grid.redo();
            }
            
            // Delete: 刪除選取
            if (e.key === 'Delete') {
                e.preventDefault();
                this.grid.deleteSelected();
            }
            
            // Ctrl/Cmd + S: 儲存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveCurrentWork();
            }
        });
    }
    
    /**
     * 載入已儲存的狀態
     */
    async loadSavedState() {
        const savedState = this.storage.getCurrentState();
        if (savedState) {
            await this.grid.loadState(savedState);
            this.uiComponents.showToast('📂 已載入上次儲存的狀態');
        }
    }
    
    /**
     * 儲存當前作品
     */
    async saveCurrentWork() {
        const state = this.grid.getState();
        const name = await this.uiComponents.showSaveDialog(state);
        
        if (name) {
            await this.storage.saveWork(name, state);
            this.uiComponents.showToast(`✅ "${name}" 已儲存`);
        }
    }
    
    /**
     * 顯示作品圖庫
     */
    async showGallery() {
        const works = this.storage.getAllWorks();
        await this.uiComponents.showGalleryModal(works);
    }
}

// 啟動應用程式
const app = new BentoApp();

// 導出全域實例（除錯用）
if (typeof window !== 'undefined') {
    window.bentoApp = app;
}

export { BentoApp };