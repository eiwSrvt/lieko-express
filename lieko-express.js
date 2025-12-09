const { createServer } = require('http');
const net = require("net");
const fs = require("fs");
const path = require("path");

const {
  Schema,
  ValidationError,
  validators,
  validate,
  validatePartial
} = require('./lib/schema');

process.env.UV_THREADPOOL_SIZE = require('os').availableParallelism();

class LiekoExpress {
  constructor() {
    this.groupStack = [];
    this.routes = [];
    this.middlewares = [];
    this.errorHandlers = [];
    this.notFoundHandler = null;
    this.server = null;

    this.settings = {
      debug: false,
      'x-powered-by': 'lieko-express',
      'trust proxy': false,
      strictTrailingSlash: true,
      allowTrailingSlash: true,
      views: path.join(process.cwd(), "views"),
      "view engine": "html"
    };

    this.engines = {};
    this.engines['.html'] = this._defaultHtmlEngine.bind(this);

    this.bodyParserOptions = {
      json: {
        limit: '10mb',
        strict: true
      },
      urlencoded: {
        limit: '10mb',
        extended: true
      },
      multipart: {
        limit: '10mb'
      }
    };

    this.corsOptions = {
      enabled: false,
      origin: "*",
      strictOrigin: false,
      allowPrivateNetwork: false,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      headers: ["Content-Type", "Authorization"],
      credentials: false,
      maxAge: 86400,
      exposedHeaders: [],
      debug: false
    };

    this.excludedPatterns = [
      /^\/\.well-known\/.*/i // Chrome DevTools, Apple, etc.
    ]
  }

  excludeUrl(patterns) {
    if (!Array.isArray(patterns)) patterns = [patterns];
    this.excludedPatterns = this.excludedPatterns || [];

    patterns.forEach(pattern => {
      if (pattern instanceof RegExp) {
        this.excludedPatterns.push(pattern);
        return;
      }

      let regexStr = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\*/g, '.*');

      regexStr = '^' + regexStr + '$';
      this.excludedPatterns.push(new RegExp(regexStr, 'i'));
    });

