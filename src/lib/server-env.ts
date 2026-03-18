export function getServerEnv(name: string) {
  const env = process.env as Record<string, string | undefined>;
  return env[name];
}

export function getFirstServerEnv(names: string[]) {
  for (const name of names) {
    const value = getServerEnv(name);
    if (value) {
      return value;
    }
  }

  return undefined;
}
