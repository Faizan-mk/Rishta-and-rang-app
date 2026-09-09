// Shared helper for mocking the Supabase client's chainable query builder in
// service tests. Not a test file itself (no `.test.ts` suffix), so Jest's
// `testMatch` never tries to run it as a suite.

const CHAIN_METHODS = [
  'select',
  'insert',
  'upsert',
  'update',
  'delete',
  'eq',
  'neq',
  'in',
  'not',
  'or',
  'ilike',
  'order',
  'range',
  'limit',
] as const;

export interface QueryResult<T = unknown> {
  data?: T | null;
  error?: { message: string; code?: string } | null;
}

/**
 * A thenable that mimics supabase-js's PostgrestFilterBuilder: every filter
 * method returns the same chainable object, and awaiting the chain at any
 * point resolves to the configured result — exactly like the real builder,
 * where `.select().eq().order()` is itself awaitable without a terminal call.
 */
export function chain<T = unknown>(result: QueryResult<T>) {
  const builder: Record<string, unknown> = {};
  for (const method of CHAIN_METHODS) {
    builder[method] = jest.fn(() => builder);
  }
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: QueryResult<T>) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

export function ok<T>(data: T): QueryResult<T> {
  return { data, error: null };
}

export function fail(message: string, code?: string): QueryResult<never> {
  return { data: null, error: { message, code } };
}
