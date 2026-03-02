import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './handlers/auth';
import userRoutes from './handlers/users';
import productRoutes from './handlers/products';
import orderRoutes from './handlers/orders';
import cartRoutes from './handlers/cart';
import addressRoutes from './handlers/addresses';
import { errorMiddleware } from './utils/response';
import { config } from './config';

const app = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: config.allowedOrigin,
  credentials: true,
}));

app.use(express.json());
app.set('etag', false);

// ── Rate limiting on auth endpoints (disabled in test environment) ───────────
const authLimiter = process.env.ENV === 'test'
  ? undefined
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20,                   // max 20 requests per window per IP
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too many requests. Please wait a moment and try again.',
        code: 'rate_limited',
      },
    });

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Storefront API is running!' });
});

authRoutes(app, authLimiter);
userRoutes(app);
productRoutes(app);
orderRoutes(app);
cartRoutes(app);
addressRoutes(app);

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorMiddleware);

if (process.env.ENV !== 'test') {
  app.listen(config.port, () => console.log(`Server running on port ${config.port}`));
}

export default app;
