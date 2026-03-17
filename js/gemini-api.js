/**
 * Gemini API 連接模組
 * Gemini API Connection Module
 */

export class GeminiAPI {
    constructor(storage) {
        this.storage = storage;
        this.apiKey = null;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta'
    }
    
    /**
     * 初始化 API
     */
    init() {
        this.apiKey = this.storage.getApiKey();
        if (!this.apiKey) {
            console.warn('⚠️ 未設定 Gemini API Key');
        }
    }
    
    /**
     * 設定 API Key
     */
    setApiKey(key) {
        this.apiKey = key;
        this.storage.setApiKey(key);
    }
    
    /**
     * 生成食材圖片提示詞
     */
    generatePrompt(ingredientName, options = {}) {
        const defaultPrompt = `請生成以下素食食材的去背俯視圖：${ingredientName}。食材呈現自然熟食擺盤狀態，背俯視 45 度角，色彩飽和真實，無陰影，絕對不要包含任何肉類、五辛 (蔥蒜韭薤興渠)，不要盤碗襯底。輸出尺寸 512x512px，純白或透明背景。`;
        
        if (options.customPrompt) {
            return options.customPrompt;
        }
        
        return defaultPrompt;
    }
    
    /**
     * 使用 Gemini 生成食材圖片
     */
    async generateIngredientImage(ingredientName, customPrompt = null) {
        if (!this.apiKey) {
            return {
                success: false,
                error: '請先輸入 Gemini API Key'
            };
        }
        
        try {
            const prompt = this.generatePrompt(ingredientName);
            
            const response = await fetch(`${this.baseUrl}/models/imagen-3.0-generate-001:predict`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.apiKey
                },
                body: JSON.stringify({
                    instances: [{
                        prompt: prompt
                    }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: '1:1',
                        negativePrompt: 'meat, garlic, onion, bowl, plate, shadow',
                        safetySetting: 'BLOCK_NONE'
                    }
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API 請求失敗');
            }
            
            const result = await response.json();
            
            if (result.predictions && result.predictions.length > 0) {
                const imageUrl = result.predictions[0].bytesBase64Encoded 
                    ? `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`
                    : result.predictions[0].imageUrl;
                
                return {
                    success: true,
                    imageUrl: imageUrl,
                    prompt: prompt
                };
            } else {
                throw new Error('未收到有效的圖片回應');
            }
        } catch (error) {
            console.error('Gemini API 錯誤:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 生成拼圖大圖提示詞
     */
    generatePuzzlePrompt(ingredientList) {
        const ingredients = Array.isArray(ingredientList) 
            ? ingredientList.join('、') 
            : ingredientList;
        
        return `請生成一張 8 欄 × 5 列的素食食材拼圖大圖，共 40 格，每格一種食材（熟食），食材呈現自然熟食狀態，色彩真實無陰影，絕對不要包含任何五辛 (蔥蒜)。背景統一使用洋紅色（#FF00FF），所有食材置中背俯視 45 度，均勻排列無間隔，整體建議尺寸 2624×1632px。食材種類：${ingredients}或請您自行生成。`;
    }
    
    /**
     * 文字對話（使用 Gemini 文字模型）
     */
    async chat(message, conversationHistory = []) {
        if (!this.apiKey) {
            return {
                success: false,
                error: '請先輸入 Gemini API Key'
            };
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/models/gemini-pro:generateContent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.apiKey
                },
                body: JSON.stringify({
                    contents: [
                        ...conversationHistory,
                        {
                            role: 'user',
                            parts: [{ text: message }]
                        }
                    ]
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API 請求失敗');
            }
            
            const result = await response.json();
            const reply = result.candidates?.[0]?.content?.parts?.[0]?.text;
            
            return {
                success: true,
                reply: reply || '無回應'
            };
        } catch (error) {
            console.error('Gemini Chat 錯誤:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 測試 API 連接
     */
    async testConnection() {
        if (!this.apiKey) {
            return { success: false, error: '未設定 API Key' };
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                method: 'GET',
                headers: {
                    'x-goog-api-key': this.apiKey
                }
            });
            
            if (response.ok) {
                return { success: true, message: 'API 連接成功' };
            } else {
                const error = await response.json();
                return { 
                    success: false, 
                    error: error.error?.message || '連接失敗' 
                };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}