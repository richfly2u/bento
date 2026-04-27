/**
 * OpenAI gpt-image-2 API 連接模組
 */

export class OpenAIAPI {
    constructor(storage) {
        this.storage = storage;
        this.apiKey = null;
        this.baseUrl = 'https://api.openai.com/v1';
    }

    init() {
        this.apiKey = localStorage.getItem('openai_api_key') || '';
        if (!this.apiKey) {
            console.warn('⚠️ 未設定 OpenAI API Key');
        }
    }

    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('openai_api_key', key);
    }

    generatePrompt(ingredientName) {
        return `Top-down view of cooked vegetarian dish: ${ingredientName}. Natural plating at 45-degree overhead angle, vibrant and realistic colors, no shadows, transparent or pure white background, 512x512px. Absolutely no meat, no alliums (garlic, onion, chives, shallot, scallion), no bowl or plate underneath.`;
    }

    async generateIngredientImage(ingredientName) {
        if (!this.apiKey) {
            return { success: false, error: '請先輸入 OpenAI API Key' };
        }

        try {
            const prompt = this.generatePrompt(ingredientName);

            const response = await fetch(`${this.baseUrl}/images/generations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-image-2',
                    prompt: prompt,
                    n: 1,
                    size: '1024x1024',
                    quality: 'medium',
                    output_format: 'png'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API 請求失敗');
            }

            const result = await response.json();

            if (result.data && result.data.length > 0) {
                const item = result.data[0];
                const imageUrl = item.b64_json
                    ? `data:image/png;base64,${item.b64_json}`
                    : item.url;

                return { success: true, imageUrl, prompt };
            } else {
                throw new Error('未收到有效的圖片回應');
            }
        } catch (error) {
            console.error('OpenAI gpt-image-2 錯誤:', error);
            return { success: false, error: error.message };
        }
    }

    async testConnection() {
        if (!this.apiKey) {
            return { success: false, error: '未設定 API Key' };
        }

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });

            if (response.ok) {
                return { success: true, message: 'OpenAI API 連接成功' };
            } else {
                const error = await response.json();
                return { success: false, error: error.error?.message || '連接失敗' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
