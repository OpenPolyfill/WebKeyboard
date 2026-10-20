"use strict";

const webKeyboardSources = (() => {
  const DEFAULT_PORTS = { http: "80", https: "443", ws: "80", wss: "443" };

  function defaultPort(scheme) {
    return DEFAULT_PORTS[scheme] || "";
  }

  function parse(value, quoted = false) {
    if (typeof value !== "string" || value.length === 0) return null;
    const lower = value.toLowerCase();
    if (lower === "self") return { kind: "self" };
    if (!quoted && value === "*") return { kind: "all" };
    if (!quoted && /^[a-z][a-z\d+.-]*:$/i.test(value)) {
      return { kind: "scheme", scheme: value.slice(0, -1).toLowerCase() };
    }

    const match = /^(?:([a-z][a-z\d+.-]*):\/\/)?((?:\*\.)?[^/:]+)(?::(\*|\d+))?(\/.*)?$/i.exec(value);
    if (!match) return null;
    const scheme = match[1]?.toLowerCase() || null;
    const wildcardHost = match[2].startsWith("*.");
    const hostname = wildcardHost ? match[2].slice(2) : match[2];
    if (!hostname || hostname.includes("*")) return null;
    try {
      const urlScheme = scheme || "https";
      return {
        kind: "host",
        scheme,
        hostname: new URL(`${urlScheme}://${hostname}`).hostname.toLowerCase(),
        wildcardHost,
        port: match[3] || "",
        path: match[4] || "",
      };
    } catch (_) {
      return null;
    }
  }

  function origin(origin) {
    return { kind: "origin", origin };
  }

  function schemeMatches(source, target) {
    return source === target ||
      (source === "http" && target === "https") ||
      (source === "ws" && target === "wss");
  }

  function pathMatches(sourcePath, targetPath) {
    if (!sourcePath) return true;
    if (sourcePath.endsWith("/")) return targetPath.startsWith(sourcePath);
    return targetPath === sourcePath;
  }

  function matches(source, targetOrigin, selfOrigin) {
    if (source.kind === "all") return true;
    if (source.kind === "origin") return targetOrigin === source.origin;
    if (source.kind === "self") return targetOrigin === selfOrigin;

    let target;
    try {
      target = new URL(targetOrigin);
    } catch (_) {
      return false;
    }
    const targetScheme = target.protocol.slice(0, -1).toLowerCase();
    if (source.kind === "scheme") return schemeMatches(source.scheme, targetScheme);
    if (source.kind !== "host") return false;
    if (source.scheme && !schemeMatches(source.scheme, targetScheme)) return false;

    const hostname = target.hostname.toLowerCase();
    if (source.wildcardHost) {
      if (hostname === source.hostname || !hostname.endsWith(`.${source.hostname}`)) return false;
    } else if (hostname !== source.hostname) {
      return false;
    }
    if (!pathMatches(source.path, target.pathname)) return false;
    if (source.port === "*") return true;

    const targetPort = target.port || defaultPort(targetScheme);
    if (source.scheme && source.scheme !== targetScheme) {
      if (
        (source.scheme === "http" && targetScheme === "https") ||
        (source.scheme === "ws" && targetScheme === "wss")
      ) {
        return targetPort === (source.port || defaultPort(targetScheme));
      }
      return false;
    }
    if (!source.port) {
      return !source.scheme || targetPort === defaultPort(source.scheme);
    }
    return targetPort === source.port;
  }

  function allows(allowlist, targetOrigin, selfOrigin) {
    if (!allowlist || allowlist.kind === "none") return false;
    if (allowlist.kind === "all") return true;
    return allowlist.sources.some((source) => matches(source, targetOrigin, selfOrigin));
  }

  return { allows, origin, parse };
})();
