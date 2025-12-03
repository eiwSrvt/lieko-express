const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` }
  });
};

const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'SERVER_ERROR', message: 'Internal server error' }
  });
};

module.exports = { notFoundHandler, errorHandler };