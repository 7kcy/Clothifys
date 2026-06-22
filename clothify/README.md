# Clothify

Roblox classic clothing template downloader. Built to deploy on Vercel.

## Deploy to Vercel

### Option A — Vercel CLI
```bash
npm i -g vercel
vercel
```

### Option B — GitHub + Vercel Dashboard
1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import your repo
3. Leave all settings default and hit Deploy

## File structure
```
clothify/
├── api/
│   └── template.js      ← serverless function (fetches from Roblox)
├── public/
│   └── index.html       ← the site
│   └── Clothifyicon.png ← add your logo here
├── package.json
└── vercel.json
```

## Adding your logo
Drop `Clothifyicon.png` into the `public/` folder alongside `index.html`.
