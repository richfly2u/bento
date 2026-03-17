/**
 * 食材管理模組
 * Ingredient Management Module
 */

export class IngredientManager {
    constructor(storage, geminiAPI) {
        this.storage = storage;
        this.geminiAPI = geminiAPI;
        this.ingredients = [];
        this.categories = [
            { id: 'uncategorized', name: '💡 待分類', icon: '💡' },
            { id: 'staple', name: '🍚 主食類', icon: '🍚' },
            { id: 'vegetable', name: '🥬 鮮蔬類', icon: '🥬' },
            { id: 'mushroom', name: '🍄 菇果類', icon: '🍄' },
            { id: 'tofu', name: '🍢 豆製品', icon: '🍢' },
            { id: 'grilled', name: '🔥 烤煎類', icon: '🔥' },
            { id: 'fried', name: '🍤 酥炸類', icon: '🍤' },
            { id: 'dimsum', name: '🥟 點心類', icon: '🥟' }
        ];
        
        this.loadIngredients();
    }
    
    loadIngredients() {
        const saved = this.storage.getIngredientLibrary();
        if (saved) {
            this.ingredients = saved;
        }
    }
    
    getIngredient(ingredientId) {
        return this.ingredients.find(ing => ing.id === ingredientId);
    }
    
    getAllIngredients() {
        return this.ingredients;
    }
    
    getIngredientsByCategory(categoryId) {
        if (categoryId === 'all') return this.ingredients;
        return this.ingredients.filter(ing => ing.category === categoryId);
    }
    
    addIngredient(ingredient) {
        const newIngredient = {
            id: `ing-${Date.now()}`,
            name: ingredient.name,
            image: ingredient.image,
            category: ingredient.category || 'uncategorized',
            createdAt: new Date().toISOString(),
            tags: ingredient.tags || []
        };
        
        this.ingredients.push(newIngredient);
        this.saveIngredients();
        return newIngredient;
    }
    
    updateIngredientCategory(ingredientId, newCategory) {
        const ingredient = this.getIngredient(ingredientId);
        if (ingredient) {
            ingredient.category = newCategory;
            this.saveIngredients();
            return true;
        }
        return false;
    }
    
    deleteIngredient(ingredientId) {
        const index = this.ingredients.findIndex(ing => ing.id === ingredientId);
        if (index !== -1) {
            this.ingredients.splice(index, 1);
            this.saveIngredients();
            return true;
        }
        return false;
    }
    
    batchChangeCategory(ingredientIds, newCategory) {
        let count = 0;
        ingredientIds.forEach(id => {
            if (this.updateIngredientCategory(id, newCategory)) {
                count++;
            }
        });
        this.saveIngredients();
        return count;
    }
    
    async generateIngredientWithAI(ingredientName) {
        try {
            const previewContainer = document.getElementById('ai-preview-container');
            if (previewContainer) {
                previewContainer.innerHTML = '<div class="loading">✨ 生成中，請稍候...</div>';
            }
            
            const result = await this.geminiAPI.generateIngredientImage(ingredientName);
            
            if (result.success && result.imageUrl) {
                const ingredient = this.addIngredient({
                    name: ingredientName,
                    image: result.imageUrl,
                    category: 'uncategorized'
                });
                
                if (previewContainer) {
                    previewContainer.innerHTML = `
                        <div class="ingredient-preview">
                            <img src="${ingredient.image}" alt="${ingredient.name}">
                            <p>${ingredient.name}</p>
                            <button onclick="window.bentoApp.ingredientManager.addFromPreview('${ingredient.id}')">
                                ✅ 存入食材庫
                            </button>
                        </div>
                    `;
                }
                
                console.log('✅ AI 食材生成成功:', ingredient.name);
            } else {
                throw new Error(result.error || '生成失敗');
            }
        } catch (error) {
            console.error('AI 生成失敗:', error);
            const previewContainer = document.getElementById('ai-preview-container');
            if (previewContainer) {
                previewContainer.innerHTML = `<div class="error">❌ 生成失敗：${error.message}</div>`;
            }
        }
    }
    
    addFromPreview(ingredientId) {
        const ingredient = this.getIngredient(ingredientId);
        if (ingredient) {
            console.log('✅ 食材已加入:', ingredient.name);
        }
    }
    
    saveIngredients() {
        this.storage.saveIngredientLibrary(this.ingredients);
    }
    
    renderCategorySelector(containerId, selectedCategory = 'uncategorized') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        const select = document.createElement('select');
        select.className = 'category-select';
        
        this.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            if (cat.id === selectedCategory) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        container.appendChild(select);
        return select;
    }
    
    getCategories() {
        return this.categories;
    }
    
    showBatchChangeModal() {
        console.log('顯示批量更換分類對話框');
    }
}