export const EXIT_CODES = {
  SUCCESS: 0,
  FAILURE: 1,
  USAGE: 2,
  CONFIG: 10,
  AUTH: 11,
  CONNECTIVITY: 12,
  OUTBOUND: 13,
  INBOUND: 14,
  TIMEOUT: 15,
  ASSERTION: 16,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
