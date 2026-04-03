import { wrapMixin } from '@treatwell/moleculer-essentials';
import { RecursiveSubMixin } from './recursive-sub.mixin.js';

export function RecursiveMixin() {
  return wrapMixin({
    mixins: [RecursiveSubMixin()],

    methods: {
      parseInteger(str: string): number {
        return Number.parseInt(str, this.getBase());
      },
    },
  });
}
