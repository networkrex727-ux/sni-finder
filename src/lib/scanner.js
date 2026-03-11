import https from 'https';
import dns from 'dns/promises';

export async function scanDomain(domain) {
  const startTime = Date.now();

  // Step 1: DNS resolve karke IP nikalo
  let ip = 'unknown';
  try {
    const addresses = await dns.resolve4(domain);
    ip = addresses[0] || 'unknown';
  } catch (e) {
    ip = 'DNS Failed';
  }

  // Step 2: HTTPS request with SNI
  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 6000,
      rejectUnauthorized: false,
      servername: domain, // ← SNI inject hota hai yahan
      headers: {
        'User-Agent': 'Mozilla/5.0 SNIChecker/1.0',
        'Host': domain,
      },
    };

    const req = https.request(options, (res) => {
      const ping = Date.now() - startTime;
      const code = res.statusCode;

      // SSL info
      const cert = res.socket?.getPeerCertificate?.();
      const sslValid = res.socket?.authorized !== false;
      const sslExpiry = cert?.valid_to || 'unknown';
      const serverHeader = res.headers?.server || 'unknown';
      const cfRay = res.headers?.['cf-ray'] ? 'Cloudflare CDN' : null;

      // Status determine karo
      let httpStatus, bypassStatus;

      if ([200, 201, 204].includes(code)) {
        httpStatus = { label: `${code} OK`, type: 'working' };
      } else if ([301, 302, 303, 307, 308].includes(code)) {
        httpStatus = { label: `${code} Redirect`, type: 'working' };
      } else if ([403, 401].includes(code)) {
        httpStatus = { label: `${code} Forbidden`, type: 'maybe' };
      } else {
        httpStatus = { label: `${code} Error`, type: 'dead' };
      }

      // Bypass working logic:
      if (httpStatus.type === 'working') {
        bypassStatus = {
          recharge: { working: true, label: '✅ Working' },
          bypass: { working: true, label: '✅ Bypass Working' },
        };
      } else if (httpStatus.type === 'maybe') {
        bypassStatus = {
          recharge: { working: true, label: '✅ Working' },
          bypass: { working: false, label: '⚠️ Uncertain' },
        };
      } else {
        bypassStatus = {
          recharge: { working: false, label: '❌ Not Working' },
          bypass: { working: false, label: '❌ Not Working' },
        };
      }

      resolve({
        domain,
        ip,
        ping: `${ping}ms`,
        httpStatus,
        bypassStatus,
        ssl: {
          valid: sslValid,
          label: sslValid ? '✅ Valid SSL' : '⚠️ Invalid SSL',
          expiry: sslExpiry,
        },
        server: cfRay || serverHeader,
        cdn: cfRay || null,
      });

      res.destroy();
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        domain,
        ip,
        ping: '6000ms+',
        httpStatus: { label: 'Timeout', type: 'dead' },
        bypassStatus: {
          recharge: { working: false, label: '❌ Not Working' },
          bypass: { working: false, label: '❌ Not Working' },
        },
        ssl: { valid: false, label: '❌ No SSL', expiry: 'N/A' },
        server: 'N/A',
        cdn: null,
      });
    });

    req.on('error', (err) => {
      const ping = Date.now() - startTime;
      resolve({
        domain,
        ip,
        ping: `${ping}ms`,
        httpStatus: {
          label: err.code === 'ENOTFOUND' ? 'DNS Error' : 'Connection Failed',
          type: 'dead',
        },
        bypassStatus: {
          recharge: { working: false, label: '❌ Not Working' },
          bypass: { working: false, label: '❌ Not Working' },
        },
        ssl: { valid: false, label: '❌ No SSL', expiry: 'N/A' },
        server: 'N/A',
        cdn: null,
        error: err.code,
      });
    });

    req.end();
  });
}
