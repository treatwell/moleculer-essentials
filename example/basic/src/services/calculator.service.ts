import {
  createOpenAPIResponses,
  wrapService,
} from '@treatwell/moleculer-essentials';
import { MultiplyParams, SumParams } from './schemas/calculator.js';
import { Context } from 'moleculer';
import { z } from 'zod';
import { WelcomeMixin } from '../mixins/welcome.mixin.js';

export default wrapService({
  name: 'calculator',
  settings: {
    rest: '/calculator',
  },

  mixins: [WelcomeMixin({ message: '👋 from calculator service' })],

  methods: {
    sum(a: number, b: number): number {
      return a + b;
    },
  },

  actions: {
    sum: {
      visibility: 'published',
      rest: 'GET /sum',
      openapi: createOpenAPIResponses(z.int()),
      params: SumParams,
      handler(ctx: Context<SumParams>) {
        ctx.logger.info('Calculating sum', ctx.params);
        return this.sum(ctx.params.a, ctx.params.b);
      },
    },
    multiply: {
      visibility: 'public',
      params: MultiplyParams,
      handler(ctx: Context<MultiplyParams>) {
        ctx.logger.info('Calculating multiply', ctx.params);
        return ctx.params.a * ctx.params.b;
      },
    },
  },
});
