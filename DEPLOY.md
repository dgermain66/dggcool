# Deploying DGGCOOL to Vercel

This guide explains how to publish DGGCOOL to a permanent URL on Vercel (free).

## What you need (5 minutes total)

1. A **GitHub account** (free)
2. A **Vercel account** (free — sign in with GitHub)
3. The DGGCOOL code (you already have it in this project folder)

## Step 1: Put the code on GitHub

1. Go to [github.com](https://github.com) and sign in
2. Click the **`+`** icon (top-right) → **New repository**
3. Name it `dggcool`
4. Set to **Private** or **Public** (your choice)
5. Click **Create repository**
6. GitHub shows you commands. Use these (run them in the project folder):

```bash
cd /home/z/my-project
git add .
git commit -m "DGGCOOL — AI Video & Creative Studio"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dggcool.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## Step 2: Connect Vercel

1. Go to [vercel.com](https://vercel.com) and click **Sign Up** / **Log In**
2. Choose **Continue with GitHub** (authorize it)
3. Once logged in, click **Add New...** → **Project**
4. You'll see a list of your GitHub repos. Find `dggcool` and click **Import**

## Step 3: Configure the build

Vercel auto-detects Next.js. You just need to verify these settings:

| Setting | Value |
|---|---|
| Framework Preset | Next.js (auto-detected) |
| Build Command | `npm run build` (leave default) |
| Output Directory | `.next` (leave default) |
| Install Command | `npm install` (leave default) |

**Optional — increase memory for build:**
Under **Settings → Advanced**, add an Environment Variable:
- Name: `NODE_OPTIONS`
- Value: `--max-old-space-size=4096`

## Step 4: Click Deploy

Click the big blue **Deploy** button. 

Vercel will:
1. Install dependencies (~30 seconds)
2. Build the app (~2 minutes)
3. Give you a live URL like `dggcool-xyz123.vercel.app`

You'll see green checkmarks as each step completes. Once done, click **Visit** to see your live site!

## Step 5: Custom domain (optional)

Want `dggcool.com` instead of the Vercel URL?

1. Buy a domain (Namecheap, GoDaddy, etc. — ~$10/year)
2. In Vercel: **Settings → Domains → Add**
3. Enter your domain, follow the DNS instructions
4. Vercel auto-provisions HTTPS (green padlock) for free

## How to update the site after deploying

When you (or I) change the code:

```bash
cd /home/z/my-project
# ... make changes ...
git add .
git commit -m "Describe what changed"
git push
```

Vercel sees the push and **automatically rebuilds + redeploys** in ~2 minutes. You don't need to do anything else.

## What works on Vercel vs. the sandbox

| Feature | On Vercel | Notes |
|---|---|---|
| Image generation | ✅ | Pollinations free tier works on Vercel |
| Video generation | ✅ | Z.AI video API works (needs ZAI_API_KEY env var — see below) |
| Prompt enhancer | ✅ | Z.AI chat API (needs key) |
| Script generator | ✅ | Same |
| Voiceover (TTS) | ✅ | Z.AI audio (needs key) |
| Image upload | ✅ | Client-side, works everywhere |
| Voice input | ✅ | Client-side, Chrome/Edge only |

### Getting the Z.AI API key

The Z.AI SDK (`z-ai-web-dev-sdk`) needs an API key when running outside this sandbox.

1. Sign up at [chat.z.ai](https://chat.z.ai)
2. Go to your account settings → API keys
3. Create a key, copy it
4. In Vercel: **Settings → Environment Variables → Add**
   - Name: `ZAI_API_KEY`
   - Value: your key
5. **Redeploy** (Deployments → click the dots → Redeploy)

Without this key, video/voiceover/LLM features won't work on Vercel (image generation still works via Pollinations).

## Troubleshooting

**Build fails with "out of memory":**
- Add `NODE_OPTIONS=--max-old-space-size=4096` env var (see Step 3)

**Video generation returns 429:**
- Z.AI is rate-limiting. Wait 60s and retry. The app already retries 4× automatically.

**Images don't load:**
- Check that `/public/generated/showcase/` images were committed to git
- Run `node scripts/seed-showcase.cjs` to regenerate them if missing

**"Module not found" errors:**
- Run `npm install` locally, commit `package-lock.json`, push again

## Summary

```
GitHub (code) → Vercel (build + host) → your-live-url.vercel.app
```

Once deployed, the site is live 24/7. Every `git push` triggers an automatic redeploy. Free forever (Vercel Hobby plan includes 100GB bandwidth/month).

## Quick reference

- **Vercel dashboard:** [vercel.com/dashboard](https://vercel.com/dashboard)
- **Your live URL:** shown in Vercel after deploy (e.g. `dggcool.vercel.app`)
- **Health check:** visit `your-url.vercel.app/api/health` to verify the server is alive
