import { wrapMixin } from '../types/index.js';

type Wrapper<T> = {
  services: Set<unknown>;
  client: T;
  onClose: () => Promise<void> | void;
};

/**
 * Global store mixin to share instances between services on the same broker.
 * To reuse an instance, it must match both:
 * - `storeName`, the name of the store (e.g. `mongodb`, `redis`, etc.)
 * - `key`, the key of the instance (e.g. `mongodb://localhost:27017`)
 */
export function GlobalStoreMixin<T = unknown>() {
  return wrapMixin({
    methods: {
      /**
       * Global store to share the adapters between services on the same broker.
       */
      getStore(storeName: string): Map<string, Wrapper<T>> {
        const symbol = Symbol.for(storeName);
        // @ts-expect-error TS doesn't want Symbol as key
        if (!this.broker[symbol]) {
          // @ts-expect-error TS doesn't want Symbol as key
          this.broker[symbol] = new Map();
        }
        // @ts-expect-error TS doesn't want Symbol as key
        return this.broker[symbol];
      },
      /**
       * Return the client from the global store
       * and add the adapter to the list of adapters.
       */
      getFromStore(storeName: string, key: string): null | T {
        const res = this.getStore(storeName).get(key);
        if (res) {
          res.services.add(this);
        }
        return res ? res.client : null;
      },
      /**
       * Service MUST call this when they deregister.
       * This function will close the client if it's the last adapter.
       */
      async removeServiceFromStore(
        storeName: string,
        key: string,
      ): Promise<boolean> {
        const res = this.getStore(storeName).get(key);
        if (res) {
          res.services.delete(this);
          // If there are more services registered, doesn't close the client.
          if (res.services.size > 0) {
            return false;
          }
          // Remove the client from store because there is no adapter left
          this.getStore(storeName).delete(key);
          // Close the client
          await res.onClose();
        }
        return true;
      },
      /**
       * Set the client in global store.
       */
      setClientToStore(
        storeName: string,
        key: string,
        client: T,
        onClose: Wrapper<T>['onClose'],
      ): void {
        const services = new Set().add(this);
        this.getStore(storeName).set(key, { client, services, onClose });
      },
    },
  });
}
