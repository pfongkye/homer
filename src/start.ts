import type { Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import { errorMiddleware } from '@/core/middlewares/errorMiddleware';
import { securityMiddleware } from '@/core/middlewares/securityMiddleware';
import { healthCheckRequestHandler } from '@/core/requestHandlers/healthCheckRequestHandler';
import { stateRequestHandler } from '@/core/requestHandlers/stateRequestHandler/stateRequestHandler';
import { connectToDatabase } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { catchAsyncRouteErrors } from '@/core/utils/catchAsyncRouteErrors';
import { REQUEST_BODY_SIZE_LIMIT } from './constants';
import { router } from './router';

const PORT = 3000;

export async function start(): Promise<() => Promise<void>> {
  return new Promise((resolve) => {
    const app = express();

    const verify = (req: Request, res: Response, buffer: Buffer) => {
      (req as any).rawBody = buffer;
    };

    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(
      express.json({
        limit: REQUEST_BODY_SIZE_LIMIT,
        verify,
      })
    );
    app.use(express.urlencoded({ extended: true, verify }));
    app.get('/api/monitoring/healthcheck', healthCheckRequestHandler);
    app.get(
      '/api/monitoring/state',
      catchAsyncRouteErrors(stateRequestHandler)
    );
    app.use(securityMiddleware);
    app.use('/api/v1/homer', router);
    app.use(errorMiddleware);

    const server = app.listen(PORT, async () => {
      logger.info(`Homer started on port ${PORT}.`);
      await connectToDatabase();
      logger.info('Homer connected to the database.');
      resolve(
        async () =>
          new Promise((r) => {
            server.close(r as any);
          })
      );
    });
  });
}