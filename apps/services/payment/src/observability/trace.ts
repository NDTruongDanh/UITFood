export async function runObserved<T>(
  _name: string,
  _attributes: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  return fn();
}
