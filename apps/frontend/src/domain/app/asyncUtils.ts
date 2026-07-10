export function withTimeout<T>(promise: Promise<T>, ms: number, fallbackValue: T, label = "작업"): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timer = setTimeout(() => {
        console.warn(`${label} 시간 초과`);
        resolve(fallbackValue);
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function withRejectTimeout<T>(promise: Promise<T>, ms: number, label = "작업"): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} 시간 초과`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
