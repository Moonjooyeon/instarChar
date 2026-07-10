export function withTimeout(promise, ms, fallbackValue, label = "작업") {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => {
        console.warn(`${label} 시간 초과`);
        resolve(fallbackValue);
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function withRejectTimeout(promise, ms, label = "작업") {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} 시간 초과`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
