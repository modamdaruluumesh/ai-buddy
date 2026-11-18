import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractMeaningfulMemories,
  generateMoodInsight,
  generateProactiveMessage,
  streamCompanionReply,
} from './server/companionEngine.ts';
import type { CompanionChatParams } from './server/companionEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Simple sliding-window in-memory rate limiter for /api/*
const rateBuckets = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 45;

function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const timestamps = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_MAX_REQUESTS) {
    res.status(429).json({
      error: 'Too many requests in a short span. Take a brief pause and try again in a moment.',
    });
    return;
  }
  timestamps.push(now);
  rateBuckets.set(ip, timestamps);
  next();
}

app.use('/api', apiRateLimit);

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY')) {
    return { status: 500, message: raw };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Free tier rate limit reached momentarily. Please wait a few seconds and try again.',
    };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'Gemini API key was rejected. Check your key configuration in Settings > Secrets.',
    };
  }
  return {
    status: 502,
    message: raw || 'Unable to reach the companion AI service right now.',
  };
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    provider: 'google-genai-free',
  });
});

app.post('/api/companion/chat', async (req: Request, res: Response) => {
  const body = req.body as CompanionChatParams;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    res.status(400).json({ error: 'Conversation messages are required.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  try {
    const fullText = await streamCompanionReply(body, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ type: 'done', fullText })}\n\n`);
    res.end();
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.write(`data: ${JSON.stringify({ type: 'error', status: formatted.status, error: formatted.message })}\n\n`);
    res.end();
  }
});

app.post('/api/companion/extract-memories', async (req: Request, res: Response) => {
  try {
    const memories = await extractMeaningfulMemories(req.body);
    res.json({ memories });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

app.post('/api/insights/mood', async (req: Request, res: Response) => {
  try {
    const insight = await generateMoodInsight(req.body);
    res.json({ insight });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

app.post('/api/companion/proactive', async (req: Request, res: Response) => {
  try {
    const proactive = await generateProactiveMessage(req.body);
    res.json(proactive);
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kinsvale companion server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Kinsvale server:', err);
  process.exit(1);
});
