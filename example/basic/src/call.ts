/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unused-vars */
import type * as m from 'moleculer';
import type * as s78e4172 from './services/schemas/calculator.js';

interface Actions {
    'calculator.multiply': [
        s78e4172.MultiplyParams,
        void
    ];
    'calculator.sum': [
        s78e4172.SumParams,
        void
    ];
}
interface ActionsU {
    'api.listAliases': void;
    'openapi.generateDocs': void;
    'openapi.ui': void;
}

export function call<N extends keyof Actions>(ctx: m.Context, action: N, params: Actions[N][0], meta?: m.CallingOptions): Promise<Actions[N][1]>;
export function call<N extends keyof ActionsU>(ctx: m.Context, action: N, params?: undefined, meta?: m.CallingOptions): Promise<ActionsU[N]>;
export function call(ctx: m.Context, action: string, params: unknown, meta?: m.CallingOptions): Promise<unknown> {
    return ctx.call(action, params, meta);
}

export function callT(ctx: m.Context, action: string, params: unknown, meta?: m.CallingOptions): Promise<unknown> {
    return ctx.call(action, params, meta);
}
