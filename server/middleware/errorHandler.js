function errorHandler(err, req, res, _next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} -`, err.message);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload is too large.' });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.expose ? err.message : 'Internal server error. Please try again.',
  });
}

module.exports = errorHandler;
