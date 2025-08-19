// eslint-disable-next-line no-undef
module.exports = opts =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports,no-undef
  require('pino-pretty')({
    ...opts,
    messageFormat: (log, messageKey, levelLabel, { colors }) => {
      const { req, res, responseTime } = log;
      if (req && res) {
        const colored = {
          default: colors.white,
          fatal: colors.bgRed,
          error: colors.red,
          warn: colors.yellow,
          info: colors.green,
          debug: colors.blue,
          trace: colors.gray,
        };

        const levelColor = colored[levelLabel] || colored.default;
        const parts = [
          colors.cyan(req.method),
          req.url,
          levelColor(`${res.statusCode || 'aborted'}`),
          responseTime !== undefined ? `${responseTime}ms` : '',
        ];
        return parts.join(' ');
      }
      return log[messageKey];
    },
  });
