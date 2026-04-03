import { wrapMixin } from '@treatwell/moleculer-essentials';

export function RecursiveSubMixin() {
  return wrapMixin({
    settings: {
      base: 10,
    },

    methods: {
      getBase(): number {
        return this.settings.base;
      },
    },
  });
}
