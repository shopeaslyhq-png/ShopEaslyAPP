# ShopEasly - AI-Powered Inventory Management System

## Overview
ShopEasly is a modern inventory management system powered by Google's Gemini AI. It provides intelligent assistance for order processing, inventory tracking, and business insights through both web interface and voice commands.

## Features
- 🤖 **AI Assistant**: Powered by Google Gemini for intelligent inventory management
- 🎤 **Voice Commands**: Process orders and queries using voice input
- 📊 **Dashboard**: Real-time overview of orders, inventory, and business metrics
- 📦 **Order Management**: Create, track, and manage orders efficiently
- 🔍 **Smart Insights**: AI-driven analytics and recommendations

## Project Structure
```
shopeasly-v11/
├── server.js              # Main Express server entry point
├── package.json           # Node.js dependencies and scripts
├── .env                   # Environment variables (configure your API keys here)
├── routes/                # Express route handlers
│   ├── dashboard.js       # Dashboard routes
│   ├── easly.js          # AI assistant routes
│   ├── voiceCommands.js  # Voice command processing
│   ├── ai.js             # AI co-pilot routes
│   └── orders.js         # Order management routes
├── views/                 # EJS templates
│   ├── layout.ejs        # Main layout template
│   ├── dashboard.ejs     # Dashboard view
│   └── inventory.ejs     # Inventory view
├── public/                # Static assets
│   ├── css/              # Stylesheets
│   ├── js/               # Client-side JavaScript
│   └── images/           # Images and icons
├── easly/                 # AI-related logic
│   ├── aiHandler.js      # Gemini AI integration
│   ├── voiceHandler.js   # Voice processing
│   ├── promptTemplates.js # AI prompt templates
│   ├── speak.js          # Text-to-speech
│   └── listen.js         # Speech-to-text
├── data/                  # JSON data storage
│   └── orders.json       # Orders data
├── config/                # Configuration files
├── controllers/           # Business logic controllers
├── models/                # Data models
└── utils/                 # Utility functions
```

## Prerequisites
- Node.js (v16 or higher)
- Google Gemini API key
1. **Install dependencies:**
   ```bash
2. **Configure environment variables:**
   - Copy `.env` and update the `GEMINI_API_KEY` with your actual API key
   ```bash
   npm start

## Configuration

### Environment Variables
Create or update the `.env` file with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Optional: Database Configuration
# JWT_SECRET=
# SESSION_SECRET=
```

### API Keys
1. **Google Gemini API Key**: 
   - Visit https://ai.google.dev/
   - Create a new project or use existing one
   - Generate an API key
   - Add it to your `.env` file
### Dashboard
- Access the main dashboard at `http://localhost:3000`
- View order statistics, recent orders, and quick actions
- Navigate to different sections using the navigation menu

### AI Assistant
- Access AI features at `http://localhost:3000/easly`
- Use the AI co-pilot for intelligent assistance
- Process natural language queries about inventory

### Voice Commands
- Access voice features at `http://localhost:3000/voice-commands`
- Use voice input for hands-free operation
- Process orders and queries using speech

### API Endpoints
- `GET /` - Dashboard
- `GET /dashboard` - Dashboard (alternative route)
- `GET /easly` - AI assistant interface
- `POST /easly/co-pilot` - AI co-pilot processing
- `GET /voice-commands` - Voice commands interface
- `POST /voice-commands/process` - Process voice commands
- `POST /ai/co-pilot` - AI co-pilot API
- `GET /orders` - Order management

## Development
2. Add corresponding views in the `views/` directory
3. Update the navigation in `views/layout.ejs`
4. Add any AI logic to the `easly/` directory

### Styling
- Main styles are in `public/css/style.css`
- Responsive design with mobile-first approach

### AI Integration
- AI handlers are in the `easly/` directory
- Uses Google Gemini API for natural language processing

## Troubleshooting

### Common Issues
1. **Server won't start**: Check if port 3000 is available
2. **AI features not working**: Verify your GEMINI_API_KEY is correct
3. **Missing dependencies**: Run `npm install` to install all packages
4. **Template errors**: Ensure all EJS templates are properly formatted

### Logs
- Server logs are displayed in the console
- Check for any error messages during startup
- Verify all required files are present

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License
This project is licensed under the ISC License.

## Support
For support and questions, please refer to the project documentation or create an issue in the repository.
