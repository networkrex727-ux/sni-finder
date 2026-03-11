// Enhanced ISP Detection Logic with Confidence Scoring
// Supports more ISPs and uses a weighted scoring system

const ISP_REGISTRY = {
  Airtel: {
    keywords: ['airtel', 'bharti'],
    domains: ['airtel.in', 'wynk.in', 'airtelxstream.in', 'airtelblack.in', 'myairtel.in', 'airtelpay.in'],
    ipPrefixes: ['182.7', '122.16', '49.204', '49.205', '115.248', '125.16', '125.17', '125.18', '125.19'],
    colors: { bg: '#1a0a00', border: '#ff6600', text: '#ff8833', dot: '#ff6600' }
  },
  Jio: {
    keywords: ['jio', 'reliance'],
    domains: ['jio.com', 'jiocinema.com', 'jiosaavn.com', 'jiomart.com', 'jiotv.com', 'jiofiber.in', 'jiomoney.com', 'jiocloud.com'],
    ipPrefixes: ['49.32', '49.33', '49.34', '49.35', '157.32', '157.33', '157.34', '157.35', '157.36', '157.37', '157.38', '157.39', '157.40', '157.41', '157.42', '157.43', '157.44', '157.45', '157.46', '157.47', '157.48', '157.49', '157.50'],
    colors: { bg: '#00001a', border: '#0066ff', text: '#4499ff', dot: '#0066ff' }
  },
  Vi: {
    keywords: ['vi', 'vodafone', 'idea', 'vilive'],
    domains: ['myvi.in', 'vodafone.in', 'vi.in', 'vilive.in', 'myvodafone.in', 'idea.net.in'],
    ipPrefixes: ['203.101', '202.131', '27.56', '27.57', '27.58', '27.59', '103.241', '103.242'],
    colors: { bg: '#1a001a', border: '#cc00cc', text: '#ff44ff', dot: '#cc00cc' }
  },
  BSNL: {
    keywords: ['bsnl', 'bharat sanchar'],
    domains: ['bsnl.co.in', 'portal.bsnl.in', 'selfcare.bsnl.co.in', 'bsnlportal.in', 'bsnl.in', 'bsnlmobile.in'],
    ipPrefixes: ['117.240', '117.241', '117.242', '59.160', '14.139', '210.212', '117.20', '117.21', '117.22', '117.23', '117.24', '117.25'],
    colors: { bg: '#001a00', border: '#00aa00', text: '#44cc44', dot: '#00aa00' }
  },
  Cloudflare: {
    keywords: ['cloudflare'],
    domains: ['cloudflare.com', '1.1.1.1', 'cloudflare-dns.com'],
    ipPrefixes: ['104.16', '104.17', '104.18', '104.19', '104.20', '104.21', '104.22', '104.23', '104.24', '104.25', '104.26', '104.27', '104.28', '104.29', '104.30', '104.31', '172.64', '172.65', '172.66', '172.67', '172.68', '172.69', '172.70', '172.71'],
    colors: { bg: '#1a0a00', border: '#ff6600', text: '#ff8800', dot: '#ff6600' }
  },
  Google: {
    keywords: ['google'],
    domains: ['google.com', '8.8.8.8', '8.8.4.4', 'google.co.in'],
    ipPrefixes: ['8.8.8', '8.8.4', '172.217', '142.250', '142.251'],
    colors: { bg: '#001a00', border: '#4285F4', text: '#4285F4', dot: '#EA4335' }
  },
  Amazon: {
    keywords: ['amazon', 'aws'],
    domains: ['amazon.com', 'aws.amazon.com', 'cloudfront.net'],
    ipPrefixes: ['13.232', '13.233', '13.234', '13.235', '52.95', '54.240'],
    colors: { bg: '#1a1a00', border: '#FF9900', text: '#FF9900', dot: '#FF9900' }
  }
};

