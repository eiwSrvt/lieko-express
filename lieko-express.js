const { createServer } = require('http');
const net = require("net");

process.env.UV_THREADPOOL_SIZE = require('os').availableParallelism();

class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

class Schema {
  constructor(rules) {
    this.rules = rules;
    this.fields = rules;
  }

  validate(data) {
    const errors = [];
    for (const [field, validators] of Object.entries(this.rules)) {
      const value = data[field];
      for (const validator of validators) {
        const error = validator(value, field, data);
        if (error) {
          errors.push(error);
          break;
        }
      }
    }
    if (errors.length > 0) throw new ValidationError(errors);
    return true;
  }
}

const validators = {
  required: (message = 'Field is required') => {
    return (value, field) => {
      if (value === undefined || value === null || value === '') {
        return { field, message, type: 'required' };
      }
      return null;
    };
  },

  requiredTrue: (message = 'Field must be true') => {
    return (value, field) => {
      const normalized = value === true || value === 'true' || value === '1' || value === 1;
      if (!normalized) {
        return { field, message, type: 'requiredTrue' };
      }
      return null;
    }
  },

  optional: () => {
    return () => null;
  },

  string: (message = 'Field must be a string') => {
    return (value, field) => {
      if (value !== undefined && typeof value !== 'string') {
        return { field, message, type: 'string' };
      }
      return null;
    };
  },

  number: (message = 'Field must be a number') => {
    return (value, field) => {
      if (value !== undefined && typeof value !== 'number') {
        return { field, message, type: 'number' };
      }
      return null;
    };
  },

  boolean: (message = 'Field must be a boolean') => {
    return (value, field) => {
      if (value === undefined || value === null || value === '') return null;

      const validTrue = ['true', true, 1, '1'];
      const validFalse = ['false', false, 0, '0'];

      const isValid = validTrue.includes(value) || validFalse.includes(value);

      if (!isValid) {
        return { field, message, type: 'boolean' };
      }

      return null;
    };
  },

  integer: (message = 'Field must be an integer') => {
    return (value, field) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return { field, message, type: 'integer' };
      }
      return null;
    };
  },

  positive: (message = 'Field must be positive') => {
    return (value, field) => {
      if (value !== undefined && value <= 0) {
        return { field, message, type: 'positive' };
      }
      return null;
    };
  },

  negative: (message = 'Field must be negative') => {
    return (value, field) => {
      if (value !== undefined && value >= 0) {
        return { field, message, type: 'negative' };
      }
      return null;
    };
  },

  email: (message = 'Invalid email format') => {
    return (value, field) => {
      if (value !== undefined && value !== null) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return { field, message, type: 'email' };
        }
      }
      return null;
    };
  },

  min: (minValue, message) => {
    return (value, field) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && value.length < minValue) {
          return {
            field,
            message: message || `Field must be at least ${minValue} characters`,
            type: 'min'
          };
        }
        if (typeof value === 'number' && value < minValue) {
          return {
            field,
            message: message || `Field must be at least ${minValue}`,
            type: 'min'
          };
        }
      }
      return null;
    };
  },

  max: (maxValue, message) => {
    return (value, field) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && value.length > maxValue) {
          return {
            field,
            message: message || `Field must be at most ${maxValue} characters`,
            type: 'max'
          };
        }
        if (typeof value === 'number' && value > maxValue) {
          return {
            field,
            message: message || `Field must be at most ${maxValue}`,
            type: 'max'
          };
        }
      }
      return null;
    };
  },

  length: (n, message) => {
    return (value, field) => {
      if (typeof value === 'string' && value.length !== n) {
        return {
          field,
          message: message || `Field must be exactly ${n} characters`,
          type: 'length'
        };
      }
      return null;
    };
  },

  minLength: (minLength, message) => {
    return (value, field) => {
      if (value !== undefined && value !== null && typeof value === 'string') {
        if (value.length < minLength) {
          return {
            field,
            message: message || `Field must be at least ${minLength} characters`,
            type: 'minLength'
          };
        }
      }
      return null;
    };
  },

  maxLength: (maxLength, message) => {
    return (value, field) => {
      if (value !== undefined && value !== null && typeof value === 'string') {
        if (value.length > maxLength) {
          return {
            field,
            message: message || `Field must be at most ${maxLength} characters`,
            type: 'maxLength'
          };
        }
      }
      return null;
    };
  },

  pattern: (regex, message = 'Invalid format') => {
    return (value, field) => {
      if (value !== undefined && value !== null && typeof value === 'string') {
        if (!regex.test(value)) {
          return { field, message, type: 'pattern' };
        }
      }
      return null;
    };
  },

  oneOf: (allowedValues, message) => {
    return (value, field) => {
      if (value !== undefined && value !== null) {
        if (!allowedValues.includes(value)) {
          return {
            field,
            message: message || `Field must be one of: ${allowedValues.join(', ')}`,
            type: 'oneOf'
          };
        }
      }
      return null;
    };
  },

  notOneOf: (values, message) => {
    return (value, field) => {
      if (values.includes(value)) {
        return {
          field,
          message: message || `Field cannot be one of: ${values.join(', ')}`,
          type: 'notOneOf'
        };
      }
      return null;
    };
  },

  custom: (validatorFn, message = 'Validation failed') => {
    return (value, field, data) => {
      const isValid = validatorFn(value, data);
      if (!isValid) {
        return { field, message, type: 'custom' };
      }
      return null;
    };
  },

  equal: (expectedValue, message) => {
    return (value, field) => {
      if (value !== expectedValue) {
        return {
          field,
          message: message || `Field must be equal to ${expectedValue}`,
          type: 'equal'
        };
      }
      return null;
    };
  },

  mustBeTrue: (message = 'This field must be accepted') => {
    return (value, field) => {
      const normalized = value === true || value === 'true' || value === '1' || value === 1;
      if (!normalized) {
        return { field, message, type: 'mustBeTrue' };
      }
      return null;
    };
  },

  mustBeFalse: (message = 'This field must be declined') => {
    return (value, field) => {
      const normalized = value === false || value === 'false' || value === '0' || value === 0;
      if (!normalized) {
        return { field, message, type: 'mustBeFalse' };
      }
      return null;
    };
  },

  date: (message = 'Invalid date') => {
    return (value, field) => {
      if (!value) return null;
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return { field, message, type: 'date' };
      }
      return null;
    };
  },

  before: (limit, message) => {
    return (value, field) => {
      if (!value) return null;
      const d1 = new Date(value);
      const d2 = new Date(limit);
      if (isNaN(d1) || d1 >= d2) {
        return {
          field,
          message: message || `Date must be before ${limit}`,
          type: 'before'
        };
      }
      return null;
    };
  },

  after: (limit, message) => {
    return (value, field) => {
      if (!value) return null;
      const d1 = new Date(value);
      const d2 = new Date(limit);
      if (isNaN(d1) || d1 <= d2) {
        return {
          field,
          message: message || `Date must be after ${limit}`,
          type: 'after'
        };
      }
      return null;
    };
  },

  startsWith: (prefix, message) => {
    return (value, field) => {
      if (typeof value === 'string' && !value.startsWith(prefix)) {
        return {
          field,
          message: message || `Field must start with "${prefix}"`,
          type: 'startsWith'
        };
      }
      return null;
    };
  },

  endsWith: (suffix, message) => {
    return (value, field) => {
      if (typeof value === 'string' && !value.endsWith(suffix)) {
        return {
          field,
          message: message || `Field must end with "${suffix}"`,
          type: 'endsWith'
        };
      }
      return null;
    };
  }
};

