# Zone 1.0.0

Dynamic Self-Learning Neighborhood App with AI

## Features
- 📍 Location-based search (2-3 km radius)
- 🤖 AI-powered conversational agent (Boredom Buster)
- 🔄 Self-expanding category system
- 🗄️ MongoDB with geospatial indexing
- 🌐 Web Search Fallback

## Tech Stack
- Node.js + Express
- MongoDB + Mongoose (2dsphere)
- OpenAI API (Function Calling)

## Quick Start

### نصب
npm install
cp .env.example .env

### اجرا
npm run dev

### تست دیتابیس
npm run test:db

## Development Status
- ✅ Phase 1: Core Infrastructure
- 🚧 Phase 2: MongoDB Schemas
- ⏳ Phase 3: AI Expansion Controller
- ⏳ Phase 4: Conversational AI Agent
- ⏳ Phase 5: Web Search Integration

## Documentation
- [Architecture](./docs/ARCHITECTURE.md)
- [Handoff Guide](./docs/HANDOFF.md)

## License
MIT