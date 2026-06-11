const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const session = 'photo-gesture-bug';
const outdir = path.join(process.cwd(), '.dbg');
fs.mkdirSync(outdir, { recursive: true });

const logFile = path.join(outdir, `trae-debug-log-${session}.ndjson`);
try {
  fs.unlinkSync(logFile);
} catch {}

const envFile = path.join(outdir, `${session}.env`);

function getIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

const ip = getIp();
const port = 7777;

fs.writeFileSync(
  envFile,
  `DEBUG_SERVER_URL=http://${ip}:${port}/event\nDEBUG_SESSION_ID=${session}\n`,
  'utf8'
);

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
    });
    res.end('ok');
    return;
  }

  if (req.method === 'POST' && req.url === '/event') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      fs.appendFileSync(logFile, `${body.trim()}\n`, 'utf8');
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      });
      res.end('{"ok":true}');
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    const count = fs.existsSync(logFile)
      ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).length
      : 0;
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({ ok: true, port, ip, count }));
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/logs')) {
    const data = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain',
    });
    res.end(data);
    return;
  }

  res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
  res.end('not found');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`debug-server ${session} http://${ip}:${port}/event`);
});
