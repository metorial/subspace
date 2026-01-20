export let parseRedisUrl = (url: string) => {
  let u = new URL(url);

  return {
    host: u.hostname,
    port: Number.parseInt(u.port, 10),
    password: u.password,
    db: Number.parseInt(u.pathname.slice(1), 10),

    tls: u.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined
  };
};
