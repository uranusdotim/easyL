function ts(): string {
  return new Date().toISOString();
}

export function logMM(...args: unknown[]) {
  console.log(`[${ts()}] [MM]`, ...args);
}

export function logTrader(...args: unknown[]) {
  console.log(`[${ts()}] [TRADER]`, ...args);
}

export function logAgent(...args: unknown[]) {
  console.log(`[${ts()}] [AGENT]`, ...args);
}

export function logError(...args: unknown[]) {
  console.error(`[${ts()}] [ERROR]`, ...args);
}
