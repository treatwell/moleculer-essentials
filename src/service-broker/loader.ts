// Logic used to load moleculer services is
// the same logic used in K8S labels.
// See https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/

import { defaultsDeep } from 'lodash';
import type { ServiceSchema } from 'moleculer';

export type LabelValue = string;
export type Operator = 'in' | 'notin' | 'exists' | 'doesnotexists';
export type Rule<Op extends Operator = Operator> = Op extends 'in' | 'notin'
  ? { key: string; operator: Op; values: LabelValue[] }
  : { key: string; operator: Op };
export type Selector = {
  matchLabels?: Record<string, LabelValue>;
  matchExpressions: Rule[];
};

export type ServiceMetadata =
  | Record<string, LabelValue | number | boolean>
  | undefined;

export function isServiceSelected(
  metadata: ServiceMetadata,
  selector: Partial<Selector>,
): boolean {
  const s: Selector = {
    ...selector,
    matchExpressions: selector.matchExpressions?.slice() || [],
  };

  // Move matchLabels to matchExpressions following
  // https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#resources-that-support-set-based-requirements
  if (s.matchLabels) {
    s.matchExpressions.push(
      ...Object.entries(s.matchLabels).map(([key, value]) => ({
        key,
        operator: 'in' as const,
        values: [value],
      })),
    );
  }
  // Check if all (ANDed) rules match for metadata
  return s.matchExpressions.every(rule => isServiceMatchRule(metadata, rule));
}

export function isServiceMatchRule<Op extends Operator>(
  metadata: ServiceMetadata,
  rule: Rule<Op>,
): boolean {
  const meta = metadata || {};
  switch (rule.operator) {
    case 'in':
      return rule.values.includes(meta[rule.key]?.toString());
    case 'notin':
      return !rule.values.includes(meta[rule.key]?.toString());
    case 'exists':
      return rule.key in meta;
    case 'doesnotexists':
      return !(rule.key in meta);
    default:
      throw new Error('Unknown operator');
  }
}

export function getMetadataFromService(
  svc: Partial<ServiceSchema>,
): ServiceMetadata {
  const res: ServiceMetadata = {
    name: svc.name || 'unknown',
  };

  defaultsDeep(res, svc.metadata);
  svc.mixins?.forEach(mixin => {
    defaultsDeep(res, mixin.metadata);
    mixin.mixins?.forEach(m => {
      defaultsDeep(res, getMetadataFromService(m));
    });
  });

  return res;
}
