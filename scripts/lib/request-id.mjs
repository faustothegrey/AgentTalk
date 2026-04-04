export function createRequestIdGenerator(options = {}) {
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  let sequence = 0;

  return function nextRequestId() {
    sequence += 1;
    if (sequence > 999_999) {
      sequence = 1;
    }
    return `req-${now()}-${sequence}`;
  };
}