    return this;
  }

  _isExcluded(url) {
    if (!this.excludedPatterns?.length) return false;
    return this.excludedPatterns.some(re => re.test(url));
  }

  cors(options = {}) {
    if (options === false) {
      this._corsMiddleware = null;
      return this;
    }

    const middleware = require('./lib/cors')(options);
    this._corsMiddleware = middleware;

    const stack = new Error().stack;
    if (!stack.includes('at LiekoExpress.use')) {
      this.use(middleware);
    }

    return middleware;
  }

  debug(value = true) {
    if (typeof value === 'string') {
      value = value.toLowerCase() === 'true';
    }
    this.set('debug', value);
    return this;
  }

  set(name, value) {
    this.settings[name] = value;
    return this;
  }

  engine(ext, renderFunction) {
    if (!ext.startsWith(".")) ext = "." + ext;
    this.engines[ext] = renderFunction;
    return this;
  }

  enable(name) {
    this.settings[name] = true;
    return this;
  }

  disable(name) {
    this.settings[name] = false;
    return this;
  }

  enabled(name) {
    return !!this.settings[name];
  }

  disabled(name) {
    return !this.settings[name];
  }

  bodyParser(options = {}) {
    if (options.limit) {
      this.bodyParserOptions.json.limit = options.limit;
      this.bodyParserOptions.urlencoded.limit = options.limit;
      this.bodyParserOptions.multipart.limit = options.limit;
    }
    if (options.extended !== undefined) {
      this.bodyParserOptions.urlencoded.extended = options.extended;
    }
    if (options.strict !== undefined) {
      this.bodyParserOptions.json.strict = options.strict;
    }
    return this;
  }

  json(options = {}) {
    if (options.limit) {
      this.bodyParserOptions.json.limit = options.limit;
    }
    if (options.strict !== undefined) {
      this.bodyParserOptions.json.strict = options.strict;
    }
    return this;
  }

  urlencoded(options = {}) {
    if (options.limit) {
      this.bodyParserOptions.urlencoded.limit = options.limit;
    }
    if (options.extended !== undefined) {
      this.bodyParserOptions.urlencoded.extended = options.extended;
    }
    return this;
  }

  multipart(options = {}) {
    if (options.limit) {
      this.bodyParserOptions.multipart.limit = options.limit;
    }
    return this;
  }

  _parseLimit(limit) {
    if (typeof limit === 'number') return limit;

    const match = limit.match(/^(\d+(?:\.\d+)?)(kb|mb|gb)?$/i);
    if (!match) return 1048576;

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'b').toLowerCase();

    const multipliers = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024
    };

    return value * multipliers[unit];
  }

  async _parseBody(req, routeOptions = null) {
    return new Promise((resolve, reject) => {

      if (['GET', 'DELETE', 'HEAD'].includes(req.method)) {
        req.body = {};
        req.files = {};
        req._bodySize = 0;
        return resolve();
      }

      const contentType = (req.headers['content-type'] || '').toLowerCase();
      const options = routeOptions || this.bodyParserOptions;

      req.body = {};
      req.files = {};

      let raw = Buffer.alloc(0);
      let size = 0;
      let limitExceeded = false;
      let errorSent = false;

      const detectLimit = () => {
        if (contentType.includes('application/json')) {
          return this._parseLimit(options.json.limit);
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          return this._parseLimit(options.urlencoded.limit);
        } else if (contentType.includes('multipart/form-data')) {
          return this._parseLimit(options.multipart.limit);
        } else {
          return this._parseLimit('1mb');
        }
      };

      const limit = detectLimit();
      const limitLabel =
        contentType.includes('application/json') ? options.json.limit :
          contentType.includes('application/x-www-form-urlencoded') ? options.urlencoded.limit :
            contentType.includes('multipart/form-data') ? options.multipart.limit :
              '1mb';

      req.on('data', chunk => {
        if (limitExceeded || errorSent) return;

        size += chunk.length;

        if (size > limit) {
          limitExceeded = true;
          errorSent = true;

          req.removeAllListeners('data');
          req.removeAllListeners('end');
          req.removeAllListeners('error');

          req.on('data', () => { });
          req.on('end', () => { });

          const error = new Error(`Request body too large. Limit: ${limitLabel}`);
          error.status = 413;
          error.code = 'PAYLOAD_TOO_LARGE';
          return reject(error);
        }

        raw = Buffer.concat([raw, chunk]);
      });

      req.on('end', () => {
        if (limitExceeded) return;

        req._bodySize = size;

        try {

          if (contentType.includes('application/json')) {
            const text = raw.toString();
            try {
              req.body = JSON.parse(text);

              if (options.json.strict && text.trim() && !['[', '{'].includes(text.trim()[0])) {
                return reject(new Error('Strict mode: body must be an object or array'));
              }
            } catch (err) {
              req.body = {};
            }
          }

          else if (contentType.includes('application/x-www-form-urlencoded')) {
            const text = raw.toString();
            const params = new URLSearchParams(text);
            req.body = {};

            if (options.urlencoded.extended) {
              for (const [key, value] of params) {
                if (key.includes('[')) {
                  const match = key.match(/^([^\[]+)\[([^\]]*)\]$/);
                  if (match) {
                    const [, objKey, subKey] = match;
                    if (!req.body[objKey]) req.body[objKey] = {};
                    if (subKey) req.body[objKey][subKey] = value;
                    else {
                      if (!Array.isArray(req.body[objKey])) req.body[objKey] = [];
                      req.body[objKey].push(value);
                    }
                    continue;
                  }
                }
                req.body[key] = value;
              }
            } else {
              req.body = Object.fromEntries(params);
            }
          }

          else if (contentType.includes('multipart/form-data')) {
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            if (!boundaryMatch) return reject(new Error('Missing multipart boundary'));

            const boundary = '--' + boundaryMatch[1];

            const text = raw.toString('binary');
            const parts = text.split(boundary).filter(p => p && !p.includes('--'));

            for (let part of parts) {
              const headerEnd = part.indexOf('\r\n\r\n');
              if (headerEnd === -1) continue;

              const headers = part.slice(0, headerEnd);
              const body = part.slice(headerEnd + 4).replace(/\r\n$/, '');

              const nameMatch = headers.match(/name="([^"]+)"/);
              const filenameMatch = headers.match(/filename="([^"]*)"/);
              const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);

              const field = nameMatch?.[1];
              if (!field) continue;

              if (filenameMatch?.[1]) {
                const bin = Buffer.from(body, 'binary');

                req.files[field] = {
                  filename: filenameMatch[1],
                  data: bin,
                  size: bin.length,
                  contentType: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream'
                };
              } else {
                req.body[field] = body;
              }
            }
          }

          else {
            const text = raw.toString();
            req.body = text ? { text } : {};
          }

          for (const key in req.body) {
            const value = req.body[key];

            if (typeof value === 'string' && value.trim() !== '' && !isNaN(value)) {
              req.body[key] = parseFloat(value);
            } else if (value === 'true') {
              req.body[key] = true;
            } else if (value === 'false') {
              req.body[key] = false;
            }
          }

          resolve();

        } catch (error) {
          reject(error);
        }
      });

      req.on('error', reject);
    });
  }

  get(...args) {
    if (args.length === 1 && typeof args[0] === 'string' && !args[0].startsWith('/')) {
      return this.settings[args[0]];
    } else {
      this._addRoute('GET', ...args);
      return this;
    }
  }

  post(path, ...handlers) {
    this._addRoute('POST', path, ...handlers);
    return this;
  }

  put(path, ...handlers) {
    this._addRoute('PUT', path, ...handlers);
    return this;
  }

  delete(path, ...handlers) {
    this._addRoute('DELETE', path, ...handlers);
    return this;
  }

  patch(path, ...handlers) {
    this._addRoute('PATCH', path, ...handlers);
    return this;
  }

  all(path, ...handlers) {
    this._addRoute('ALL', path, ...handlers);
    return this;
  }

  group(basePath, ...args) {
    const parent = this;

    const callback = args.pop();
    if (typeof callback !== "function") {
      throw new Error("group() requires a callback as last argument");
    }

    const middlewares = args.filter(fn => typeof fn === "function");

    const normalize = (p) => p.replace(/\/+$/, '');
    const fullBase = normalize(basePath);

    const subApp = {
      _call(method, path, handlers) {
        const finalPath = normalize(fullBase + path);
        parent[method](finalPath, ...middlewares, ...handlers);
        return subApp;
      },
      get(path, ...handlers) { return this._call('get', path, handlers); },
      post(path, ...handlers) { return this._call('post', path, handlers); },
      put(path, ...handlers) { return this._call('put', path, handlers); },
      patch(path, ...handlers) { return this._call('patch', path, handlers); },
      delete(path, ...handlers) { return this._call('delete', path, handlers); },
      all(path, ...handlers) { return this._call('all', path, handlers); },

      use(pathOrMw, ...rest) {
        if (typeof pathOrMw === 'object' && pathOrMw instanceof LiekoExpress) {
          const finalPath = fullBase === '/' ? '/' : fullBase;
          parent.use(finalPath, ...middlewares, pathOrMw);
          return subApp;
        }

        if (typeof pathOrMw === "function") {
          parent.use(fullBase, ...middlewares, pathOrMw);
          return subApp;
        }

        if (typeof pathOrMw === "string") {
          const finalPath = normalize(fullBase + pathOrMw);
          parent.use(finalPath, ...middlewares, ...rest);
          return subApp;
        }

        throw new Error("Invalid group.use() arguments");
      },

      group(subPath, ...subArgs) {
        const subCb = subArgs.pop();
        const subMw = subArgs.filter(fn => typeof fn === "function");

        const finalPath = normalize(fullBase + subPath);
        parent.group(finalPath, ...middlewares, ...subMw, subCb);
        return subApp;
      }
    };

    this.groupStack.push({ basePath: fullBase, middlewares });
    callback(subApp);
    this.groupStack.pop();

    return this;
  }

  _checkMiddleware(handler) {
    const isAsync = handler instanceof (async () => { }).constructor;

    if (isAsync) return;

    if (handler.length < 3) {
      const funcString = handler.toString();
      const stack = new Error().stack;
      let userFileInfo = 'unknown location';
      let userLine = '';

      if (stack) {
        const lines = stack.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          if (line.includes('lieko-express.js') ||
            line.includes('_checkMiddleware') ||
            line.includes('at LiekoExpress.') ||
            line.includes('at Object.<anonymous>') ||
            line.includes('at Module._compile')) {
            continue;
          }

          const fileMatch = line.match(/\(?(.+?):(\d+):(\d+)\)?$/);
          if (fileMatch) {
            const filePath = fileMatch[1];
            const lineNumber = fileMatch[2];

            const shortPath = filePath.replace(process.cwd(), '.');
            userFileInfo = `${shortPath}:${lineNumber}`;
            userLine = line;
            break;
          }
        }
      }

      const firstLine = funcString.split('\n')[0];
      const secondLine = funcString.split('\n')[1] || '';
      const thirdLine = funcString.split('\n')[2] || '';

      const yellow = '\x1b[33m';
      const red = '\x1b[31m';
      const cyan = '\x1b[36m';
      const reset = '\x1b[0m';
      const bold = '\x1b[1m';

      console.warn(`
${yellow}${bold}⚠️  WARNING: Middleware missing 'next' parameter${reset}
${yellow}This middleware may block the request pipeline.${reset}

${cyan}📍 Defined at:${reset} ${userFileInfo}
${userLine ? `${cyan}   Stack trace:${reset} ${userLine}` : ''}

${cyan}🔧 Middleware definition:${reset}
${yellow}${firstLine.substring(0, 100)}${firstLine.length > 100 ? '...' : ''}${reset}
${secondLine ? `${yellow}   ${secondLine.substring(0, 100)}${secondLine.length > 100 ? '...' : ''}${reset}` : ''}
${thirdLine ? `${yellow}   ${thirdLine.substring(0, 100)}${thirdLine.length > 100 ? '...' : ''}${reset}` : ''}

${red}${bold}FIX:${reset} Add 'next' as third parameter and call it:
${cyan}    (req, res, next) => { 
        // your code here
        next(); // ← Don't forget to call next()
    }${reset}
    `);
    }
  }

  notFound(handler) {
    this.notFoundHandler = handler;
    return this;
  }

  errorHandler(handler) {
    if (handler.length !== 4) {
      throw new Error('errorHandler() requires (err, req, res, next)');
    }
    this.errorHandlers.push(handler);
    return this;
  }

  use(...args) {
    // auto-mount router on "/"
    if (args.length === 1 && args[0] instanceof LiekoExpress) {
      this._mountRouter('/', args[0]);
      return this;
    }

    // app.use(middleware)
    if (args.length === 1 && typeof args[0] === 'function') {
      this._checkMiddleware(args[0]);
      this.middlewares.push({ path: null, handler: args[0] });
      return this;
    }

    // app.use(path, middleware)
    if (args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'function') {
      this._checkMiddleware(args[1]);
      this.middlewares.push({ path: args[0], handler: args[1] });
      return this;
    }

    // app.use(path, router)
    if (args.length === 2 && typeof args[0] === 'string' && args[1] instanceof LiekoExpress) {
      this._mountRouter(args[0], args[1]);
      return this;
    }

    // app.use(path, middleware, router)
    if (args.length === 3 && typeof args[0] === 'string' && typeof args[1] === 'function' && args[2] instanceof LiekoExpress) {
      const [path, middleware, router] = args;
      this._checkMiddleware(middleware);
      this.middlewares.push({ path, handler: middleware });
      this._mountRouter(path, router);
      return this;
    }

    // app.use(path, ...middlewares, router)
    if (args.length >= 3 && typeof args[0] === 'string') {
      const path = args[0];
      const lastArg = args[args.length - 1];

      if (lastArg instanceof LiekoExpress) {
        const middlewares = args.slice(1, -1);
        middlewares.forEach(mw => {
          if (typeof mw === 'function') {
            this._checkMiddleware(mw);
            this.middlewares.push({ path, handler: mw });
          }
        });
        this._mountRouter(path, lastArg);
        return this;
      }

      const middlewares = args.slice(1);
      const allFunctions = middlewares.every(mw => typeof mw === 'function');
      if (allFunctions) {
        middlewares.forEach(mw => {
          this._checkMiddleware(mw);
          this.middlewares.push({ path, handler: mw });
        });
        return this;
      }
    }

    throw new Error('Invalid use() arguments');
  }

  static(root, options = {}) {
    return require('./lib/static')(root, options);
  }

  _mountRouter(basePath, router) {
    basePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    router.groupStack = [...this.groupStack];

    router.routes.forEach(route => {
      const fullPath = route.path === '' ? basePath : basePath + route.path;

      this.routes.push({
        ...route,
        path: fullPath,
        pattern: this._pathToRegex(fullPath),
        groupChain: [
          ...this.groupStack,
          ...(route.groupChain || [])
        ],
        bodyParserOptions: router.bodyParserOptions
      });
    });

    router.middlewares.forEach(mw => {
      this.middlewares.push({
        path: basePath === '' ? mw.path : (mw.path ? basePath + mw.path : basePath),
        handler: mw.handler
      });
    });
  }

  _addRoute(method, path, ...handlers) {
    if (handlers.length === 0) {
      throw new Error('Route handler is required');
    }

    const finalHandler = handlers[handlers.length - 1];
    if (!finalHandler) {
      throw new Error(`Route handler is undefined for ${method} ${path}`);
    }

    const routeMiddlewares = handlers.slice(0, -1);

    routeMiddlewares.forEach(mw => {
      if (typeof mw === 'function') {
        this._checkMiddleware(mw);
      }
    });

    const paths = Array.isArray(path) ? path : [path];

    paths.forEach(original => {
      let p = String(original).trim();
      p = p.replace(/\/+/g, '/');

      if (p !== '/' && p.endsWith('/')) {
        p = p.slice(0, -1);
      }

      const exists = this.routes.some(r =>
        r.method === method &&
        r.path === p &&
        r.handler === finalHandler
      );

      if (exists) return;

      this.routes.push({
        method,
        path: p,
        originalPath: original,
        handler: finalHandler,
        handlerName: (finalHandler && finalHandler.name) || 'anonymous',
        middlewares: routeMiddlewares,
        pattern: this._pathToRegex(p),
        allowTrailingSlash: this.settings.allowTrailingSlash ?? false,
        groupChain: [...this.groupStack]
      });
    });
  }

  _pathToRegex(path) {
    let p = String(path).trim();
    p = p.replace(/\/+/g, '/');

    if (p !== '/' && p.endsWith('/')) {
      p = p.slice(0, -1);
    }

    let pattern = p
      .replace(/:(\w+)/g, '(?<$1>[^/]+)')
      .replace(/\*/g, '.*');

    const isStatic = !/[:*]/.test(p) && p !== '/';

    const allowTrailing = this.settings.allowTrailingSlash !== false;

    if (isStatic && allowTrailing) {
      pattern += '/?';
    }

    if (p === '/') {
      return /^\/?$/;
    }

    return new RegExp(`^${pattern}$`);
  }

  _findRoute(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method && route.method !== 'ALL') continue;

      const match = pathname.match(route.pattern);
      if (match) {
        return { ...route, params: match.groups || {}, matchedPath: pathname };
      }
    }

    if (pathname.endsWith('/') && pathname.length > 1) {
      const cleanPath = pathname.slice(0, -1);
      for (const route of this.routes) {
        if (route.method !== method && route.method !== 'ALL') continue;

        if (route.path === cleanPath && route.allowTrailingSlash !== false) {
          const match = cleanPath.match(route.pattern);
          if (match) {
            return {
              ...route,
              params: match.groups || {},
              matchedPath: cleanPath,
              wasTrailingSlash: true
            };
          }
        }
      }
    }
    return null;
  }

  async _runErrorHandlers(err, req, res) {
    if (this.errorHandlers.length === 0) {
      console.error("\n🔥 INTERNAL ERROR");
      console.error(err.stack || err);
      return res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: err.message
      });
    }

    let index = 0;

    const runNext = async () => {
      const handler = this.errorHandlers[index++];
      if (!handler) return;

      return new Promise((resolve, reject) => {
        try {
          handler(err, req, res, (nextErr) => {
            if (nextErr) reject(nextErr);
            else resolve(runNext());
          });
        } catch (e) {
          reject(e);
        }
      });
    };

    try {
      await runNext();
    } catch (e) {
      console.error("\n🔥 ERROR INSIDE ERROR HANDLER");
      console.error(e.stack || e);
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: e.message
      });
    }
  }

  error(res, errorObj) {
    if (typeof errorObj === "string") {
      errorObj = { message: errorObj };
    }

    if (!errorObj || typeof errorObj !== "object") {
      return res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Invalid error format passed to res.error()"
        }
      });
    }

    const HTTP_STATUS = {
      // 4xx – CLIENT ERRORS
      INVALID_REQUEST: 400,
      VALIDATION_FAILED: 400,
      NO_TOKEN_PROVIDED: 401,
      INVALID_TOKEN: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      METHOD_NOT_ALLOWED: 405,
      CONFLICT: 409,
      RECORD_EXISTS: 409,
      TOO_MANY_REQUESTS: 429,

      // 5xx – SERVER ERRORS
      SERVER_ERROR: 500,
      SERVICE_UNAVAILABLE: 503
    };

    const status = errorObj.status || HTTP_STATUS[errorObj.code] || 500;

    return res.status(status).json({
      success: false,
      error: {
        code: errorObj.code || 'SERVER_ERROR',
        message: errorObj.message || 'An error occurred',
        ...errorObj
      }
    });
  }

  _parseIp(rawIp) {
    if (!rawIp) return { raw: null, ipv4: null, ipv6: null };
    let ip = rawIp.trim();

    if (ip === '::1') {
      ip = '127.0.0.1';
    }

    if (ip.startsWith('::ffff:')) {
      ip = ip.slice(7);
    }

    const family = net.isIP(ip);

    if (family === 0) {
      return { raw: rawIp, ipv4: null, ipv6: null };
    }

    return {
      raw: rawIp,
      ipv4: family === 4 ? ip : null,
      ipv6: family === 6 ? ip : null,
    };
  }

  _isTrustedProxy(ip) {
    const trust = this.settings['trust proxy'];

    if (!trust) return false;

    if (trust === true) return true;

    if (trust === 'loopback') {
      return ip === '127.0.0.1' || ip === '::1';
    }

    if (typeof trust === 'string') {
      return ip === trust;
    }

    if (Array.isArray(trust)) {
      return trust.includes(ip);
    }

    if (typeof trust === 'function') {
      return trust(ip);
    }

    return false;
  }

  async _handleRequest(req, res) {
    if (this._isExcluded(req.url.split('?')[0])) {
      res.statusCode = 404;
      return res.end();
    }

    this._enhanceRequest(req);

    const url = req.url;
    const qIndex = url.indexOf('?');
    const pathname = qIndex === -1 ? url : url.substring(0, qIndex);

    const query = {};
    if (qIndex !== -1) {
      const searchParams = new URLSearchParams(url.substring(qIndex + 1));
      for (const [key, value] of searchParams) query[key] = value;
    }
    req.query = query;
    req.params = {};

    for (const key in req.query) {
      const v = req.query[key];
      if (v === 'true') req.query[key] = true;
      else if (v === 'false') req.query[key] = false;
      else if (/^\d+$/.test(v)) req.query[key] = parseInt(v);
      else if (/^\d+\.\d+$/.test(v)) req.query[key] = parseFloat(v);
    }

    req._startTime = process.hrtime.bigint();
    this._enhanceResponse(req, res);

    req.originalUrl = url;

    try {
      if (req.method === "OPTIONS" && this.corsOptions.enabled) {
        this._applyCors(req, res, this.corsOptions);
        return;
      }

      const route = this._findRoute(req.method, pathname);

      if (route) {
        if (route.cors === false) {
        } else if (route.cors) {
          const finalCors = {
            ...this.corsOptions,
            enabled: true,
            ...route.cors
          };

          this._applyCors(req, res, finalCors);
          if (req.method === "OPTIONS") return;
        } else if (this.corsOptions.enabled) {
          this._applyCors(req, res, this.corsOptions);
          if (req.method === "OPTIONS") return;
        }
      } else {
        if (this.corsOptions.enabled) {
          this._applyCors(req, res, this.corsOptions);
          if (req.method === "OPTIONS") return;
        }
      }

      try {
        await this._parseBody(req, route ? route.bodyParserOptions : null);
      } catch (error) {
        if (error.code === 'PAYLOAD_TOO_LARGE') {
          return res.status(413).json({
            success: false,
            error: 'Payload Too Large',
            message: error.message
          });
        }
        return await this._runErrorHandlers(error, req, res);
      }

      for (const mw of this.middlewares) {
        if (res.headersSent) return;

        let shouldExecute = false;
        let pathToStrip = '';

        if (mw.path === null) {
          shouldExecute = true;
        } else if (url.startsWith(mw.path)) {
          shouldExecute = true;
          pathToStrip = mw.path;
        }

        if (!shouldExecute) continue;

        await new Promise((resolve, reject) => {
          const currentUrl = req.url;

          if (pathToStrip) {
            req.url = url.substring(pathToStrip.length) || '/';
          }

          const next = async (err) => {
            req.url = currentUrl;

            if (err) {
              await this._runErrorHandlers(err, req, res);
              return resolve();
            }
            resolve();
          };

          const result = mw.handler(req, res, next);
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject);
          }
        });
      }

      if (res.headersSent) return;

      if (!route) {
        if (this.notFoundHandler) return this.notFoundHandler(req, res);
        return res.status(404).json({ error: 'Route not found' });
      }

      req.params = route.params;

      for (const middleware of route.middlewares) {
        if (res.headersSent) return;

        await new Promise((resolve, reject) => {
          const next = async (err) => {
            if (err) {
              await this._runErrorHandlers(err, req, res);
              return resolve();
            }
            resolve();
          };

          const result = middleware(req, res, next);
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject);
          }
        });
      }

      if (res.headersSent) return;

      await route.handler(req, res);

    } catch (error) {
      if (!res.headersSent) {
        await this._runErrorHandlers(error, req, res);
      } else {
        console.error("UNCAUGHT ERROR AFTER RESPONSE SENT:", error);
      }
    }
  }

  _enhanceRequest(req) {
    req.app = this;
    let remoteIp = req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      '';

    const forwardedFor = req.headers['x-forwarded-for'];
    let clientIp = remoteIp;
    let ipsChain = [remoteIp];

    if (forwardedFor) {
      const chain = forwardedFor
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      if (chain.length > 0 && this._isTrustedProxy(remoteIp)) {
        clientIp = chain[0];
        ipsChain = chain;
      }
    }

    req.ip = this._parseIp(clientIp);
    req.ips = ipsChain;
    req.ip.display = req.ip.ipv4 ?? '127.0.0.1';
    req.protocol = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
    req.secure = req.protocol === 'https';

    const host = req.headers['host'];
    if (host) {
      const [hostname] = host.split(':');
      req.hostname = hostname;
      req.subdomains = hostname.split('.').slice(0, -2).reverse();
    } else {
      req.hostname = '';
      req.subdomains = [];
    }

    req.originalUrl = req.url;
    req.xhr = (req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest';

    req.get = (name) => {
      if (typeof name !== 'string') return undefined;
      const lower = name.toLowerCase();
      for (const key in req.headers) {
        if (key.toLowerCase() === lower) return req.headers[key];
      }
      return undefined;
    };
    req.header = req.get;

    const parseAccept = (header) => {
      if (!header) return [];
      return header
        .split(',')
        .map(part => {
          const [type, ...rest] = part.trim().split(';');
          const q = rest
            .find(p => p.trim().startsWith('q='))
            ?.split('=')[1];
          const quality = q ? parseFloat(q) : 1.0;
          return { type: type.trim().toLowerCase(), quality };
        })
        .filter(item => item.quality > 0)
        .sort((a, b) => b.quality - a.quality)
        .map(item => item.type);
    };

    const accepts = (types) => {
      if (!Array.isArray(types)) types = [types];
      const accepted = parseAccept(req.headers['accept']);

      for (const type of types) {
        const t = type.toLowerCase();

        if (accepted.includes(t)) return type;

        if (accepted.some(a => {
          if (a === '*/*') return true;
          if (a.endsWith('/*')) {
            const prefix = a.slice(0, -1);
            return t.startsWith(prefix);
          }
          return false;
        })) {
          return type;
        }
      }

      return false;
    };

    req.accepts = function (types) {
      return accepts(types);
    };

    req.acceptsLanguages = function (langs) {
      if (!Array.isArray(langs)) langs = [langs];
      const accepted = parseAccept(req.headers['accept-language'] || '');
      for (const lang of langs) {
        const l = lang.toLowerCase();
        if (accepted.some(a => a === l || a.startsWith(l + '-'))) return lang;
      }
      return false;
    };

    req.acceptsEncodings = function (encodings) {
      if (!Array.isArray(encodings)) encodings = [encodings];
      const accepted = parseAccept(req.headers['accept-encoding'] || '');
      for (const enc of encodings) {
        if (accepted.includes(enc.toLowerCase())) return enc;
      }
      return false;
    };

    req.acceptsCharsets = function (charsets) {
      if (!Array.isArray(charsets)) charsets = [charsets];
      const accepted = parseAccept(req.headers['accept-charset'] || '');
      for (const charset of charsets) {
        if (accepted.includes(charset.toLowerCase())) return charset;
      }
      return false;
    };

    req.is = function (type) {
      const ct = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!type) return ct;
      const t = type.toLowerCase();
      if (t.includes('/')) return ct === t;
      if (t === 'json') return ct.includes('json');
      if (t === 'urlencoded') return ct.includes('x-www-form-urlencoded');
      if (t === 'multipart') return ct.includes('multipart');
      return false;
    };
  }

  _enhanceResponse(req, res) {
    res.app = this;
    res.locals = {};
    let responseSent = false;
    let statusCode = 200;

    const getDateHeader = (() => {
      let cachedDate = '';
      let lastTimestamp = 0;

      return () => {
        const now = Date.now();
        if (now !== lastTimestamp) {
          lastTimestamp = now;
          cachedDate = new Date(now).toUTCString();
        }
        return cachedDate;
      };
    })();

    const buildHeaders = (contentType, length) => {
      const poweredBy = this.settings['x-powered-by'];
      const poweredByHeader = poweredBy
        ? { 'X-Powered-By': poweredBy === true ? 'lieko-express' : poweredBy }
        : {};

      return {
        'Content-Type': contentType,
        'Content-Length': length,
        'Date': getDateHeader(),
        'Connection': 'keep-alive',
        'Cache-Control': 'no-store',
        ...poweredByHeader
      };
    };

    res.status = (code) => {
      statusCode = code;
      res.statusCode = code;
      return res;
    };

    const originalSetHeader = res.setHeader.bind(res);

    res.setHeader = function (name, value) {
      originalSetHeader(name, value);
      return this;
    };

    res.set = function (name, value) {
      if (arguments.length === 1 && typeof name === 'object' && name !== null) {
        Object.entries(name).forEach(([k, v]) => originalSetHeader(k, v));
      } else {
        originalSetHeader(name, value);
      }
      return this;
    };
    res.header = res.setHeader;

    res.removeHeader = function (name) {
      res.removeHeader(name);
      return res;
    };

    res.type = function (mime) {
      res.setHeader("Content-Type", mime);
      return res;
    };

    res.render = async (view, options = {}, callback) => {
      if (responseSent) return res;

      try {
        const locals = { ...res.locals, ...options };
        let viewPath = view;
        let ext = path.extname(view);

        if (!ext) {
          ext = this.settings['view engine'];
          if (!ext) {
            ext = '.html';
            viewPath = view + ext;
          } else {
            if (!ext.startsWith('.')) ext = '.' + ext;
            viewPath = view + ext;
          }
        }

        const viewsDir = this.settings.views || path.join(process.cwd(), 'views');
        let fullPath = path.join(viewsDir, viewPath);
        let fileExists = false;
        try {
          await fs.promises.access(fullPath);
          fileExists = true;
        } catch (err) {
          const extensions = ['.html', '.ejs', '.pug', '.hbs'];
          for (const tryExt of extensions) {
            if (tryExt === ext) continue;
            const tryPath = fullPath.replace(new RegExp(ext.replace('.', '\\.') + '$'), tryExt);
            try {
              await fs.promises.access(tryPath);
              fullPath = tryPath;
              ext = tryExt;
              fileExists = true;
              break;
            } catch (err2) { }
          }
        }

        if (!fileExists) {
          const error = new Error(
            `View "${view}" not found in views directory "${viewsDir}".\n` +
            `Tried: ${fullPath}`
          );
          error.code = 'ENOENT';
          if (callback) return callback(error);
          throw error;
        }

        const renderEngine = this.engines[ext];

        if (!renderEngine) {
          throw new Error(
            `No engine registered for extension "${ext}".\n` +
            `Use app.engine("${ext}", renderFunction) to register one.`
          );
        }

        return new Promise((resolve, reject) => {
          renderEngine(fullPath, locals, (err, html) => {
            if (err) {
              if (callback) {
                callback(err);
                resolve();
              } else {
                reject(err);
              }
              return;
            }

            if (callback) {
              callback(null, html);
              resolve();
            } else {
              res.html(html);
              resolve();
            }
          });
        });

      } catch (error) {
        if (callback) {
          callback(error);
        } else {
          throw error;
        }
      }
    };

    res.json = (data) => {
      if (responseSent) return res;

      const json = JSON.stringify(data);
      const length = Buffer.byteLength(json);

      res.writeHead(statusCode || 200, buildHeaders('application/json; charset=utf-8', length));

      responseSent = true;
      return res.end(json);
    };

    res.send = (data) => {
      if (responseSent) return res;

      let body, contentType;

      if (data === null) {
        body = 'null';
        contentType = 'application/json; charset=utf-8';
      } else if (typeof data === 'object') {
        body = JSON.stringify(data);
        contentType = 'application/json; charset=utf-8';
      } else if (typeof data === 'string') {
        body = data;
        contentType = 'text/plain; charset=utf-8';
      } else {
        body = String(data);
        contentType = 'text/plain; charset=utf-8';
      }

      const length = Buffer.byteLength(body);

      res.writeHead(statusCode || 200, buildHeaders(contentType, length));

      responseSent = true;
      return res.end(body);
    };

    res.html = function (html, status) {
      res.statusCode = status !== undefined ? status : (statusCode || 200);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    };

    res.ok = (data, message) => {
      if (!res.statusCode || res.statusCode === 200) {
        res.status(200);
      }
      const payload = { success: true, data };
      if (message !== undefined) payload.message = message;
      return res.json(payload);
    };
    res.success = res.ok;

    res.created = (data, message = 'Resource created successfully') => {
      const payload = { success: true, data, message };
      return res.status(201).json(payload);
    };

    res.noContent = () => {
      return res.status(204).end();
    };

    res.accepted = (data = null, message = 'Request accepted') => {
      return res.status(202).json({ success: true, message, data });
    };

    res.paginated = (items, total, message = 'Data retrieved successfully') => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
      const totalPages = Math.ceil(total / limit);

      return res.status(200).json({
        success: true,
        data: items,
        message,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    };

    res.redirect = (url, status = 302) => {
      responseSent = true;
      res.writeHead(status, { Location: url });
      res.end();
    };

    res.error = (obj) => this.error(res, obj);
    res.fail = res.error;

    res.badRequest = function (msg = "BAD_REQUEST") {
      return res.status(400).error(msg);
    };

    res.unauthorized = function (msg = "UNAUTHORIZED") {
      return res.status(401).error(msg);
    };

    res.forbidden = function (msg = "FORBIDDEN") {
      return res.status(403).error(msg);
    };

    res.notFound = function (msg = "NOT_FOUND") {
      return res.status(404).error(msg);
    };

    res.serverError = function (msg = "SERVER_ERROR") {
      return res.status(500).error(msg);
    };

    const originalEnd = res.end.bind(res);

    res.end = (...args) => {
      const result = originalEnd(...args);

      if (this.settings.debug && req._startTime) {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - req._startTime) / 1_000_000;

        this._debugLog(req, res, {
          time: durationMs
        });
      }

      return result;
    };
  }

  _defaultHtmlEngine(filePath, locals, callback) {
    fs.readFile(filePath, 'utf-8', (err, content) => {
      if (err) return callback(err);

      let rendered = content;

      Object.keys(locals).forEach(key => {
        if (locals[key] !== undefined && locals[key] !== null) {
          const safeRegex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          const unsafeRegex = new RegExp(`{{{\\s*${key}\\s*}}}`, 'g');

          if (safeRegex.test(rendered)) {
            const escaped = this._escapeHtml(String(locals[key]));
            rendered = rendered.replace(safeRegex, escaped);
          }

          if (unsafeRegex.test(rendered)) {
            rendered = rendered.replace(unsafeRegex, String(locals[key]));
          }
        }
      });

      callback(null, rendered);
    });
  }

  _escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async _runMiddleware(handler, req, res) {
    return new Promise((resolve, reject) => {
      const next = (err) => err ? reject(err) : resolve();
      const result = handler(req, res, next);
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      }
    });
  }

  _debugLog(req, res, meta) {
    if (!this.settings.debug) return;

    let timeFormatted;
    const timeMs = meta.time;

    if (timeMs < 1) {
      const us = (timeMs * 1000).toFixed(1);
      timeFormatted = `${us}µs`;
    } else if (timeMs >= 1000) {
      const s = (timeMs / 1000).toFixed(3);
      timeFormatted = `${s}s`;
    } else {
      timeFormatted = `${timeMs.toFixed(3)}ms`;
    }

    const color = (code) =>
      code >= 500 ? '\x1b[31m' :
        code >= 400 ? '\x1b[33m' :
          code >= 300 ? '\x1b[36m' :
            '\x1b[32m';

    const bodySize = req._bodySize || 0;
    let bodySizeFormatted;

    if (bodySize === 0) {
      bodySizeFormatted = '0 bytes';
    } else if (bodySize < 1024) {
      bodySizeFormatted = `${bodySize} bytes`;
    } else if (bodySize < 1024 * 1024) {
      bodySizeFormatted = `${(bodySize / 1024).toFixed(2)} KB`;
    } else if (bodySize < 1024 * 1024 * 1024) {
      bodySizeFormatted = `${(bodySize / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      bodySizeFormatted = `${(bodySize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    const logLines = [
      '[DEBUG REQUEST]',
      `→ ${req.method} ${req.originalUrl}`,
      `→ IP: ${req.ip.ipv4 || '127.0.0.1'}`,
      `→ Status: ${color(res.statusCode)}${res.statusCode}\x1b[0m`,
      `→ Duration: ${timeFormatted}`,
    ];

    if (req.params && Object.keys(req.params).length > 0) {
      logLines.push(`→ Params: ${JSON.stringify(req.params)}`);
    }

    if (req.query && Object.keys(req.query).length > 0) {
      logLines.push(`→ Query: ${JSON.stringify(req.query)}`);
    }

    if (req.body && Object.keys(req.body).length > 0) {
      const bodyStr = JSON.stringify(req.body);
      const truncated = bodyStr.substring(0, 200) + (bodyStr.length > 200 ? '...' : '');
      logLines.push(`→ Body: ${truncated}`);
      logLines.push(`→ Body Size: ${bodySizeFormatted}`);
    }

    if (req.files && Object.keys(req.files).length > 0) {
      logLines.push(`→ Files: ${Object.keys(req.files).join(', ')}`);
    }

    logLines.push('---------------------------------------------');
    console.log('\n' + logLines.join('\n') + '\n');
  }

  listRoutes() {
    const routeEntries = [];

    this.routes.forEach(route => {
      const existing = routeEntries.find(
        entry => entry.method === route.method &&
          entry.handler === route.handler
      );

      if (existing) {
        if (!Array.isArray(existing.path)) {
          existing.path = [existing.path];
        }
        existing.path.push(route.path);
      } else {
        routeEntries.push({
          method: route.method,
          path: route.path,
          middlewares: route.middlewares.length,
          handler: route.handler
        });
      }
    });

    return routeEntries.map(entry => ({
      method: entry.method,
      path: entry.path,
      middlewares: entry.middlewares
    }));
  }

  printRoutes() {
    if (this.routes.length === 0) {
      console.log('\nNo routes registered.\n');
      return;
    }

    console.log(`\nRegistered Routes: ${this.routes.length}\n`);

    const grouped = new Map();

    for (const route of this.routes) {
      const key = `${route.method}|${route.handler}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          method: route.method,
          paths: [],
          mw: route.middlewares.length
        });
      }
      const entry = grouped.get(key);
      const p = route.path || '/';
      if (!entry.paths.includes(p)) {
        entry.paths.push(p);
      }
    }

    const sorted = Array.from(grouped.values()).sort((a, b) => {
      if (a.method !== b.method) return a.method.localeCompare(b.method);
      return a.paths[0].localeCompare(b.paths[0]);
    });

    for (const r of sorted) {
      const pathStr = r.paths.length === 1
        ? r.paths[0]
        : r.paths.join(', ');

      console.log(` \x1b[36m${r.method.padEnd(7)}\x1b[0m \x1b[33m${pathStr}\x1b[0m \x1b[90m(mw: ${r.mw})\x1b[0m`);
    }
  }

  listen() {
    const args = Array.from(arguments);
    const server = createServer(this._handleRequest.bind(this));
    server.listen.apply(server, args);
    this.server = server;
    return server;
  }
}

function Lieko() {
  return new LiekoExpress();
}

function Router() {
  return new Lieko();
}

module.exports = Lieko;
module.exports.Router = Router;

module.exports.Schema = Schema;
module.exports.createSchema = (...args) => new Schema(...args);
module.exports.validators = validators;
module.exports.validate = validate;
module.exports.validatePartial = validatePartial;
module.exports.ValidationError = ValidationError;