function validate(schema) {
  return (req, res, next) => {
    try {
      schema.validate(req.body);
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors
        });
      }
      throw error;
    }
  };
}

function validatePartial(schema) {
  const partial = {};

  for (const field in schema.fields) {
    const rules = schema.fields[field];

    const filtered = rules.filter(v =>
      v.name !== 'required' &&
      v.name !== 'requiredTrue' &&
      v.name !== 'mustBeTrue'
    );
    partial[field] = [validators.optional(), ...filtered];
  }

  return new Schema(partial);
}

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
      allowTrailingSlash: false,
    };

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
  }

  cors(options = {}) {
    this.corsOptions = {
      ...this.corsOptions,
      enabled: true,
      ...options
    };
  }

  _matchOrigin(origin, allowedOrigin) {
    if (!origin || !allowedOrigin) return false;

    if (Array.isArray(allowedOrigin)) {
      return allowedOrigin.some(o => this._matchOrigin(origin, o));
    }

    if (allowedOrigin === "*") return true;

    // Wildcard https://*.example.com
    if (allowedOrigin.includes("*")) {
      const regex = new RegExp("^" + allowedOrigin
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*") + "$");

      return regex.test(origin);
    }

    return origin === allowedOrigin;
  }

  _applyCors(req, res, opts) {
    if (!opts || !opts.enabled) return;

    const requestOrigin = req.headers.origin || "";

    let finalOrigin = "*";

    if (opts.strictOrigin && requestOrigin) {
      const allowed = this._matchOrigin(requestOrigin, opts.origin);

      if (!allowed) {
        res.statusCode = 403;
        return res.end(JSON.stringify({
          success: false,
          error: "Origin Forbidden",
          message: `Origin "${requestOrigin}" is not allowed`
        }));
      }
    }

    if (opts.origin === "*") {
      finalOrigin = "*";
    } else if (Array.isArray(opts.origin)) {
      const match = opts.origin.find(o => this._matchOrigin(requestOrigin, o));
      finalOrigin = match || opts.origin[0];
    } else {
      finalOrigin = this._matchOrigin(requestOrigin, opts.origin)
        ? requestOrigin
        : opts.origin;
    }

    this._logCorsDebug(req, {
      ...opts,
      origin: finalOrigin
    });

    res.setHeader("Access-Control-Allow-Origin", finalOrigin);

    if (opts.credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    if (opts.exposedHeaders?.length) {
      res.setHeader("Access-Control-Expose-Headers",
        opts.exposedHeaders.join(", "));
    }

    // Chrome Private Network Access
    if (
      opts.allowPrivateNetwork &&
      req.headers["access-control-request-private-network"] === "true"
    ) {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }

    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", opts.methods.join(", "));
      res.setHeader("Access-Control-Allow-Headers", opts.headers.join(", "));
      res.setHeader("Access-Control-Max-Age", opts.maxAge);

      res.statusCode = 204;
      return res.end();
    }
  }

  set(name, value) {
    this.settings[name] = value;
    return this;
  }

  get(name) {
    return this.settings[name];
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
    if (!match) return 1048576; // 1mb par défaut

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

  get(path, ...handlers) {
    this._addRoute('GET', path, ...handlers);
    return this;
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
      console.warn(`
      ⚠️  WARNING: Middleware executed without a 'next' parameter.
        This middleware may block the request pipeline.

        Offending middleware:
        ${handler.toString().split('\n')[0].substring(0, 120)}...

        Fix: Add 'next' as third parameter and call it:
        (req, res, next) => { /* your code */ next(); }
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

  _mountRouter(basePath, router) {
    basePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    router.groupStack = [...this.groupStack];

    router.routes.forEach(route => {
      const fullPath = route.path === '/' ? basePath : basePath + route.path;

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
  }

  _addRoute(method, path, ...handlers) {
    if (handlers.length === 0) {
      throw new Error('Route handler is required');
    }

    const finalHandler = handlers[handlers.length - 1];
    const routeMiddlewares = handlers.slice(0, -1);

    routeMiddlewares.forEach(mw => {
      if (typeof mw === 'function') {
        this._checkMiddleware(mw);
      }
    });

    this.routes.push({
      method,
      path,
      handler: finalHandler,
      middlewares: routeMiddlewares,
      pattern: this._pathToRegex(path),
      groupChain: [...this.groupStack]
    });
  }

  _pathToRegex(path) {
    let pattern = path
      .replace(/:(\w+)/g, '(?<$1>[^/]+)')  // params :id
      .replace(/\*/g, '.*');               // wildcards

    const allowTrailing = this.settings.allowTrailingSlash === true ||
      this.settings.strictTrailingSlash === false;

    const isStaticRoute = !pattern.includes('(') &&
      !pattern.includes('*') &&
      !path.endsWith('/');

    if (allowTrailing && isStaticRoute) {
      pattern += '/?';
    }

    return new RegExp(`^${pattern}$`);
  }

  _findRoute(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method && route.method !== 'ALL') continue;
      const match = pathname.match(route.pattern);
      if (match) {
        return { ...route, params: match.groups || {} };
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

    let ip = rawIp;

    // Remove IPv6 IPv4-mapped prefix "::ffff:"
    if (ip.startsWith("::ffff:")) {
      ip = ip.replace("::ffff:", "");
    }

    const family = net.isIP(ip); // 0=invalid, 4=IPv4, 6=IPv6

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

    try {

      if (req.method === "OPTIONS" && this.corsOptions.enabled) {
        this._applyCors(req, res, this.corsOptions);
        return;
      }

      const route = this._findRoute(req.method, pathname);

      if (route) {

        if (route.cors === false) { }

        else if (route.cors) {
          const finalCors = {
            ...this.corsOptions,
            enabled: true,
            ...route.cors
          };

          this._applyCors(req, res, finalCors);
          if (req.method === "OPTIONS") return;
        }

        else if (this.corsOptions.enabled) {
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

        if (mw.path && !pathname.startsWith(mw.path)) continue;

        await new Promise((resolve, reject) => {
          const next = async (err) => {
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
    const remoteIp = req.connection.remoteAddress || '';

    req.ips = [remoteIp];
    let clientIp = remoteIp;

    const forwardedFor = req.headers['x-forwarded-for'];

    if (forwardedFor) {
      const proxyChain = forwardedFor.split(',').map(ip => ip.trim());

      if (this._isTrustedProxy(remoteIp)) {
        clientIp = proxyChain[0];
        req.ips = proxyChain;
      }
    }

    req.ip = this._parseIp(clientIp);

    req.protocol = req.headers['x-forwarded-proto'] || 'http';
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
  }

  _enhanceResponse(req, res) {
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
    res.setHeader = (name, value) => {
      originalSetHeader(name, value);
      return res;
    };
    res.set = res.setHeader;
    res.header = res.setHeader;

    res.removeHeader = function (name) {
      res.removeHeader(name);
      return res;
    };

    res.type = function (mime) {
      res.setHeader("Content-Type", mime);
      return res;
    };

    res.json = (data) => {
      if (responseSent) return res;

      const json = JSON.stringify(data);
      const length = Buffer.byteLength(json);

      res.writeHead(statusCode, buildHeaders('application/json; charset=utf-8', length));

      responseSent = true;
      statusCode = 200;
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

      res.writeHead(statusCode, buildHeaders(contentType, length));

      responseSent = true;
      statusCode = 200;
      return res.end(body);
    };

    res.html = function (html, status = 200) {
      res.statusCode = status;
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

    console.log(
      `\n🟦 DEBUG REQUEST` +
      `\n→ ${req.method} ${req.originalUrl}` +
      `\n→ IP: ${req.ip.ipv4}` +
      `\n→ Status: ${color(res.statusCode)}${res.statusCode}\x1b[0m` +
      `\n→ Duration: ${timeFormatted}` +
      `\n→ Body Size: ${bodySizeFormatted}` +
      `\n→ Params: ${JSON.stringify(req.params || {})}` +
      `\n→ Query: ${JSON.stringify(req.query || {})}` +
      `\n→ Body: ${JSON.stringify(req.body || {}).substring(0, 200)}${JSON.stringify(req.body || {}).length > 200 ? '...' : ''}` +
      `\n→ Files: ${Object.keys(req.files || {}).join(', ')}` +
      `\n---------------------------------------------\n`
    );
  }

  _logCorsDebug(req, opts) {
    if (!opts.debug) return;

    console.log("\n[CORS DEBUG]");
    console.log("Request:", req.method, req.url);
    console.log("Origin:", req.headers.origin || "none");

    console.log("Applied CORS Policy:");
    console.log("  - Access-Control-Allow-Origin:", opts.origin);
    console.log("  - Access-Control-Allow-Methods:", opts.methods.join(", "));
    console.log("  - Access-Control-Allow-Headers:", opts.headers.join(", "));

    if (opts.credentials) {
      console.log("  - Access-Control-Allow-Credentials: true");
    }

    if (opts.exposedHeaders?.length) {
      console.log("  - Access-Control-Expose-Headers:", opts.exposedHeaders.join(", "));
    }

    console.log("  - Max-Age:", opts.maxAge);

    if (req.method === "OPTIONS") {
      console.log("Preflight request handled with status 204\n");
    }
  }

  _buildRouteTree() {
    const tree = {};

    for (const route of this.routes) {
      let node = tree;

      for (const group of route.groupChain) {
        const key = group.basePath;

        if (!node[key]) {
          node[key] = {
            __meta: group,
            __children: {},
            __routes: []
          };
        }

        node = node[key].__children;
      }

      if (!node.__routes) node.__routes = [];
      node.__routes.push(route);
    }

    return tree;
  }

  listRoutes() {
    return this.routes.map(route => ({
      method: route.method,
      path: route.path,
      middlewares: route.middlewares.length
    }));
  }

  printRoutes() {
    console.log('\n📌 Registered Routes:\n');

    this.routes.forEach(r => {
      console.log(
        `${r.method.padEnd(6)}  ${r.path}  ` +
        `(mw: ${r.middlewares.length})`
      );
    });

    console.log('');
  }

  printRoutesNested(tree = null, indent = '') {
    if (!tree) {
      console.log('\n📌 Nested Routes:\n');
      tree = this._buildRouteTree();
    }

    const prefix = indent + '  ';

    for (const [path, data] of Object.entries(tree)) {
      if (path.startsWith("__")) continue;

      const mwCount = data.__meta.middlewares.length;
      console.log(`${indent}${path}   [${mwCount} mw]`);

      if (data.__routes && data.__routes.length) {
        for (const route of data.__routes) {
          const shortPath = route.path.replace(path, '') || '/';
          console.log(`${prefix}${route.method.padEnd(6)} ${shortPath}`);
        }
      }
      this.printRoutesNested(data.__children, prefix);
    }

    if (tree.__routes) {
      for (const route of tree.__routes) {
        console.log(`${indent}${route.method.padEnd(6)} ${route.path}`);
      }
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
module.exports.schema = (...args) => new Schema(...args);
module.exports.validators = validators;
module.exports.validate = validate;
module.exports.validatePartial = validatePartial;
module.exports.ValidationError = ValidationError;