const DEFAULT_COLORS = { bg: '#111', border: '#333', text: '#666', dot: '#444' };

/**
 * Detects ISP using local matching logic with confidence scoring
 */
export function detectISPLocally(domain, ip) {
  const cleanDomain = domain.toLowerCase().trim();
  let bestMatch = { isp: 'Unknown', score: 0, detectedFrom: 'none' };

  for (const [isp, data] of Object.entries(ISP_REGISTRY)) {
    let currentScore = 0;
    let currentFrom = 'none';

    // 1. Exact Domain Match (Highest priority)
    if (data.domains.some(d => cleanDomain === d)) {
      currentScore = 100;
      currentFrom = 'domain_exact';
    } 
    // 2. Subdomain/Suffix Match
    else if (data.domains.some(d => cleanDomain.endsWith('.' + d))) {
      currentScore = 90;
      currentFrom = 'domain_suffix';
    }
    // 3. Keyword in Domain
    else if (data.keywords.some(k => cleanDomain.includes(k))) {
      currentScore = 70;
      currentFrom = 'domain_keyword';
    }

    // 4. IP Prefix Match
    if (ip && ip !== 'unknown' && ip !== 'DNS Failed') {
      const ipMatch = data.ipPrefixes.some(prefix => ip.startsWith(prefix));
      if (ipMatch) {
        const ipScore = 80;
        if (ipScore > currentScore) {
          currentScore = ipScore;
          currentFrom = 'ip_prefix';
        } else {
          // Boost score if both domain and IP match
          currentScore = Math.min(100, currentScore + 10);
        }
      }
    }

    if (currentScore > bestMatch.score) {
      bestMatch = { isp, score: currentScore, detectedFrom: currentFrom };
    }
  }

  return bestMatch;
}

/**
 * Fetches ISP info from an external API for high accuracy
 */
async function fetchISPFromAPI(ip) {
  if (!ip || ip === 'unknown' || ip === 'DNS Failed' || ip.includes(':')) return null;

  try {
    // Using ip-api.com (free for non-commercial, no key required)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,isp,org,as`);
    const data = await response.json();

    if (data.status === 'success') {
      return {
        isp: data.isp,
        org: data.org,
        as: data.as,
        score: 95 // High confidence from API
      };
    }
  } catch (e) {
    console.error('ISP API Fetch failed:', e.message);
  }
  return null;
}

/**
 * Main entry point for ISP detection
 */
export async function getISPInfo(domain, ip) {
  // 1. Try API first if IP is available
  const apiResult = await fetchISPFromAPI(ip);
  
  // 2. Local matching as fallback or for domain-specific logic
  const localResult = detectISPLocally(domain, ip);

  let finalISP = localResult.isp;
  let finalScore = localResult.score;
  let finalFrom = localResult.detectedFrom;

  // If API found something, compare or merge
  if (apiResult) {
    // If local match is strong (exact domain), prefer it for better branding (e.g. "Airtel" vs "Bharti Airtel Limited")
    if (localResult.score >= 90) {
      finalScore = Math.max(localResult.score, apiResult.score);
    } else {
      // Otherwise trust the API more for the ISP name
      finalISP = apiResult.isp;
      finalScore = apiResult.score;
      finalFrom = 'api_lookup';
    }
  }

  // Map API ISP names to our registry if possible for better colors
  let registryMatch = null;
  for (const [name, data] of Object.entries(ISP_REGISTRY)) {
    if (finalISP.toLowerCase().includes(name.toLowerCase()) || 
        data.keywords.some(k => finalISP.toLowerCase().includes(k))) {
      registryMatch = name;
      break;
    }
  }

  const colors = registryMatch ? ISP_REGISTRY[registryMatch].colors : DEFAULT_COLORS;

  return {
    isp: finalISP,
    confidence: finalScore,
    detectedFrom: finalFrom,
    colors: colors,
    isCommon: !!registryMatch
  };
}
