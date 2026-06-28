import https from "https";
import http from "http";
import url from "url";

export function fetchHtmlAndExtractLinks(targetUrl: string): Promise<Array<{text: string, url: string}>> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = url.parse(targetUrl);
      const isHttps = parsedUrl.protocol === "https:";
      const client = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path || "/",
        port: parsedUrl.port || (isHttps ? 443 : 80),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        },
        timeout: 10000
      };

      const req = client.get(options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = url.resolve(targetUrl, res.headers.location);
          return fetchHtmlAndExtractLinks(redirectUrl).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Website returned status code: ${res.statusCode}`));
        }

        let html = "";
        res.on("data", chunk => html += chunk);
        res.on("end", () => {
          const links = [];
          const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]+)"[^>]*>(.*?)<\/a>/gis;
          let match;
          
          while ((match = regex.exec(html)) !== null) {
            let href = match[1].trim();
            let text = match[2].replace(/<[^>]*>/g, "").trim();
            
            if (href && !href.startsWith("http://") && !href.startsWith("https://")) {
              href = url.resolve(targetUrl, href);
            }

            if (href.startsWith("http")) {
              // Automatisk hashtag-rensning inbyggd!
              const cleanUrl = href.split("#")[0];
              links.push({ text: text || cleanUrl, url: cleanUrl });
            }
          }

          const uniqueLinks = [];
          const seen = new Set();
          for (const item of links) {
            if (!seen.has(item.url)) {
              seen.add(item.url);
              uniqueLinks.push(item);
            }
          }

          resolve(uniqueLinks);
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Timeout fetching webpage (10 seconds)"));
      });
      req.on("error", err => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}