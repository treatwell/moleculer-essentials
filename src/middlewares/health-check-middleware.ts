import http, {
  type IncomingMessage,
  type ServerResponse,
  STATUS_CODES,
} from 'http';
import { defaultsDeep } from 'es-toolkit/compat';
import type { ServiceBroker, Middleware } from 'moleculer';

type HealthCheckOptions = {
  port: number;
  startDebounce: number;
  readiness: { path: string };
  liveness: { path: string };
};

const DEFAULT_OPTIONS: HealthCheckOptions = {
  port: 3001,
  startDebounce: 500,
  readiness: { path: '/ready' },
  liveness: { path: '/live' },
};

/**
 * Inspired from https://gist.github.com/icebob/c717ae22002b9ecaa4b253a67952da3a
 */
export function HealthCheckMiddleware(
  _opts: Partial<HealthCheckOptions>,
): Middleware {
  const opts = defaultsDeep(_opts, DEFAULT_OPTIONS) as HealthCheckOptions;
  let state = 'down';
  let server: http.Server;

  function handler(req: IncomingMessage, res: ServerResponse) {
    if (req.url === opts.readiness.path || req.url === opts.liveness.path) {
      const resHeader = {
        'Content-Type': 'application/json; charset=utf-8',
      };

      const content = {
        state,
        uptime: process.uptime(),
        timestamp: Date.now(),
      };

      if (req.url === opts.readiness.path) {
        // Readiness if the broker started successfully.
        // https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-readiness-probes
        res.writeHead(state === 'up' ? 200 : 503, resHeader);
      } else {
        // Liveness if the broker is not stopped.
        // https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-a-liveness-command
        res.writeHead(state !== 'down' ? 200 : 503, resHeader);
      }

      res.end(JSON.stringify(content, null, 2));
    } else {
      res.writeHead(404, STATUS_CODES[404], {});
      res.end();
    }
  }

  return {
    created(broker: ServiceBroker) {
      state = 'starting';

      server = http.createServer(handler);
      server.listen(opts.port, (err?: Error) => {
        if (err) {
          broker.logger.error('Unable to start health-check server', err);
          return;
        }
        broker.logger.info(
          `Health-check server listening on port ${opts.port}`,
          { readiness: opts.readiness.path, liveness: opts.liveness.path },
        );
      });
    },

    // After broker started
    started() {
      // When moleculer is started, the API gateway may not be fully ready because
      // the API GW must regenerate its endpoints with the latest version of actions.
      // There is a debounce of 500ms on the API GW to not regenerate every time a service changed.
      // So we only set the state at ready after a small delay.
      // Note that we unref the timeout to prevent blocking the process if needed to shutdown sooner than expected
      const timeout = setTimeout(() => {
        state = 'up';
      }, opts.startDebounce);
      timeout.unref();
    },

    // Before broker stopping
    stopping() {
      state = 'stopping';
    },

    // After broker stopped
    stopped() {
      state = 'down';
      server.close();
    },
  };
}
