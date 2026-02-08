import http from 'http';
import https from 'https';

// Dev override: allows private/local IPs for local development.

export let checkIp = (_ip: string) => true;

export let ssrfFilter = (url: URL) => {
  return url.protocol === 'https:' ? new https.Agent() : new http.Agent();
};

export let getAxiosSsrfFilter = (url: string) => {
  let u = new URL(url);
  return {
    httpAgent: ssrfFilter(u),
    httpsAgent: ssrfFilter(u)
  };
};
