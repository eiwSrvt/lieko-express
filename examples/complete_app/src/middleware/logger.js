module.exports = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationNs = end - start;
    const durationMs = Number(durationNs) / 1_000_000;

    let timeStr;
    if (durationMs < 1) {
      timeStr = `${(durationMs * 1000).toFixed(1)}µs`;
    } else if (durationMs < 1000) {
      timeStr = `${durationMs.toFixed(3).replace(/\.?0+$/, '')}ms`;
    } else {
      timeStr = `${(durationMs / 1000).toFixed(3)}s`;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const ip = req.ip.ipv4 || 'unknown';

    console.log(
      `[${timestamp}] ${req.method} ${res.statusCode} ${req.originalUrl} | ${ip} | ${timeStr}`
    );
  });

  next();
};