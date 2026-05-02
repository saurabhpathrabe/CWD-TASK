export function log(level, route, data = {}) {
  // Ensure tokens are never logged
  const safe = { ...data };
  delete safe.accessToken;
  delete safe.refreshToken;
  delete safe.access_token;
  delete safe.refresh_token;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    route,
    ...safe,
  };
  console.log(JSON.stringify(entry));
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    log('info', req.path, {
      method: req.method,
      status: res.statusCode,
      latency_ms: Date.now() - start,
    });
  });
  next();
}
