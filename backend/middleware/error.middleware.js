function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
}

module.exports = errorHandler;
