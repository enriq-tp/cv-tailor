// A tiny "Result" type for operations that can fail for expected reasons (bad input).
// Instead of throwing, the function returns { ok: true, value } or { ok: false, error }.
// The caller must check `ok` before using `value`, and TypeScript enforces it.

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
