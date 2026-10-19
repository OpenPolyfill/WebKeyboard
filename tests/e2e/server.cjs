'use strict';

const http = require('node:http');

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader(
    'Permissions-Policy',
    url.pathname === '/deny' ? 'keyboard-map=()' : 'keyboard-map=*',
  );
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end('<!doctype html><html><head><title>WebKeyboard test page</title></head><body><button id="fullscreen">Fullscreen</button><script>document.querySelector("#fullscreen").addEventListener("click", () => document.documentElement.requestFullscreen());</script></body></html>');
});

server.listen(4173, '0.0.0.0');
