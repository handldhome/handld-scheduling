# Handld Technician Scheduling System

Web-based availability form for technicians to submit their weekly availability.

## Setup

1. Install dependencies:
```bash
   npm install
```

2. Copy environment variables:
```bash
   cp .env.local.example .env.local
```

3. Fill in your Airtable credentials in `.env.local`:
   - Get your API key from Airtable account settings
   - Get your Base ID from the Airtable API documentation

4. Run development server:
```bash
   npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Usage

Technicians access their availability form at:
```
http://localhost:3000/tech/[TECH_ID]/availability
```

Where `[TECH_ID]` is the Airtable record ID from the Technicians table.

## Deployment

Deploy to Vercel:
```bash
vercel
```

Set up custom domain: schedule.handldhome.com
