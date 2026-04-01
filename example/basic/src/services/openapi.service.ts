import { wrapService, OpenAPIMixin } from '@treatwell/moleculer-essentials';

export default wrapService({
  name: `openapi`,

  settings: {
    rest: '/openapi',
    openapi: {
      openapi: '3.0.3',
      info: {
        description: 'Example API documentation',
        version: '0.0.0',
        title: 'Example API',
      },
      servers: [{ url: `http://localhost:${process.env.PORT}` }],
      paths: {},
    },
  },

  mixins: [OpenAPIMixin({})],
});
