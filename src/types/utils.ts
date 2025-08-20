export type Unpacked<T> = T extends (infer U)[] ? U : never;

export type UnionToIntersection<U> = (
  U extends unknown ? (arg: U) => void : never
) extends (arg: infer I) => void
  ? I
  : never;
export type OptionallyArray<T> = T | T[];
