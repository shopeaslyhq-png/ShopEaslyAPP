# ShopEasly Project Structure

This repository contains multiple versions/implementations of ShopEasly:

## 🚀 **MAIN APPLICATION: shopeasly-v11/**
**This is the primary, production-ready Express.js application.**

- **Location**: `shopeasly-v11/`
- **Type**: Node.js/Express backend with EJS templates
- **Entry Point**: `shopeasly-v11/server.js`
- **Start Command**: `cd shopeasly-v11 && npm start`
- **Features**: 
  - AI-powered inventory management
  - Google Gemini integration
  - Voice commands
  - Dashboard with real-time stats
  - Order management

## 📁 **OTHER FILES (Legacy/Alternative Implementations)**

### Root Level Files
- `index.html` - Frontend-only version (Vite/TypeScript)
- `src/` - TypeScript source files for frontend version
- `package.json` (root) - Vite build configuration
- `routes/dashboard.js` (root) - Legacy route file
- `views/layout.ejs` (root) - Legacy template
- `data/orders.json` (root) - Shared data file

### Frontend Version (Vite/TypeScript)
- **Location**: Root directory + `src/`
- **Type**: Frontend-only SPA with TypeScript
- **Entry Point**: `index.html`
- **Start Command**: `npm run dev` (from root)
- **Features**: Client-side only, uses AI Studio CDN

## 🎯 **RECOMMENDED USAGE**

**For development and production, use the `shopeasly-v11/` directory:**

```bash
cd shopeasly-v11
npm install
npm start
```

Then visit: http://localhost:3000

## 🔧 **Configuration**

1. **Set up API key** in `shopeasly-v11/.env`:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

2. **Install dependencies**:
   ```bash
   cd shopeasly-v11
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

## 📝 **Notes**

- The root-level files are from an earlier frontend-only implementation
- The `shopeasly-v11/` directory contains the complete, full-stack application
- Both versions can coexist, but `shopeasly-v11/` is the recommended version
- Data files in `data/` may be shared between versions
