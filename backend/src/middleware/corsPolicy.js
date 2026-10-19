const configuredOrigins = new Set();

const addConfiguredOrigins = (value) => {
  if (!value) return;
  value.split(',').forEach((candidate) => {
    try {
      configuredOrigins.add(new URL(candidate.trim()).origin);
    } catch {
      // Ignore malformed optional origins; valid configured entries still apply.
    }
  });
};

const defaultAllowedOrigins = [
  'https://zovikpos.store',
  'https://www.zovikpos.store',
  'https://zovikpos.vercel.app',
];

defaultAllowedOrigins.forEach((origin) => configuredOrigins.add(origin));
addConfiguredOrigins(process.env.FRONTEND_URL);
addConfiguredOrigins(process.env.CORS_ORIGINS);

const isPrivateIpv4 = (hostname) => {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
};

const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (configuredOrigins.has(origin)) return callback(null, true);

  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname;
    // Allow production domains and preview Vercel branches
    if (
      hostname === 'zovikpos.store' ||
      hostname.endsWith('.zovikpos.store') ||
      hostname.endsWith('.vercel.app')
    ) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV !== 'production') {
      const isHttpOrigin = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
      const isLocalNetwork = isPrivateIpv4(hostname) || hostname.endsWith('.local');
      if (isHttpOrigin && (isLocalHost || isLocalNetwork)) return callback(null, true);
    }
  } catch {
    // Invalid Origin values are denied below.
  }

  return callback(null, false);
};

module.exports = corsOrigin;
