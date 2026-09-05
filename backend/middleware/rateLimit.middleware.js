const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');
const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = require('../config/env');

const ratelimit = new Ratelimit({
  redis: new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN }),
  limiter: Ratelimit.slidingWindow(10, '60 s')
});

async function rateLimit(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
  const { success, reset } = await ratelimit.limit(ip);
  if (!success) {
    return res.status(429).json({
      error: 'rate_limited',
      retryAfter: Math.ceil((reset - Date.now()) / 1000)
    });
  }
  next();
}

module.exports = rateLimit;
