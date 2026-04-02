# NestRecruit - AI Recruiter Co-pilot

NestRecruit is a sophisticated AI-powered conversational recruiting assistant that helps recruiters find, rank, and analyze candidate profiles with a premium, ChatGPT-like experience.

## ✨ Core Features
- **7-Layer AI Orchestration**: Intent extraction → search plan → retrieval → ranking → reasoning → response generation → memory.
- **Context-Aware Conversational UI**: Generates proactive, multi-sentence responses with glassmorphic followup suggestions.
- **Stacked Progress Loader**: Real-time visual feedback on the AI's "thinking" process with stage-by-stage checkmarks.
- **Empathy-Aware Status**: A dynamic emoji indicator that reflects the candidate search journey.
- **Advanced Candidate Analysis**: Match scores, reasoning cards, and side-by-side profile comparison.
- **JD Upload**: Drag-and-drop job descriptions for automated requirements analysis.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- A Supabase/PostgreSQL instance
- An OpenRouter API Key (to access `qwen/qwen3.6-plus-preview:free`)

### 1. Clone the repository
```bash
git clone https://github.com/MartinPaulSimon/Conversational-UI.git
cd Conversational-UI/app-root
```

### 2. Configure Environment Variables
Copy the `.env.example` file and fill in your keys:
```bash
cp .env.example .env.local
```
*Make sure to provide `OPENROUTER_API_KEY` and `DATABASE_URL`.*

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup (Prisma)
Generate the Prisma client and sync migrations:
```bash
npx prisma generate
npx prisma db push
```

### 5. Run the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to start recruiting!

## ⚙️ Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Database**: Prisma ORM with Supabase/PostgreSQL
- **LLM Operations**: OpenRouter Integration (Qwen 3.6 Plus Preview)
- **Styling**: Vanilla CSS (Modern glassmorphic theme)
- **Icons**: Lucide-REACT

---
*Built for the future of talent acquisition by Tetris Innovation.*
