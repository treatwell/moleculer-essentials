export type UnionToIntersection<U> = (
  U extends unknown ? (arg: U) => void : never
) extends (arg: infer I) => void
  ? I & U
  : never;
export type OptionallyArray<T> = T | T[];
