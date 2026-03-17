# 🍱 大廚 3D 擺盤組合大師

一個模組化的便當擺盤設計工具，結合 AI 智慧生成食材，讓您輕鬆創造美觀的便當擺盤。

## ✨ 功能特色

- 🎨 **直觀的擺盤介面** - 拖拽式設計，輕鬆安排食材位置
- 🤖 **AI 智慧生成** - 使用 Gemini AI 生成自訂食材圖片
- 📦 **模組化架構** - 清晰的程式碼結構，易於維護和擴展
- 💾 **本地儲存** - 自動儲存作品，隨時繼續編輯
- 📸 **圖片匯出** - 一鍵匯出精美擺盤圖片
- 🔄 **復原/重做** - 無限步數的復原重做功能
- 📱 **響應式設計** - 支援桌面、平板、手機

## 📁 專案結構

```
bento-project/
├── index.html                 # 主頁面
├── css/                       # 樣式檔案
│   ├── main.css              # 主要樣式
│   ├── bento-grid.css        # 網格樣式
│   ├── ingredients.css       # 食材樣式
│   ├── modals.css            # 彈窗樣式
│   └── responsive.css        # 響應式樣式
├── js/                        # JavaScript 模組
│   ├── app.js                # 主應用程式入口
│   ├── bento-grid.js         # 網格管理
│   ├── ingredient-manager.js # 食材管理
│   ├── gemini-api.js         # AI API 連接
│   ├── ui-components.js      # UI 元件
│   └── storage.js            # 本地儲存
├── utils/                     # 工具函式
│   └── helpers.js            # 輔助函式
├── components/                # HTML 元件模板
├── assets/                    # 資源檔案（圖片、圖示等）
└── README.md                  # 專案說明
```

## 🚀 快速開始

### 本地開發

1. **克隆專案**
```bash
git clone https://github.com/richfly2u/bento.git
cd bento
```

2. **啟動本地伺服器**

由於使用 ES6 模組，需要透過 HTTP 伺服器運行：

```bash
# 使用 Python 3
python -m http.server 8000

# 或使用 Node.js 的 http-server
npx http-server -p 8000
```

3. **開啟瀏覽器**

訪問 `http://localhost:8000`

### 部署到 GitHub Pages

1. 推送到 GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. 在 GitHub 倉庫設定中啟用 GitHub Pages
   - Settings → Pages
   - Source: Deploy from branch
   - Branch: main
   - Folder: / (root)

3. 訪問 `https://your-username.github.io/bento/`

## ⚙️ 設定

### Gemini API Key

1. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 取得免費 API Key
2. 在應用程式側邊欄輸入 API Key
3. 點擊 💾 儲存（會儲存在本地瀏覽器）

### 食材分類

系統預設提供以下分類：
- 💡 待分類
- 🍚 主食類
- 🥬 鮮蔬類
- 🍄 菇果類
- 🍢 豆製品
- 🔥 烤煎類
- 🍤 酥炸類
- 🥟 點心類

## 🎯 使用指南

### 設計便當外框

1. 在側邊欄輸入寬度和高度（1-10）
2. 點擊「➕ 新增一格」調整大小
3. 點擊「❌ 結束設計」鎖定網格

### 擺放食材

1. 從側邊欄拖曳食材到網格
2. 點擊格子選擇食材
3. 使用工具列旋轉或翻轉

### AI 生成食材

1. 輸入食材名稱（例如：炒青江菜）
2. 點擊「✨ 生成」
3. 等待 AI 生成圖片
4. 點擊「✅ 存入食材庫」

### 儲存與匯出

- **💾 儲存作品** - 儲存到本地瀏覽器
- **📸 匯出圖片** - 下載 PNG 圖片
- **📂 圖庫** - 查看和管理已儲存的作品

## ⌨️ 鍵盤快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Ctrl/Cmd + Z` | 復原 |
| `Ctrl/Cmd + Shift + Z` | 重做 |
| `Delete` | 刪除選取食材 |
| `Ctrl/Cmd + S` | 儲存作品 |

## 🛠️ 技術架構

### 核心模組

- **BentoApp** - 主應用程式控制器
- **BentoGrid** - 網格管理與渲染
- **IngredientManager** - 食材庫管理
- **GeminiAPI** - AI 圖像生成
- **UIComponents** - UI 元件與對話框
- **Storage** - 本地儲存管理

### 技術棧

- **前端**: HTML5, CSS3, JavaScript (ES6 模組)
- **樣式**: CSS 變數，響應式設計
- **儲存**: LocalStorage API
- **AI**: Google Gemini API

## 📝 開發筆記

### 新增功能

1. 在 `js/` 建立新的模組
2. 在 `css/` 新增對應樣式
3. 在 `app.js` 導入並整合

### 程式碼規範

- 使用 ES6 模組語法
- 遵循語意化命名
- 加入適當的 JSDoc 註解
- 保持單一職責原則

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License

## 🙏 致謝

- Google Gemini AI 提供圖像生成能力
- 使用 html2canvas 進行圖片匯出（需額外引入）

---

**Happy Bento Making! 🍱**