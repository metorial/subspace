export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type HonoLike = {
  fetch: (request: Request, ...rest: any[]) => Response | Promise<Response>;
};

let toRequest = (input: string | URL | Request, init?: RequestInit): Request => {
  if (input instanceof Request) return new Request(input, init);
  return new Request(input.toString(), init);
};

export let createHonoFetchAdapter = (app: HonoLike): FetchFn => {
  return async (input, init) => app.fetch(toRequest(input, init));
};
