/**
 * 本地儲存模組
 * Storage Module
 */

export class Storage {
    constructor() {
        this.prefix = 'bento_';
    }
    
    set(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            localStorage.setItem(this.prefix + key, serializedValue);
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    }
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    }
    
    remove(key) {
        localStorage.removeItem(this.prefix + key);
    }
    
    clear() {
        localStorage.clear();
    }
    
    setApiKey(key) {
        this.set('gemini_api_key', key);
    }
    
    getApiKey() {
        return this.get('gemini_api_key');
    }
    
    saveIngredientLibrary(ingredients) {
        this.set('ingredient_library', ingredients);
    }
    
    getIngredientLibrary() {
        return this.get('ingredient_library', []);
    }
    
    async saveWork(name, state) {
        const works = this.get('works', []);
        const newWork = {
            id: `work-${Date.now()}`,
            name: name,
            state: state,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            thumbnail: null
        };
        
        works.push(newWork);
        this.set('works', works);
        return newWork;
    }
    
    getAllWorks() {
        return this.get('works', []);
    }
    
    getWork(workId) {
        const works = this.getAllWorks();
        return works.find(w => w.id === workId);
    }
    
    updateWork(workId, state) {
        const works = this.getAllWorks();
        const index = works.findIndex(w => w.id === workId);
        
        if (index !== -1) {
            works[index].state = state;
            works[index].updatedAt = new Date().toISOString();
            this.set('works', works);
            return true;
        }
        return false;
    }
    
    deleteWork(workId) {
        const works = this.getAllWorks();
        const filtered = works.filter(w => w.id !== workId);
        
        if (filtered.length < works.length) {
            this.set('works', filtered);
            return true;
        }
        return false;
    }
    
    saveTemplate(name, template) {
        const templates = this.get('templates', []);
        templates.push({
            id: `template-${Date.now()}`,
            name: name,
            ...template,
            createdAt: new Date().toISOString()
        });
        this.set('templates', templates);
    }
    
    getAllTemplates() {
        return this.get('templates', []);
    }
    
    getCurrentState() {
        return this.get('current_state');
    }
    
    saveCurrentState(state) {
        this.set('current_state', state);
    }
    
    clearCurrentState() {
        this.remove('current_state');
    }
    
    exportAllData() {
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            apiKey: this.getApiKey(),
            ingredients: this.getIngredientLibrary(),
            works: this.getAllWorks(),
            templates: this.getAllTemplates()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bento-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    async importAllData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (data.apiKey) this.setApiKey(data.apiKey);
            if (data.ingredients) this.saveIngredientLibrary(data.ingredients);
            if (data.works) this.set('works', data.works);
            if (data.templates) this.set('templates', data.templates);
            
            return { success: true, message: '✅ 資料還原成功' };
        } catch (error) {
            console.error('Import error:', error);
            return { success: false, error: '无效的備份文件' };
        }
    }
}