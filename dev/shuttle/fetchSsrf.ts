// Dev override: allows private/local IPs for local development.

type SafeFetchOptions = RequestInit & {
  maxRedirects?: number;
};

export let safeFetch = async (input: string, options: SafeFetchOptions = {}) => {
  return fetch(input, options);
};
