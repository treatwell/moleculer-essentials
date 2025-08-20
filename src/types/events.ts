import type { ServiceEvent } from 'moleculer';

export type ServiceEventSchema = ServiceEvent & { params?: unknown };
