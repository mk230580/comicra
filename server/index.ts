import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { appConfig, hasGeminiKey } from './config';
import { BadRequestError, ServiceUnavailableError, UpstreamServiceError } from './errors';
import { geminiRouter } from './routes/gemini';

const app = express();

app.use(
  cors({
    origin: appConfig.CLIENT_ORIGIN ?? true,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: '20mb',
  }),
);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    environment: appConfig.NODE_ENV,
    hasGeminiKey,
  });
});

app.use('/api/ai', geminiRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status =
    (err instanceof BadRequestError ||
    err instanceof ServiceUnavailableError ||
    err instanceof UpstreamServiceError
      ? err.statusCode
      : undefined) ?? (err instanceof SyntaxError ? 400 : 500);

  res.status(status).json({
    message:
      err instanceof Error ? err.message : 'Unexpected server error',
    status,
  });
};

app.use(errorHandler);

export const startServer = () => {
  const port = appConfig.PORT;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[server] Listening on port ${port} (${appConfig.NODE_ENV})`,
    );
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
