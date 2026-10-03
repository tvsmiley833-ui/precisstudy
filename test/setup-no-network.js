// Tests must never reach a real third party: a flaky provider would fail CI for reasons unrelated to the code, and a test that
// "passes" by calling Google for real proves nothing. Any fetch to a host other than this site or the reserved test domains
// throws unless the test mocked fetch itself (vi.spyOn replaces this wrapper).
const realFetch = globalThis.fetch.bind(globalThis);
const ALLOWED = /^(precisstudy\.com|www\.precisstudy\.com|studystacks\.org|www\.studystacks\.org|example\.com|localhost|127\.0\.0\.1)$/;

globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (!ALLOWED.test(url.hostname)) throw new Error(`Unmocked network call to ${url.origin} in a test. Mock fetch for this test.`);
  return realFetch(input, init);
};
