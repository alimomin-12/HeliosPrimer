# HeliosPrimer

**HeliosPrimer** is a full-stack AI chat platform built with **Next.js 16** that lets you connect your own API keys for multiple AI providers and chat with them — individually or in an orchestrated multi-model mode where a "master" AI delegates to one or more "slave" AIs to produce a refined answer.

---

## ✨ Features

- **Multi-Provider AI Chat** — Connect and chat with models from:
  - **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo
  - **Google Gemini**: Gemini 2.5 Flash / Pro, Gemini 2.0 Flash, Gemini 1.5 Flash / Pro, and more
- **Orchestration Mode** — Designate a master AI model that breaks down tasks and delegates sub-tasks to one or more slave models, then synthesizes their responses
- **Direct Mode** — Standard single-model chat with persistent conversation history
- **Secure API Key Storage** — Your provider API keys are encrypted at rest (AES-256) per-user in the local SQLite database
- **Email Magic-Link Authentication** — Passwordless sign-in via NextAuth v5 (email provider)
- **Conversation History** — All chats are persisted and viewable from the history sidebar
- **Token & Context Tracking** — View token usage and context length per conversation
- **Animated, Modern UI** — Built with Radix UI primitives, Tailwind CSS v4, and Framer Motion animations

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript 5 |
| Auth | [NextAuth v5](https://authjs.dev/) — email magic-link |
| Database | SQLite via [Prisma 7](https://www.prisma.io/) + `better-sqlite3` |
| AI SDK | [Vercel AI SDK](https://sdk.vercel.ai/) (`ai` package) + provider SDKs |
| UI Components | [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/) |
| Animations | [Framer Motion](https://www.framer.com/motion/) |
| Styling | Tailwind CSS v4, `clsx`, `tailwind-merge` |

---

## 📁 Project Structure

```
heliosprimer/
├── app/
│   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── chat/             # Main chat interface
│   │   ├── connect/          # AI provider connection management
│   │   ├── dashboard/        # Overview/home page
│   │   └── history/          # Conversation history
│   ├── api/
│   │   ├── auth/             # NextAuth handlers
│   │   ├── chat/             # Streaming chat endpoint
│   │   ├── connections/      # CRUD for AI provider connections
│   │   ├── conversations/    # Conversation management
│   │   └── orchestrate/      # Multi-model orchestration endpoint
│   ├── login/                # Login / magic-link page
│   └── page.tsx              # Landing page
├── lib/
│   ├── ai/
│   │   ├── adapters/
│   │   │   ├── openai.ts     # OpenAI adapter
│   │   │   └── gemini.ts     # Google Gemini adapter
│   │   ├── registry.ts       # Provider/model registry
│   │   ├── orchestrator.ts   # Master-slave orchestration logic
│   │   └── types.ts          # Shared AI types
│   ├── auth.ts               # NextAuth configuration
│   ├── encryption.ts         # AES-256 API key encryption
│   └── prisma.ts             # Prisma client singleton
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── dev.db                # Local SQLite database (git-ignored, auto-created via prisma db push)
├── types/                    # Shared TypeScript types
└── public/                   # Static assets
```

---

## ⚙️ Prerequisites

- **Node.js** v18 or higher
- **npm** (comes with Node.js)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd HeliosPrimer/heliosprimer
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the `heliosprimer/` directory with the following values:

```env
# Database — SQLite file path (relative to prisma/ directory)
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key-change-this-in-production-32chars"

# Encryption key for API keys stored in DB (must be exactly 32 characters for AES-256)
ENCRYPTION_KEY="heliosprimer-encryption-key-32ch"

# Email provider for magic-link login (MailHog for local dev, Resend for production)
# EMAIL_SERVER_HOST=smtp.resend.com
# EMAIL_SERVER_PORT=465
# EMAIL_SERVER_USER=resend
# EMAIL_SERVER_PASSWORD=your-resend-api-key
# EMAIL_FROM=noreply@heliosprimer.app
```

> **Note:** For local development, magic-link emails are sent via MailHog (an email testing tool). You can download and run MailHog from https://github.com/mailhog/MailHog. Without MailHog, the login page will still appear but emails will not be delivered.

### 4. Set Up the Database

Generate the Prisma client and apply migrations to create the SQLite database:

```bash
npx prisma generate
npx prisma db push
```

This will create the `prisma/dev.db` SQLite file with all required tables.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 First-Time Login

1. Navigate to [http://localhost:3000](http://localhost:3000)
2. Click **Sign in** and enter your email address
3. Check your email (or MailHog at [http://localhost:8025](http://localhost:8025) for local dev) for the magic link
4. Click the magic link to be logged in automatically

---

## 🤖 Connecting an AI Provider

1. After logging in, go to **Connect** in the sidebar
2. Select a provider (**OpenAI** or **Google Gemini**)
3. Enter your API key and choose a default model
4. Click **Save** — your key is encrypted and stored securely

You can only have one active connection per provider at a time.

---

## 💬 Chat Modes

### Direct Mode
- Select a connected provider and start chatting
- Each conversation is saved and accessible from **History**

### Orchestration Mode
- Assign a **master** model (e.g., GPT-4o) that plans and coordinates
- Add one or more **slave** models (e.g., Gemini 1.5 Pro) that execute sub-tasks
- The master synthesizes the slaves' responses into a final answer
- Intermediate "thinking steps" (bot-to-bot messages) are visible in the UI

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server (hot reload) |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server (requires build first) |
| `npm run lint` | Lint the codebase with ESLint |

---

## 🗄️ Database Schema Overview

| Model | Description |
|---|---|
| `User` | Application users |
| `Account` / `Session` | NextAuth OAuth accounts and sessions |
| `AIConnection` | Per-user, per-provider AI connections (encrypted API key) |
| `Conversation` | Chat sessions (Direct or Orchestrated mode) |
| `Message` | Individual messages (user, master, slave, or system roles) |
| `OrchestrationConfig` | Master/slave provider config for orchestrated conversations |

---

## 🔒 Security

### How API Keys Are Protected

HeliosPrimer uses a BYOK (Bring Your Own Key) model — your AI provider API keys are **never stored in plaintext**:

1. When you save an API key on the Connect page, it is immediately **AES-256 encrypted** server-side using the `ENCRYPTION_KEY` from your `.env.local`
2. Only the **encrypted value** is written to the local SQLite database (`prisma/dev.db`)
3. At chat time, the key is **decrypted in memory** on the server, used for the API call, then discarded

```
User input → AES-256 encrypt (ENCRYPTION_KEY) → dev.db
                                                      ↕
                                        Decrypt at runtime → AI API
```

### What Is and Isn't Committed to Git

| File | Committed? | Reason |
|---|---|---|
| `.env.local` | ❌ No | Contains `ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, and email credentials — covered by `.env*` in `.gitignore` |
| `prisma/dev.db` | ❌ No | Contains encrypted API keys — explicitly ignored via `prisma/*.db` in `.gitignore` |
| `prisma/schema.prisma` | ✅ Yes | Schema definition only, no sensitive data |
| All source code | ✅ Yes | No secrets are ever hardcoded in source |

> **Important:** Each contributor must create their own `.env.local` with their own `ENCRYPTION_KEY` and `NEXTAUTH_SECRET`. Keys encrypted with one `ENCRYPTION_KEY` cannot be decrypted with another.

### For Contributors

When you clone this repo, you will not have a database or environment file. Follow the [Getting Started](#-getting-started) steps to create your own local setup — your API keys will remain entirely on your own machine.

---

## 🌐 Deployment

For production deployment:

1. Replace all placeholder values in `.env.local` with real secrets
2. Configure a real email provider (e.g., [Resend](https://resend.com/)) by uncommenting and filling in the `EMAIL_*` variables
3. Build the application:
   ```bash
   npm run build
   npm run start
   ```
4. Or deploy to **Vercel** with one click — Vercel natively supports Next.js App Router projects. Add your environment variables in the Vercel dashboard.

---

## 📄 License

This project is licensed under the **[MIT License](./LICENSE)** — free to use, modify, and distribute, including for commercial purposes, as long as the original copyright notice is included.
