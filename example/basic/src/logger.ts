import { createLogger } from '@treatwell/moleculer-essentials';

// This file should not import env vars or anything that needs to be initialized.
export const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = createLogger({
  level: logLevel,
  prettyOptions: {
    // By default, rely on isTTY but NX Term UI breaks it
    enabled: process.env.NODE_ENV !== 'production',
  },
  formatters: {
    level(level) {
      return { level };
    },
  },
});
