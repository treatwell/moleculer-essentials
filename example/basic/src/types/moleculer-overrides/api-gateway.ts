import { CustomActionSchema } from '@treatwell/moleculer-essentials';
import { Context } from 'moleculer';

// Added by moleculer-web mixin
declare module 'http' {
  interface IncomingMessage {
    $ctx: Context;
    $action?: CustomActionSchema;
    $params: unknown;
  }
}
