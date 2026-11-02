# QuestAI — AI-Powered Site Inspection Application

QuestAI is an AI-powered site inspection platform designed to automate defect detection, safety risk assessment, and structural review.

> **IMPORTANT ARCHITECTURAL NOTICE**  
> QuestAI is created as a **completely standalone application** distinct from the existing Quest project.  
> The original Quest codebase is **unmodified**. User authentication, database integration, and trusted session flows will be introduced during the planned integration phase.

---

## Technology Stack

- **Frontend**:
  - [Angular 19](https://angular.dev/) (Standalone Components, Signals, Reactive HttpClient)
  - TypeScript
  - Responsive web layout (Mobile, Tablet, Desktop)
  - **White-and-Red** Design System (`#d32f2f` crimson accents, clean `#ffffff` surfaces)
- **Backend**:
  - [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
  - TypeScript (strict mode)
  - Ready for **Firebase Cloud Functions (2nd Generation)** via `onRequest` adapter
- **AI Engine (Prepared)**:
  - Google Gemini API (Service interface & backend proxy prepared; keys securely kept on server)

---

## Project Structure

```
QuestAi/
├── .gitignore                    # Root Git ignore (secrets, env files, build artifacts)
├── README.md                     # Architecture & local development guide
│
├── backend/                      # Node.js + Express + Firebase Functions 2nd Gen ready
│   ├── .env.example              # Safe placeholder environment configuration
│   ├── .env                      # Local developer configuration (excluded from Git)
│   ├── .gitignore                # Backend-specific ignore
│   ├── package.json              # Backend dependencies and run scripts
│   ├── tsconfig.json             # TypeScript configuration for Node.js ES2022
│   └── src/
│       ├── index.ts              # Local standalone Express HTTP server listener
│       ├── app.ts                # Express app factory (CORS, JSON limits, routers, error handler)
│       ├── functions.ts          # Firebase Cloud Functions 2nd Gen `onRequest` export
│       ├── config/
│       │   └── env.ts            # Fail-fast typed environment validation
│       ├── middleware/
│       │   ├── errorHandler.ts   # Centralized error handler with sanitized responses
│       │   └── validation.ts     # Request payload validation middleware
│       ├── routes/
│       │   ├── index.ts          # API root router (/api)
│       │   ├── health.router.ts  # GET /api/health implementation
│       │   └── ai.router.ts      # GET /api/ai/status & POST /api/ai/inspect
│       └── services/
│           └── ai/
│               ├── ai.interface.ts   # Typed interface contract for site inspection AI
│               └── gemini.service.ts # Secure backend placeholder implementation
│
└── frontend/                     # Angular 19 Client Application
    ├── angular.json              # Angular CLI project configuration
    ├── package.json              # Angular dependencies and npm scripts
    ├── tsconfig.json             # TypeScript compiler settings
    ├── tsconfig.app.json         # Application compilation targets
    ├── public/                   # Static public assets
    └── src/
        ├── index.html            # Main HTML with responsive viewport & fonts
        ├── main.ts               # Standalone application bootstrap
        ├── styles.css            # White-and-Red global styles and design variables
        ├── environments/
        │   ├── environment.ts    # Local environment config (points to http://localhost:5001/api)
        │   └── environment.prod.ts
        └── app/
            ├── app.config.ts     # Standalone providers (Router, HttpClient with fetch)
            ├── app.routes.ts     # Routing configuration
            ├── app.component.ts  # Responsive dashboard controller (Signals & reactive state)
            ├── app.component.html# White-and-red UI with health check, AI status & simulator
            ├── app.component.css # Component styles & animations
            └── core/
                └── services/
                    └── api.service.ts # Strongly-typed HTTP service calling backend endpoints
```

---

## Security & Architecture Principles

1. **Isolation from Existing Quest**:
   - No production Quest databases or Firestore rules are accessed or altered.
   - No shared dependencies or credentials.
2. **Backend-Only AI Security**:
   - Frontend never contacts Gemini directly or stores API keys.
   - All AI interactions pass through the backend proxy where `GEMINI_API_KEY` is kept safe.
3. **Strict Request Handling**:
   - Configurable payload limits (`MAX_REQUEST_SIZE=10mb` by default) to handle future high-resolution site inspection photos safely.
   - CORS is restricted explicitly to `http://localhost:4200` in local development.
   - Centralized error handling masks internal stack traces from clients in production.
4. **Deferred Authentication**:
   - No login/registration screens are added in this phase.
   - Trusted request validation will be integrated cleanly when linking QuestAI to the Quest core app.

---

## Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) `>= 20.x`
- [npm](https://www.npmjs.com/) `>= 10.x`

### 1. Setting Up the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   A sample `.env.example` is provided. Copy it to `.env`:
   ```bash
   cp .env.example .env
   ```
   *(On Windows PowerShell: `Copy-Item .env.example .env`)*

   Default values in `.env`:
   ```env
   NODE_ENV=development
   PORT=5001
   FRONTEND_URL=http://localhost:4200
   MAX_REQUEST_SIZE=10mb
   GEMINI_API_KEY=your_gemini_api_key_placeholder
   ```
4. Start the backend in development mode:
   ```bash
   npm run dev
   ```
   The backend will be available at: **`http://localhost:5001`**

---

### 2. Setting Up the Frontend

1. In a separate terminal, navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Angular 19 development server:
   ```bash
   npm start
   ```
4. Open your browser and navigate to:
   **`http://localhost:4200`**

---

## Endpoints Implemented

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API service metadata |
| `GET` | `/api/health` | Health-check returning service status, uptime, and timestamp |
| `GET` | `/api/ai/status` | Reports Gemini AI service readiness and configuration status |
| `POST` | `/api/ai/inspect` | Validates site inspection payload & returns structured AI findings (placeholder) |

### Sample Health-Check Response (`GET /api/health`)

```json
{
  "status": "healthy",
  "service": "QuestAI API",
  "version": "1.0.0",
  "timestamp": "2026-10-30T12:00:00.000Z",
  "uptimeSeconds": 42,
  "environment": "development"
}
```

---

## Firebase Cloud Functions (2nd Gen) Deployment Readiness

The backend is pre-configured for future deployment to Firebase Cloud Functions 2nd Generation via `backend/src/functions.ts`:

- Utilizes `onRequest` from `firebase-functions/v2/https`.
- Configured with `maxInstances: 10`, `memory: '512MiB'`, and `timeoutSeconds: 60`.
- Can be deployed without altering the Express application routing.
- **Note**: Deployment is deferred as per project instructions.

