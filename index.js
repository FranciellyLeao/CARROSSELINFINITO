import cors from 'cors';
import process from 'node:process';
import express from 'express';

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin nao permitida pelo proxy.'));
  }
}));
app.use(express.json({ limit: '15mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/anthropic', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: {
          message: 'ANTHROPIC_API_KEY nao configurada no backend.'
        }
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data = await response.text();
    res.status(response.status).type('application/json').send(data);
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.name === 'AbortError' ? 'A Anthropic demorou demais para responder.' : (error.message || 'Erro inesperado no proxy da Anthropic.')
      }
    });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Anthropic proxy rodando em http://localhost:${port}`);
});

