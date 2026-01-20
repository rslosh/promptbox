# Promptbox

A local Next.js app for AI image prompting - organize image assets, auto-tag with Gemini, and remix prompts in a powerful playground.

## Features

- **Image Gallery**: Upload and organize images with fast filtering by tags, source, and date
- **AI Tagging**: Automatically generate structured JSON and natural language prompts using Gemini
- **Prompt CRUD**: Create, edit, and version prompts with full history tracking
- **Playground**: Mix and match prompts from multiple images with voice dictation support
- **Gallery-DL Import**: Import images from supported websites via gallery-dl

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **AI**: Google Gemini for image analysis and prompt generation

## Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account (free tier works)
- Gemini API key
- (Optional) gallery-dl installed for URL imports

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the database migration in the Supabase SQL Editor:
   - Open `supabase/migrations/20260119120000_initial_schema.sql`
   - Copy and paste into the SQL Editor and run
3. Create storage buckets:
   - Open `supabase/storage-buckets.sql`
   - Copy and paste into the SQL Editor and run

### 3. Configure Environment

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Server-side service role key for admin operations
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LLM API Keys
GEMINI_API_KEY=your_gemini_api_key
SECONDARY_LLM_API_KEY=your_secondary_llm_key
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use Promptbox.

## Usage

### Uploading Images

1. Navigate to the **Upload** page
2. Drag and drop images or click to browse
3. Click **Upload** to process the images
4. Images are automatically tagged using Gemini

### Viewing and Editing Prompts

1. Click on any image in the **Gallery**
2. View the generated JSON and natural language prompts
3. Edit prompts directly or re-run tagging
4. Version history tracks all changes

### Using the Playground

1. Select multiple images from the Gallery (click the checkbox)
2. Click **Remix** to open the Playground
3. Use the extracted prompt components or add custom instructions
4. Use voice dictation for hands-free editing
5. Generate and copy your remixed prompt

### Importing from URLs

1. Go to the **Upload** page
2. Paste a URL in the "Import from URL" section
3. Click **Import** to start a gallery-dl job
4. Monitor progress in the **Jobs** page

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   │   ├── upload/    # Image upload endpoint
│   │   ├── tag/       # Gemini tagging endpoint
│   │   ├── remix/     # Prompt remix endpoint
│   │   └── gallery-dl/# Gallery-dl import endpoint
│   ├── image/[id]/    # Image detail page
│   ├── jobs/          # Ingestion jobs page
│   ├── playground/    # Prompt playground
│   ├── settings/      # App settings
│   └── upload/        # Upload page
├── components/
│   ├── gallery/       # Gallery components
│   ├── layout/        # Layout components
│   └── ui/            # Reusable UI components
└── lib/
    ├── supabase/      # Supabase client and types
    └── utils.ts       # Utility functions
```

## Configuration

### Settings Page

API keys can be configured in the Settings page. Keys are stored in browser localStorage and never sent to external servers.

### System Prompt

Customize the Gemini system prompt in Settings to adjust how images are analyzed and prompts are generated.

## License

MIT
# promptbox
