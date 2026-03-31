import type { EventSchema } from 'moleculer';

export type ServiceEventSchema = EventSchema & { params?: unknown };
