#!/usr/bin/env node

/**
 * H - Universell AI-Guide & Web-Scraper MCP Server (Model Context Protocol)
 * Version: 3.0.0
 * 
 * En helt fristående, plug-and-play MCP-server för Node.js utan externa beroenden!
 * Den tillåter AI-agenter att dynamiskt crawla källor från valfri URL i realtid
 * samt öppna webbläsartabbar lokalt på din dator.
 */

const { exec } = require("child_process");
const https = require("https");
const http = require("http");
const url = require("url");

function fetchHtmlAndExtractLinks(targetUrl, filterKeyword = "") {
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
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = url.resolve(targetUrl, res.headers.location);
          return fetchHtmlAndExtractLinks(redirectUrl, filterKeyword).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Webbplatsen returnerade felkod: ${res.statusCode}`));
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
              const matchedKeyword = !filterKeyword || 
                text.toLowerCase().includes(filterKeyword.toLowerCase()) || 
                href.toLowerCase().includes(filterKeyword.toLowerCase());

              if (matchedKeyword) {
                links.push({ text: text || href, url: href });
              }
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

          resolve({
            url: targetUrl,
            foundCount: uniqueLinks.length,
            links: uniqueLinks.slice(0, 100)
          });
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Timeout vid hämtning av webbsidan (10 sekunder)"));
      });
      req.on("error", err => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

function openWebpage(targetUrl) {
  return new Promise((resolve, reject) => {
    if (!/^https?:\/\/[a-z0-9-._~:/?#[\]@!$&'()*+,;=]+$/i.test(targetUrl)) {
      return reject(new Error("Ogiltig eller osäker URL-adress."));
    }
    const platform = process.platform;
    let cmd = "";
    if (platform === "darwin") cmd = `open "${targetUrl}"`;
    else if (platform === "win32") cmd = `start "" "${targetUrl}"`;
    else cmd = `xdg-open "${targetUrl}"`;

    exec(cmd, (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let lineEnd;
  while ((lineEnd = buffer.indexOf("\n")) !== -1) {
    const rawLine = buffer.slice(0, lineEnd).trim();
    buffer = buffer.slice(lineEnd + 1);
    if (rawLine) handleRequest(rawLine);
  }
});

function sendResponse(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function handleRequest(rawLine) {
  let req;
  try {
    req = JSON.parse(rawLine);
  } catch (err) {
    return sendResponse({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null });
  }
  const { method, id, params } = req;

  if (method === "initialize") {
    return sendResponse({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "h-universal-guide-server", version: "3.0.0" }
      }
    });
  }

  if (method === "tools/list") {
    return sendResponse({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "extract_web_sources",
            description: "Crawl och extraktion av underlänkar från valfri URL i realtid (t.ex. en handbok eller dokumentation) för kopiering till NotebookLM.",
            inputSchema: {
              type: "object",
              properties: {
                url: { type: "string", description: "Mål-URL:en som ska analyseras (t.ex. https://example.com)." },
                filter: { type: "string", description: "Valfritt nyckelord för att filtrera resultaten." }
              },
              required: ["url"]
            }
          },
          {
            name: "open_webpage",
            description: "Öppnar valfri webbsida i din lokala standardwebbläsare.",
            inputSchema: {
              type: "object",
              properties: {
                url: { type: "string", description: "Webbadressen som ska öppnas." }
              },
              required: ["url"]
            }
          }
        ]
      }
    });
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params || {};
    if (name === "extract_web_sources") {
      const targetUrl = args && args.url;
      const filter = args && args.filter;
      if (!targetUrl) return sendResponse({ jsonrpc: "2.0", id, error: { code: -32602, message: "Missing required argument: url" } });

      fetchHtmlAndExtractLinks(targetUrl, filter)
        .then((result) => {
          sendResponse({
            jsonrpc: "2.0",
            id,
            result: {
              content: [ { type: "text", text: `Extraktionen lyckades! Hittade ${result.foundCount} st länkar:\n\n${JSON.stringify(result.links, null, 2)}` } ]
            }
          });
        })
        .catch((err) => {
          sendResponse({ jsonrpc: "2.0", id, result: { isError: true, content: [ { type: "text", text: `Kunde inte skrapa källor: ${err.message}` } ] } });
        });
      return;
    }

    if (name === "open_webpage") {
      const targetUrl = args && args.url;
      if (!targetUrl) return sendResponse({ jsonrpc: "2.0", id, error: { code: -32602, message: "Missing required argument: url" } });
      openWebpage(targetUrl)
        .then(() => {
          sendResponse({ jsonrpc: "2.0", id, result: { content: [ { type: "text", text: `Sidan öppnades framgångsrikt: ${targetUrl}` } ] } });
        })
        .catch((err) => {
          sendResponse({ jsonrpc: "2.0", id, result: { isError: true, content: [ { type: "text", text: `Kunde inte öppna sidan: ${err.message}` } ] } });
        });
      return;
    }
  }
}