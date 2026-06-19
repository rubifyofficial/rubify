const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sessionId = 'mensajes-call-startup';
const outDir = path.resolve('.dbg');
const logFile = path.join(outDir, `trae-debug-log-${sessionId}.ndjson`);
const envFile = path.join(outDir, `${sessionId}.env`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(logFile, '');
const nets = os.networkInterfaces();
let host = '127.0.0.1';
for (const name of Object.keys(nets)) {
  for (const net of nets[name] || []) {
    if (net.family === 'IPv4' && !net.internal) { host = net.address; break; }
  }
  if (host !== '127.0.0.1') break;
}
const startPort = 7777;
let server;
const tryListen = (port, retries = 10) => {
  server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS' && req.url === '/event') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }
    if (req.method === 'POST' && req.url === '/event') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const event = JSON.parse(body || '{}');
          if (!event.ts) event.ts = Date.now();
          fs.appendFileSync(logFile, JSON.stringify(event) + '\n');
          res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
        } catch (error) {
          res.writeHead(400, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(error.message || error) }));
        }
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sessionId, logFile }));
      return;
    }
    res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
    res.end();
  });
  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE' && retries > 0) {
      tryListen(port + 1, retries - 1);
      return;
    }
    throw error;
  });
  server.listen(port, '0.0.0.0', () => {
    const apiUrl = `http://${host}:${port}/event`;
    fs.writeFileSync(envFile, `DEBUG_SERVER_URL=${apiUrl}\nDEBUG_SESSION_ID=${sessionId}\n`);
    console.log('@@DEBUG_SERVER_INFO');
    console.log(JSON.stringify({ api_url: apiUrl, session_id: sessionId, log_dir: outDir, log_file: logFile, env_file: envFile }, null, 2));
    console.log('@@END_DEBUG_SERVER_INFO');
  });
};
tryListen(startPort);
setInterval(() => {}, 1000);
