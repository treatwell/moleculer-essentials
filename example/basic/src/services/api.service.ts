import type { IncomingMessage, ServerResponse } from 'node:http';
import { wrapService } from '@treatwell/moleculer-essentials';
import { Errors } from 'moleculer';
import ApiGateway from 'moleculer-web';
import { pinoHttp } from 'pino-http';
import { z } from 'zod';
import { logger } from '../logger.js';

export default wrapService({
  name: 'api',
  mixins: [ApiGateway],

  settings: {
    port: process.env.PORT,
    use: [
      pinoHttp({
        logger,
        customLogLevel(req, res, err) {
          if (res.statusCode >= 400 && res.statusCode < 500) {
            return 'warn';
          }
          if (res.statusCode >= 500 || err || res.err || req.readableAborted) {
            return 'error';
          }
          return 'info';
        },
        customProps(req) {
          return {
            svc: 'api',
            action: req.$action?.name,
            trace_id: req.$ctx.requestID,
            span_id: req.$ctx.requestID,
          };
        },
      }),
    ],

    routes: [{ name: 'default', autoAliases: true, logging: false }],
  },

  methods: {
    /**
     * This formatter hide 500 errors from final user.
     */
    reformatError(err: Errors.MoleculerError) {
      if (err.code >= 500) {
        return {
          name: 'Internal server error',
          type: 'INTERNAL_SERVER_ERROR',
          code: err.code,
        };
      }
      return {
        name: err.name,
        message: err.message,
        code: err.code,
        type: err.type,
        data: err.data,
      };
    },

    /**
     * Override default api gw errorHandler to not log anything as we already have our own middleware
     * with pino http. Also set res.err for pino-http to use.
     *
     * See: https://github.com/moleculerjs/moleculer-web/blob/master/src/index.js#L318
     */
    errorHandler(
      req: IncomingMessage,
      res: ServerResponse,
      err: Error | undefined,
    ) {
      res.err = err;
      this.sendError(req, res, err);
    },
  },

  actions: {
    listAliases: {
      visibility: 'public',
      params: z.object({
        grouping: z.boolean().optional(),
        withActionSchema: z.boolean().optional(),
      }),
    },
    addRoute: { visibility: 'private' },
    removeRoute: { visibility: 'private' },
  },
});
