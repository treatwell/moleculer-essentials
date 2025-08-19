import { describe, expect, it } from 'vitest';
import { ServiceSchema } from 'moleculer';
import {
  getMetadataFromService,
  isServiceMatchRule,
  isServiceSelected,
  Rule,
  Selector,
  ServiceMetadata,
} from '../loader.js';

describe('loader isServiceMatchRule method', () => {
  const cases: Array<{ rule: Rule; meta: ServiceMetadata; res: boolean }> = [
    {
      meta: { a: 'c' },
      rule: { key: 'a', operator: 'in', values: ['c'] },
      res: true,
    },
    {
      meta: { b: 'c' },
      rule: { key: 'a', operator: 'in', values: ['c'] },
      res: false,
    },
    {
      meta: { b: 'c', a: 'b' },
      rule: { key: 'a', operator: 'notin', values: ['c'] },
      res: true,
    },
    {
      meta: { b: 'c', a: 'b' },
      rule: { key: 'a', operator: 'exists' },
      res: true,
    },
    {
      meta: { a: 'b' },
      rule: { key: 'b', operator: 'exists' },
      res: false,
    },
    {
      meta: { a: false },
      rule: { key: 'a', operator: 'in', values: ['false'] },
      res: true,
    },
    {
      meta: undefined,
      rule: { key: 'a', operator: 'exists' },
      res: false,
    },
    {
      meta: undefined,
      rule: { key: 'a', operator: 'doesnotexists' },
      res: true,
    },
    {
      meta: { a: 1.2 },
      rule: { key: 'a', operator: 'in', values: ['1.2'] },
      res: true,
    },
    {
      meta: { a: true },
      rule: { key: 'a', operator: 'notin', values: ['true'] },
      res: false,
    },
  ];

  it.each(cases)(
    'should handle rule($rule) with metadata($meta)',
    ({ meta, rule, res }) => {
      expect(isServiceMatchRule(meta, rule)).toBe(res);
    },
  );
});

describe('loader isServiceSelected method', () => {
  const cases: Array<{
    selector: Partial<Selector>;
    meta: ServiceMetadata;
    res: boolean;
  }> = [
    {
      meta: { a: 'c' },
      selector: { matchLabels: { a: 'c' } },
      res: true,
    },
    {
      meta: { a: 'c' },
      selector: { matchLabels: { a: 'b' } },
      res: false,
    },
    {
      meta: { b: 'c', a: 'b' },
      selector: {
        matchLabels: { a: 'b' },
        matchExpressions: [{ key: 'b', operator: 'in', values: ['c'] }],
      },
      res: true,
    },
    {
      meta: { b: 'c', a: 'b' },
      selector: {
        matchLabels: { a: 'b' },
        matchExpressions: [{ key: 'b', operator: 'in', values: ['d'] }],
      },
      res: false,
    },
    {
      meta: { b: 'c', a: 'b' },
      selector: {
        matchLabels: { a: 'c' },
        matchExpressions: [{ key: 'b', operator: 'in', values: ['b'] }],
      },
      res: false,
    },
    {
      meta: { b: 'c', a: 'b' },
      selector: {
        matchExpressions: [
          { key: 'b', operator: 'in', values: ['b'] },
          { key: 'a', operator: 'in', values: ['b'] },
        ],
      },
      res: false,
    },
    {
      meta: { a: 'b' },
      selector: {},
      res: true,
    },
  ];

  it.each(cases)(
    'should handle selector($#) with metadata($meta)',
    ({ meta, selector, res }) => {
      expect(isServiceSelected(meta, selector)).toBe(res);
    },
  );
});

describe('get metadata from service', () => {
  const cases: Array<{ svc: Partial<ServiceSchema>; expected: unknown }> = [
    {
      svc: { metadata: { a: 'b' } },
      expected: { a: 'b', name: 'unknown' },
    },
    {
      svc: { name: 'my.svc', metadata: { a: 'b' } },
      expected: { a: 'b', name: 'my.svc' },
    },
    {
      svc: {},
      expected: { name: 'unknown' },
    },
    {
      svc: { mixins: [{ metadata: { a: 'b' } }] },
      expected: { a: 'b', name: 'unknown' },
    },
    {
      svc: {
        metadata: { a: 'c' },
        mixins: [{ metadata: { a: 'b', b: 5 } }],
      },
      expected: { a: 'c', b: 5, name: 'unknown' },
    },
    {
      svc: {
        metadata: { a: 'c' },
        mixins: [
          {
            metadata: { e: 2 },
            mixins: [{ metadata: { b: 5 } }, { metadata: { d: 6 } }],
          },
        ],
      },
      expected: { a: 'c', b: 5, d: 6, e: 2, name: 'unknown' },
    },
  ];

  it.each(cases)('should handle case $#', ({ svc, expected }) => {
    expect(getMetadataFromService(svc)).toEqual(expected);
  });
});
