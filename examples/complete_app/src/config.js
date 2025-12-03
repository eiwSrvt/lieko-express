module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  trustProxy: process.env.TRUST_PROXY === 'true' || false,
};