import express from "express";
import { createServer as createViteServer } from "vite";
import { scanDomain } from "./src/lib/scanner.js";
import { getISPInfo } from "./src/lib/ispDetector.js";
import dns from 'dns/promises';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/check", async (req, res) => {
    try {
      const { domain } = req.body;

      if (!domain || typeof domain !== "string") {
        return res.status(400).json({ error: "Domain required" });
      }

      // Clean domain — https:// aur trailing slash remove karo
      const clean = domain
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .toLowerCase()
        .trim();

      if (!clean || clean.length < 3) {
        return res.status(400).json({ error: "Invalid domain format" });
      }

      // Real HTTPS scan karo
      const scanResult = await scanDomain(clean);

      // ISP detect karo domain + IP se
      const ispInfo = await getISPInfo(clean, scanResult.ip);

      // Final response
      return res.json({
        ...scanResult,
        isp: ispInfo.isp,
        ispDetectedFrom: ispInfo.detectedFrom,
        ispColors: ispInfo.colors,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Check error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subdomains", async (req, res) => {
    try {
      const { domain } = req.body;
      if (!domain) return res.status(400).json({ error: "Domain required" });

      const clean = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase().trim();
      
      const commonSubdomains = [
        'www', 'mail', 'ftp', 'dev', 'api', 'blog', 'm', 'wap', 'portal', 'my', 
        'selfcare', 'payment', 'care', 'support', 'login', 'auth', 'cdn', 'static', 
        'media', 'images', 'video', 'tv', 'xstream', 'wynk', 'jiocinema', 'jiosaavn', 
        'jiomart', 'jiotv', 'jiofiber', 'jiomoney', 'jiocloud', 'reliancejio', 
        'myvi', 'vodafone', 'vi', 'vilive', 'myvodafone', 'idea', 'bsnl', 'bsnlportal', 
        'bsnlmobile', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 
        'nine', 'ten', 'ns1', 'ns2', 'smtp', 'pop', 'imap', 'webmail', 'secure', 
        'billing', 'shop', 'store', 'app', 'apps', 'mobile', 'test', 'staging', 
        'beta', 'alpha', 'demo', 'vpn', 'remote', 'cloud', 'data', 'db', 'sql', 
        'mysql', 'admin', 'manage', 'manager', 'cpanel', 'whm', 'plesk', 'directadmin'
      ];

      const results = [];
      
      // Parallel DNS resolution
      const checks = commonSubdomains.map(async (sub) => {
        const fullDomain = `${sub}.${clean}`;
        try {
          const addresses = await dns.resolve4(fullDomain);
          if (addresses && addresses.length > 0) {
            results.push({
              subdomain: fullDomain,
              ip: addresses[0]
            });
          }
        } catch (e) {
          // Ignore failed resolutions
        }
      });

      await Promise.all(checks);

      return res.json({ domain: clean, subdomains: results });
    } catch (error) {
      console.error("Subdomain error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auto-discover", async (req, res) => {
    try {
      // Get requester IP
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const clientIp = Array.isArray(ip) ? ip[0] : ip?.split(',')[0] || ip;

      // Detect ISP
      const ispInfo = await getISPInfo('unknown', clientIp);
      const ispName = ispInfo.isp.toLowerCase();

      // Curated lists for major ISPs
      const discoveryMap = {
        airtel: [
          'airtel.in', 'wynk.in', 'airtelxstream.in', 'airtelpay.in', 'one.airtel.in',
          'selfcare.airtel.in', 'care.airtel.in', 'payment.airtel.in', 'myairtel.in',
          'airtellive.com', 'airtelindia.com', 'airtelads.com', 'airtelblack.in'
        ],
        jio: [
          'jio.com', 'jiocinema.com', 'jiosaavn.com', 'jiomart.com', 'jiotv.com',
          'jiofiber.in', 'jiomoney.com', 'jiocloud.com', 'reliancejio.com',
          'myjio.jp', 'jiochat.com', 'jiomeet.com', 'jiopay.com'
        ],
        vi: [
          'myvi.in', 'vodafone.in', 'vi.in', 'vilive.in', 'myvodafone.in',
          'idea.net.in', 'ideacellular.com', 'vodafoneidea.com'
        ],
        bsnl: [
          'bsnl.co.in', 'portal.bsnl.in', 'selfcare.bsnl.co.in', 'bsnlportal.in',
          'bsnl.in', 'bsnlmobile.in', 'bsnltv.in'
        ],
        cloudflare: [
          'cloudflare.com', '1.1.1.1', 'dash.cloudflare.com', 'workers.dev'
        ]
      };

      // Find matching list or use a general one
      let candidates = [];
      for (const [key, list] of Object.entries(discoveryMap)) {
        if (ispName.includes(key)) {
          candidates = list;
          break;
        }
      }

      if (candidates.length === 0) {
        candidates = ['google.com', 'facebook.com', 'netflix.com', 'microsoft.com', 'apple.com'];
      }

      // Scan them in parallel
      const results = [];
      const scanPromises = candidates.map(async (domain) => {
        try {
          const scan = await scanDomain(domain);
          if (scan.httpStatus.type === 'working') {
            results.push({
              domain,
              ...scan,
              isp: ispInfo.isp,
              confidence: 100,
              ispColors: ispInfo.colors,
              ispDetectedFrom: ispInfo.detectedFrom,
              checkedAt: new Date().toISOString()
            });
          }
        } catch (e) {}
      });

      await Promise.all(scanPromises);

      return res.json({ 
        isp: ispInfo.isp, 
        clientIp, 
        found: results.length,
        results 
      });

    } catch (error) {
      console.error("Auto discover error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
