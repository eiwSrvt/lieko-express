# **Lieko-express — A Modern, Minimal, REST API Framework for Node.js**

A lightweight, fast, and modern Node.js REST API framework built on top of the native `http` module. Zero external dependencies for core functionality.

![Performance](https://img.shields.io/badge/Performance-49%25_faster_than_Express-00d26a?style=for-the-badge)

![Latency](https://img.shields.io/badge/Latency-67%25_lower_than_Express-00b4d8?style=for-the-badge)

![Requests/sec](https://img.shields.io/badge/Requests-16.6k/sec-ff6b6b?style=for-the-badge)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org)
[![npm version](https://img.shields.io/npm/v/lieko-express.svg)](https://www.npmjs.com/package/lieko-express)

[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?logo=github)](https://github.com/eiwSrvt/lieko-express)
[![Discord](https://img.shields.io/discord/1399525160050102414?color=5865F2&logo=discord&logoColor=white)](https://discord.gg/EpgPqjvd)



| Metric | Express.js | Lieko Express | Improvement |
|--------|------------|---------------|-------------|
| **Max Throughput** | 13,303 req/sec | **16,644 req/sec** | **+25.1%** |
| **Best Case (POST)** | 11,202 req/sec | **16,644 req/sec** | **+48.6%** |
| **Worst Case (GET)** | 13,303 req/sec | **16,152 req/sec** | **+21.4%** |
| **Average Latency** | 30µs | **10µs** | **-66.7%** |
| **Total Requests** | 336k (POST) | **499k (POST)** | **+48.5%** |

**Key Takeaways:**
- ✅ **Up to 49% higher throughput** than Express.js
- ✅ **67% lower latency** (10µs vs 30µs)
- ✅ **Consistently outperforms** Express in all tests

## ✨ Features

- 🎯 **Zero Dependencies** - Built entirely on Node.js native modules
- ⚡ **High Performance** - Optimized for speed with minimal overhead
- 🛡️ **Built-in Validation** - Comprehensive validation system with 15+ validators
- 🔄 **Router Support** - Modular routing with nested routers
- 🔐 **Middleware System** - Global and route-specific middlewares
- 📝 **Body Parsing** - JSON, URL-encoded, and multipart/form-data support
- 🎨 **Response Helpers** - Convenient methods for common responses
- 🔍 **Route Parameters** - Dynamic route matching with named parameters
- 🌐 **Query Parsing** - Automatic type conversion for query parameters
- 📤 **File Upload** - Built-in multipart/form-data handling
- ⚠️ **Error Handling** - Structured error responses with status codes


## 📚 Table of Contents

- [Philosophy](#philosophy)
- [Basic Usage](#basic-usage)
- [Routing](#routing)
- [Middlewares](#middlewares)
- [Request & Response](#request--response)
- [Validation](#validation)
- [Routers](#routers)
- [Error Handling](#error-handling)
- [Advanced Examples](#advanced-examples)

---

# 🧠 Philosophy

Lieko attempts to solve several common issues with classic Node frameworks:

### ❌ Express problems:

* No route grouping
* Weak middlewares
* No validation
* Messy routers
* Confusing trust proxy behavior
* No helpers

### ✔ Lieko solutions:

* Clean **group-based routing**
* Built-in validators
* Typed & normalized request fields
* Robust error system
* First-class JSON & uploads
* Simple, powerful helpers (res.ok, res.error…)
* Predictable IP handling

Lieko feels familiar but is dramatically more coherent and modern.



## 📦 Installation

```bash
npm install lieko-express
```

## 🚀 Quick Start

```javascript
const Lieko = require('lieko-express');

const app = Lieko();

app.get('/', (req, res) => {
  res.json({ message: 'Hello, Lieko!' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 🎯 Basic Usage

### Creating an Application

```javascript
const Lieko = require('lieko-express');
const app = Lieko();
```

### HTTP Methods

```javascript
// GET request
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// POST request
app.post('/users', (req, res) => {
  const user = req.body;
  res.status(201).json({ user });
});

// PUT request
app.put('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ updated: true, id });
});

// DELETE request
app.delete('/users/:id', (req, res) => {
  res.json({ deleted: true });
});

// PATCH request
app.patch('/users/:id', (req, res) => {
  res.json({ patched: true });
});

// ALL methods
app.all('/admin', (req, res) => {
  res.json({ method: req.method });
});
```


# 🛣 Routing

Lieko provides classic `.get()`, `.post()`, `.patch()`, `.delete()`:

```js
app.get('/hello', (req, res) => res.ok('Hello!'));
app.post('/upload', uploadFile);
app.patch('/users/:id', updateUser);
app.delete('/posts/:id', deletePost);
```

### Features

✔ Params automatically extracted

✔ Query auto-typed

✔ Body parsed and typed

✔ Wildcards available

✔ Trailing slashes handled intelligently

---

# 🧩 Route Groups

Lieko supports Laravel-style **group routing** with middleware inheritance:

```js
// (api) = name of subroutes
app.group('/api', auth, (api) => {

  api.get('/profile', (req, res) =>
    res.ok({ user: req.user })
  );

  api.group('/admin', requireAdmin, (admin) => {

    admin.get('/stats', (req, res) =>
      res.ok({ admin: true })
    );

  });

});
```

### Group behavior

* Middlewares inherited by all children
* Prefix applied recursively
* You can nest indefinitely
* Works inside routers too



# 📦 Nested Routers

Routers are fully nestable:

```js
const { Router } = require('lieko-express');

const app = Router();

app.get('/', listUsers);
app.post('/', createUser);
app.get('/:id', getUser);

app.group('/api', auth, (api) => {
  api.group('/admin', requireAdmin, (admin) => {
    admin.use('/users', users);
  });
});

// Group without TOP middleware
app.group('/api', (api) => {
  api.group('/admin', requireAdmin, (admin) => {
    admin.use('/users', users);
  });
});

app.group('/admin2', auth, requireAdmin, rateLimit, (admin) => {
  admin.get('/stats', getStats);
});

api.group(
  '/secure',
  requireAuth(config),
  requirePermissions(['users.read', 'posts.write']),
  requireAdmin('super'),
  (secure) => {
    secure.get('/panel', ...);
  }
);
```
✔ Router inherits middleware from its parent groups

✔ Paths automatically expanded

✔ Perfect for modular architecture


# 🧩 API Versioning

With groups, versioning becomes trivial:

```js
app.group('/api/v1', (v1) => {
  v1.get('/users', handlerV1);
});

app.group('/api/v2', (v2) => {
  v2.get('/users', handlerV2);
});
```


### Query Parameters

Query parameters are automatically parsed and converted to appropriate types:

```javascript
app.get('/search', (req, res) => {
  // GET /search?q=hello&page=2&active=true&price=19.99
  
  console.log(req.query);
  // {
  //   q: 'hello',        // string
  //   page: 2,           // number (auto-converted)
  //   active: true,      // boolean (auto-converted)
  //   price: 19.99       // float (auto-converted)
  // }
  
  res.json({ query: req.query });
});
```

**Automatic Type Conversion:**
- `"123"` → `123` (number)
- `"19.99"` → `19.99` (float)
- `"true"` → `true` (boolean)
- `"false"` → `false` (boolean)


## 🔧 Middlewares

### Global Middlewares

```javascript
// Logger middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// CORS middleware
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  next();
});

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.error({
      code: 'NO_TOKEN_PROVIDED',
      message: 'Authorization required'
    });
  }
  
  req.user = { id: 1, role: 'admin' };
  next();
};
```

### Path-Specific Middlewares

```javascript
// Apply to specific path
app.use('/api', (req, res, next) => {
  console.log('API route accessed');
  next();
});

// Multiple middlewares
app.use('/admin', authMiddleware, checkRole, (req, res, next) => {
  next();
});
```

### Route-Level Middlewares

```javascript
// Single middleware
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Multiple middlewares
app.post('/admin/users',
  authMiddleware,
  checkRole('admin'),
  validate(userSchema),
  (req, res) => {
    res.json({ created: true });
  }
);
```

### Async Middlewares

```javascript
// Async/await support
app.use(async (req, res, next) => {
  try {
    req.data = await fetchDataFromDB();
    next();
  } catch (error) {
    next(error);
  }
});
```


# 🔍 Request Object

Lieko’s `req` object provides:

### General

| Field             | Description       |
| ----------------- | ----------------- |
| `req.method`      | HTTP method       |
| `req.path`        | Without query     |
| `req.originalUrl` | Full original URL |
| `req.protocol`    | `http` or `https` |
| `req.secure`      | Boolean           |
| `req.hostname`    | Hostname          |
| `req.subdomains`  | Array             |
| `req.xhr`         | AJAX detection    |
| `req.params`      | Route parameters  |
| `req.query`       | Auto-typed query  |
| `req.body`        | Parsed body       |
| `req.files`       | Uploaded files    |

### IP Handling

| Field         | Description            |
| ------------- | ---------------------- |
| `req.ip.raw`  | Original IP            |
| `req.ip.ipv4` | IPv4 (auto normalized) |
| `req.ip.ipv6` | IPv6                   |
| `req.ips`     | Proxy chain            |

Lieko safely handles:

* IPv4
* IPv6
* IPv4-mapped IPv6
* Multiple proxies


# 🎯 Response Object (`res`)

Lieko enhances Node's native response object with convenient helper methods.

### **General Response Methods**

| Method / Field             | Description                              |
| -------------------------- | ---------------------------------------- |
| `res.status(code)`         | Sets HTTP status code (chainable).       |
| `res.setHeader(name, val)` | Sets a response header.                  |
| `res.getHeader(name)`      | Gets a response header.                  |
| `res.removeHeader(name)`   | Removes a header.                        |
| `res.type(mime)`           | Sets `Content-Type` automatically.       |
| `res.send(data)`           | Sends raw data (string, buffer, object). |
| `res.json(obj)`            | Sends JSON with correct headers.         |
| `res.end(body)`            | Ends the response manually.              |


# ✅ **High-Level Helpers**

### **Success Helpers**

| Method                   | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `res.ok(data)`           | Sends `{ success: true, data }` with status `200`. |
| `res.created(data)`      | Sends `{ success: true, data }` with status `201`. |
| `res.noContent()`        | Sends status `204` with no body.                   |
| `res.paginated(payload)` | Standard API pagination output.                    |


# ❌ **Error Helpers**

| Method                  | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `res.error(codeOrObj)`  | Sends a normalized JSON error response (400–500). |
| `res.badRequest(msg)`   | Sends `400 Bad Request`.                          |
| `res.unauthorized(msg)` | Sends `401 Unauthorized`.                         |
| `res.forbidden(msg)`    | Sends `403 Forbidden`.                            |
| `res.notFound(msg)`     | Sends `404 Not Found`.                            |
| `res.serverError(msg)`  | Sends `500 Server Error`.                         |

> All these helpers output a consistent JSON error structure:
>
> ```json
> { "success": false, "error": { "code": "...", "message": "..." } }
> ```

# 🧠 **Content-Type Helpers**

### **HTML**

| Method                        | Description                                                |
| ----------------------------- | ---------------------------------------------------------- |
| `res.html(html, status?)`     | Short alias for `sendHTML()`.                              |                        |

### **Redirects**

| Method                     | Description                           |
| -------------------------- | ------------------------------------- |
| `res.redirect(url, code?)` | Redirects the client (default `302`). |


# 📦 **Low-Level Output Controls**

| Method                             | Description                                     |
| ---------------------------------- | ----------------------------------------------- |
| `res.write(chunk)`                 | Writes a raw chunk without ending the response. |
| `res.flushHeaders()`               | Sends the headers immediately.                  |


### JSON helpers

```js
res.ok(data);
res.created(data);
res.accepted(data);
res.noContent();
res.error({ code: "INVALID_DATA" });
```

### Pagination helper

```js
res.paginated(items, page, limit, total);
```

### Response formatting

* Uniform JSON structure
* Automatic status codes
* Error code → HTTP mapping
* String errors also supported (`res.error("Invalid user")`)

# 📦 Body Parsing

Lieko supports:

### ✔ JSON

### ✔ URL-encoded

### ✔ Multipart form-data (files)

Uploads end up in:

```
req.files = {
  avatar: {
    filename: "...",
    mimetype: "...",
    size: 1234,
    buffer: <Buffer>
  }
}
```

Query & body fields are **auto converted**:

```
"123" → 123  
"true" → true  
"false" → false  
"null" → null  
```

### Response Methods

```javascript
// JSON response
res.json({ message: 'Hello' });

// Send any data
res.send('Plain text');
res.send({ object: 'data' });

// Status code
res.status(404).json({ error: 'Not found' });

// Set headers
res.set('X-Custom-Header', 'value');
res.header('Content-Type', 'text/html');

// Redirect
res.redirect('/new-url');

// Success response helper
res.ok({ user: userData }, 'User retrieved successfully');
// Returns: { success: true, data: userData, message: '...' }

// Error response helper
res.error({
  code: 'NOT_FOUND',
  message: 'Resource not found'
});
// Returns: { success: false, error: { code, message } }

// Response locals (shared data)
res.locals.user = currentUser;
```

### Body Parsing

**Automatic parsing for:**

1. **JSON** (`application/json`)
```javascript
app.post('/api/data', (req, res) => {
  console.log(req.body); // { name: 'John', age: 30 }
  res.json({ received: true });
});
```

2. **URL-encoded** (`application/x-www-form-urlencoded`)
```javascript
app.post('/form', (req, res) => {
  console.log(req.body); // { username: 'john', password: '***' }
  res.json({ ok: true });
});
```

3. **Multipart/form-data** (file uploads)
```javascript
app.post('/upload', (req, res) => {
  const file = req.files.avatar;
  
  console.log(file.filename);    // 'profile.jpg'
  console.log(file.contentType); // 'image/jpeg'
  console.log(file.data);        // Buffer
  console.log(file.data.length); // File size in bytes
  
  // Other form fields
  console.log(req.body.username); // 'john'
  
  res.json({ uploaded: true });
});
```

## ✅ Validation

### Built-in Validators

```javascript
const { schema, validators, validate } = require('lieko-express');

const userSchema = schema({
  // Required field
  username: [
    validators.required('Username is required'),
    validators.string(),
    validators.minLength(3),
    validators.maxLength(20),
    validators.pattern(/^[a-zA-Z0-9_]+$/, 'Alphanumeric only')
  ],
  
  // Email validation
  email: [
    validators.required(),
    validators.email('Invalid email format')
  ],
  
  // Number validation
  age: [
    validators.required(),
    validators.number(),
    validators.min(18, 'Must be 18 or older'),
    validators.max(120)
  ],
  
  // Boolean validation
  active: [
    validators.boolean()
  ],
  
  // Must be true (for terms acceptance)
  acceptTerms: [
    validators.required(),
    validators.mustBeTrue('You must accept terms')
  ],
  
  // Enum validation
  role: [
    validators.oneOf(['user', 'admin', 'moderator'])
  ],
  
  // Custom validator
  password: [
    validators.required(),
    validators.custom((value) => {
      return value.length >= 8 && /[A-Z]/.test(value);
    }, 'Password must be 8+ chars with uppercase')
  ],
  
  // Equal to another value
  confirmPassword: [
    validators.equal(req => req.body.password, 'Passwords must match')
  ]
});

// Use in route
app.post('/register', validate(userSchema), (req, res) => {
  // If validation passes, this runs
  res.status(201).json({ success: true });
});
```

### All Available Validators

| Validator                      | Description                                         | Example                                  |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------- |
| `required(message?)`           | Field must be present (not null/empty)              | `validators.required()`                  |
| `requiredTrue(message?)`       | Must be true (accepts `true`, `"true"`, `1`, `"1"`) | `validators.requiredTrue()`              |
| `optional()`                   | Skip validation if field is missing                 | `validators.optional()`                  |
| `string(message?)`             | Must be a string                                    | `validators.string()`                    |
| `number(message?)`             | Must be a number (no coercion)                      | `validators.number()`                    |
| `boolean(message?)`            | Must be boolean-like (`true/false`, `"1"/"0"`)      | `validators.boolean()`                   |
| `integer(message?)`            | Must be an integer                                  | `validators.integer()`                   |
| `positive(message?)`           | Must be > 0                                         | `validators.positive()`                  |
| `negative(message?)`           | Must be < 0                                         | `validators.negative()`                  |
| `email(message?)`              | Must be a valid email                               | `validators.email()`                     |
| `min(value, message?)`         | Minimum number or string length                     | `validators.min(3)`                      |
| `max(value, message?)`         | Maximum number or string length                     | `validators.max(10)`                     |
| `length(n, message?)`          | Exact string length                                 | `validators.length(6)`                   |
| `minLength(n, message?)`       | Minimum string length                               | `validators.minLength(3)`                |
| `maxLength(n, message?)`       | Maximum string length                               | `validators.maxLength(255)`              |
| `pattern(regex, message?)`     | Must match regex                                    | `validators.pattern(/^\d+$/)`            |
| `startsWith(prefix, message?)` | Must start with prefix                              | `validators.startsWith("abc")`           |
| `endsWith(suffix, message?)`   | Must end with suffix                                | `validators.endsWith(".jpg")`            |
| `oneOf(values, message?)`      | Value must be in list                               | `validators.oneOf(['admin','user'])`     |
| `notOneOf(values, message?)`   | Value cannot be in list                             | `validators.notOneOf(['root','system'])` |
| `custom(fn, message?)`         | Custom validation                                   | `validators.custom(val => val > 0)`      |
| `equal(value, message?)`       | Must equal specific value                           | `validators.equal("yes")`                |
| `mustBeTrue(message?)`         | Must be true (alias of requiredTrue)                | `validators.mustBeTrue()`                |
| `mustBeFalse(message?)`        | Must be false                                       | `validators.mustBeFalse()`               |
| `date(message?)`               | Must be valid date                                  | `validators.date()`                      |
| `before(date, message?)`       | Must be < given date                                | `validators.before("2025-01-01")`        |
| `after(date, message?)`        | Must be > given date                                | `validators.after("2020-01-01")`         |

## **Basic Schema Example**

```js
const userSchema = schema({
  name: [
    validators.required(),
    validators.string(),
    validators.minLength(3),
  ],
  age: [
    validators.required(),
    validators.number(),
    validators.min(18),
  ],
});
```

## **Boolean Example**

```js
const schema = schema({
  subscribed: [
    validators.boolean()
  ]
});
```

Accepted:

```
true, false, "true", "false", 1, 0, "1", "0"
```

## **Email Example**

```js
const schema = schema({
  email: [
    validators.required(),
    validators.email()
  ]
});
```

## **Username with rules**

```js
const usernameSchema = schema({
  username: [
    validators.required(),
    validators.string(),
    validators.minLength(3),
    validators.maxLength(16),
    validators.pattern(/^[a-zA-Z0-9_]+$/, "Invalid username")
  ]
});
```

## **Password strength**

```js
const passwordSchema = schema({
  password: [
    validators.required(),
    validators.minLength(8),
    validators.custom((value) => {
      return /[A-Z]/.test(value) &&
             /[a-z]/.test(value) &&
             /\d/.test(value) &&
             /[!@#$%^&*]/.test(value);
    }, "Weak password")
  ]
});
```

## **Multiple-choice fields**

```js
const roleSchema = schema({
  role: [
    validators.oneOf(["admin", "user", "guest"])
  ]
});
```


## **Blacklist Example**

```js
const schema = schema({
  username: [
    validators.notOneOf(["root", "admin", "system"])
  ]
});
```

## **Starts / Ends With**

```js
const schema = schema({
  fileName: [
    validators.endsWith(".jpg", "Must be a JPG image")
  ]
});
```

# **Advanced Validation Examples**



## **Cross-field validation (matching passwords)**

```js
const registerSchema = schema({
  password: [
    validators.required(),
    validators.minLength(8)
  ],
  confirmPassword: [
    validators.required(),
    validators.custom((value, data) => value === data.password, "Passwords do not match")
  ]
});
```


## Conditional Validation (depends on another field)

```js
const orderSchema = schema({
  shippingMethod: [validators.oneOf(["pickup", "delivery"])],
  address: [
    validators.custom((value, data) => {
      if (data.shippingMethod === "delivery")
        return value && value.length > 0;
      return true;
    }, "Address required when using delivery")
  ]
});
```


## Dynamic rules EX: `age` required only if user is not admin

```js
const schema = schema({
  role: [validators.oneOf(["user", "admin"])],
  age: [
    validators.custom((age, data) => {
      if (data.role === "user") return age >= 18;
      return true;
    }, "Users must be 18+")
  ]
});
```


## **Date validation**

```js
const eventSchema = schema({
  startDate: [validators.date()],
  endDate: [
    validators.date(),
    validators.custom((value, data) => {
      return new Date(value) > new Date(data.startDate);
    }, "End date must be after start date")
  ]
});
```


# **Combining many validators**

```js
const schema = schema({
  code: [
    validators.required(),
    validators.string(),
    validators.length(6),
    validators.pattern(/^[A-Z0-9]+$/),
    validators.notOneOf(["AAAAAA", "000000"]),
  ]
});
```


# **Optional field + rules if provided**

```js
const schema = schema({
  nickname: [
    validators.optional(),
    validators.minLength(3),
    validators.maxLength(20)
  ]
});
```

If nickname is empty → no validation.
If present → must follow rules.


# **Example of validation error response**

Already provided but I format it more "realistic":

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "type": "email"
    },
    {
      "field": "age",
      "message": "Field must be at least 18",
      "type": "min"
    }
  ]
}
```


### Custom Validation Examples

```javascript
// Password strength
const passwordSchema = schema({
  password: [
    validators.required(),
    validators.custom((value) => {
      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasNumbers = /\d/.test(value);
      const hasSpecialChar = /[!@#$%^&*]/.test(value);
      
      return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
    }, 'Password must contain uppercase, lowercase, number and special char')
  ]
});

// Cross-field validation
const registrationSchema = schema({
  password: [validators.required(), validators.minLength(8)],
  confirmPassword: [
    validators.required(),
    validators.custom((value, data) => {
      return value === data.password;
    }, 'Passwords do not match')
  ]
});

// Conditional validation
const orderSchema = schema({
  shippingAddress: [
    validators.custom((value, data) => {
      // Only required if shipping method is 'delivery'
      if (data.shippingMethod === 'delivery') {
        return value && value.length > 0;
      }
      return true;
    }, 'Shipping address required for delivery')
  ]
});
```


## 🗂️ Routers

Routers allow you to create modular, mountable route handlers.

### Creating a Router

```javascript
const Lieko = require('lieko-express');
const usersRouter = Lieko.Router();

// Define routes on the router
usersRouter.get('/', (req, res) => {
  res.json({ users: [] });
});

usersRouter.get('/:id', (req, res) => {
  res.json({ user: { id: req.params.id } });
});

usersRouter.post('/', (req, res) => {
  res.status(201).json({ created: true });
});

// Mount the router
const app = Lieko();
app.use('/api/users', usersRouter);

// Now accessible at:
// GET  /api/users
// GET  /api/users/:id
// POST /api/users
```

### Nested Routers

```javascript
const apiRouter = Lieko.Router();
const usersRouter = Lieko.Router();
const postsRouter = Lieko.Router();

// Users routes
usersRouter.get('/', (req, res) => res.json({ users: [] }));
usersRouter.get('/:id', (req, res) => res.json({ user: {} }));

// Posts routes
postsRouter.get('/', (req, res) => res.json({ posts: [] }));
postsRouter.get('/:id', (req, res) => res.json({ post: {} }));

// Mount sub-routers on API router
apiRouter.use('/users', usersRouter);
apiRouter.use('/posts', postsRouter);

// Mount API router on app
app.use('/api', apiRouter);

// Available routes:
// /api/users
// /api/users/:id
// /api/posts
// /api/posts/:id
```

### Router with Middlewares

```javascript
const adminRouter = Lieko.Router();

// Middleware for all admin routes
const adminAuth = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.error({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
};

adminRouter.get('/dashboard', (req, res) => {
  res.json({ dashboard: 'data' });
});

adminRouter.post('/settings', (req, res) => {
  res.json({ updated: true });
});

// Mount with middleware
app.use('/admin', authMiddleware, adminAuth, adminRouter);
```

### Modular Application Structure

```javascript
// routes/users.js
const Lieko = require('lieko-express');
const router = Lieko.Router();

router.get('/', (req, res) => { /* ... */ });
router.post('/', (req, res) => { /* ... */ });

module.exports = router;

// routes/posts.js
const Lieko = require('lieko-express');
const router = Lieko.Router();

router.get('/', (req, res) => { /* ... */ });
router.post('/', (req, res) => { /* ... */ });

module.exports = router;

// app.js
const Lieko = require('lieko-express');
const usersRouter = require('./routes/users');
const postsRouter = require('./routes/posts');

const app = Lieko();

app.use('/api/users', usersRouter);
app.use('/api/posts', postsRouter);

app.listen(3000);
```

## ⚠️ Error Handling

### Custom 404 Handler

```javascript
app.notFound((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} does not exist`,
    timestamp: new Date().toISOString()
  });
});
```

### Error Response Helper

```javascript
app.get('/users/:id', (req, res) => {
  const user = findUser(req.params.id);
  
  if (!user) {
    return res.error({
      code: 'NOT_FOUND',
      message: 'User not found'
    });
  }
  
  res.json({ user });
});
```

### Standard Error Codes

The `res.error()` helper automatically maps error codes to HTTP status codes:

```javascript
// 4xx - Client Errors
res.error({ code: 'INVALID_REQUEST' });        // 400
res.error({ code: 'VALIDATION_FAILED' });      // 400
res.error({ code: 'NO_TOKEN_PROVIDED' });      // 401
res.error({ code: 'INVALID_TOKEN' });          // 401
res.error({ code: 'FORBIDDEN' });              // 403
res.error({ code: 'NOT_FOUND' });              // 404
res.error({ code: 'METHOD_NOT_ALLOWED' });     // 405
res.error({ code: 'CONFLICT' });               // 409
res.error({ code: 'RECORD_EXISTS' });          // 409
res.error({ code: 'TOO_MANY_REQUESTS' });      // 429

// 5xx - Server Errors
res.error({ code: 'SERVER_ERROR' });           // 500
res.error({ code: 'SERVICE_UNAVAILABLE' });    // 503

// Custom status
res.error({ code: 'CUSTOM_ERROR', status: 418 });
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```


## 🔥 Advanced Examples

### Complete REST API

```javascript
const Lieko = require('lieko-express');
const { Schema, validators, validate } = require('lieko-express');

const app = Lieko();

// Database (in-memory)
const db = {
  users: [
    { id: 1, name: 'John Doe', email: 'john@example.com' }
  ]
};

let nextId = 2;

// Validation schema
const userSchema = schema({
  name: [
    validators.required('Name is required'),
    validators.minLength(2, 'Name must be at least 2 characters')
  ],
  email: [
    validators.required('Email is required'),
    validators.email('Invalid email format')
  ]
});

// Middlewares
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.get('/api/users', (req, res) => {
  res.ok(db.users, 'Users retrieved successfully');
});

app.get('/api/users/:id', (req, res) => {
  const user = db.users.find(u => u.id === parseInt(req.params.id));
  
  if (!user) {
    return res.error({ code: 'NOT_FOUND', message: 'User not found' });
  }
  
  res.ok(user);
});

app.post('/api/users', validate(userSchema), (req, res) => {
  const { name, email } = req.body;
  
  // Check if email exists
  const exists = db.users.some(u => u.email === email);
  if (exists) {
    return res.error({
      code: 'RECORD_EXISTS',
      message: 'Email already registered'
    });
  }
  
  const newUser = {
    id: nextId++,
    name,
    email
  };
  
  db.users.push(newUser);
  res.status(201).ok(newUser, 'User created successfully');
});

app.put('/api/users/:id', validate(userSchema), (req, res) => {
  const id = parseInt(req.params.id);
  const index = db.users.findIndex(u => u.id === id);
  
  if (index === -1) {
    return res.error({ code: 'NOT_FOUND', message: 'User not found' });
  }
  
  db.users[index] = { ...db.users[index], ...req.body, id };
  res.ok(db.users[index], 'User updated successfully');
});

app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = db.users.findIndex(u => u.id === id);
  
  if (index === -1) {
    return res.error({ code: 'NOT_FOUND', message: 'User not found' });
  }
  
  db.users.splice(index, 1);
  res.ok({ deleted: true }, 'User deleted successfully');
});

// 404 handler
app.notFound((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.url} not found`
    }
  });
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

### Authentication & Authorization

```javascript
const Lieko = require('lieko-express');
const app = Lieko();

// Mock user database
const users = [
  { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
  { id: 2, username: 'user', password: 'user123', role: 'user' }
];

const sessions = {}; // token -> user

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  
  if (!token) {
    return res.error({
      code: 'NO_TOKEN_PROVIDED',
      message: 'Authorization token required'
    });
  }
  
  const user = sessions[token];
  
  if (!user) {
    return res.error({
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired token'
    });
  }
  
  req.user = user;
  next();
};

// Role check middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.error({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions'
      });
    }
    next();
  };
};

// Login route
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => 
    u.username === username && u.password === password
  );
  
  if (!user) {
    return res.error({
      code: 'INVALID_CREDENTIALS',
      status: 401,
      message: 'Invalid username or password'
    });
  }
  
  // Generate token (in production, use JWT)
  const token = Math.random().toString(36).substring(7);
  sessions[token] = { id: user.id, username: user.username, role: user.role };
  
  res.ok({
    token,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

// Protected route
app.get('/api/profile', authMiddleware, (req, res) => {
  res.ok({ user: req.user });
});

// Admin-only route
app.get('/api/admin/stats', authMiddleware, requireRole('admin'), (req, res) => {
  res.ok({ totalUsers: users.length, sessions: Object.keys(sessions).length });
});

// Logout
app.post('/auth/logout', authMiddleware, (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  delete sessions[token];
  res.ok({ message: 'Logged out successfully' });
});

app.listen(3000);
```

### File Upload Handler

```javascript
const Lieko = require('lieko-express');
const { writeFileSync } = require('fs');
const { join } = require('path');

const app = Lieko();

app.post('/upload', (req, res) => {
  if (!req.files || !req.files.file) {
    return res.error({
      code: 'INVALID_REQUEST',
      message: 'No file uploaded'
    });
  }
  
  const file = req.files.file;
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(file.contentType)) {
    return res.error({
      code: 'INVALID_REQUEST',
      message: 'Only JPEG, PNG and GIF files are allowed'
    });
  }
  
  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (file.data.length > maxSize) {
    return res.error({
      code: 'INVALID_REQUEST',
      message: 'File size must not exceed 5MB'
    });
  }
  
  // Save file
  const filename = `${Date.now()}-${file.filename}`;
  const filepath = join(__dirname, 'uploads', filename);
  
  writeFileSync(filepath, file.data);
  
  res.ok({
    filename,
    originalName: file.filename,
    size: file.data.length,
    contentType: file.contentType,
    url: `/uploads/${filename}`
  }, 'File uploaded successfully');
});

app.listen(3000);
```

### Rate Limiting Middleware

```javascript
const rateLimits = new Map();

const rateLimit = (options = {}) => {
  const {
    windowMs = 60000,  // 1 minute
    maxRequests = 100
  } = options;
  
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    
    if (!rateLimits.has(key)) {
      rateLimits.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const limit = rateLimits.get(key);
    
    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + windowMs;
      return next();
    }
    
    if (limit.count >= maxRequests) {
      return res.error({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.'
      });
    }
    
    limit.count++;
    next();
  };
};

// Usage
app.use('/api', rateLimit({ windowMs: 60000, maxRequests: 100 }));
```

### Request Logging Middleware

```javascript
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Capture original end method
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    console.log({
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    originalEnd.apply(res, args);
  };
  
  next();
};

app.use(requestLogger);
```


## 🎯 Complete Application Example

See the [examples](./examples) directory for a full-featured application with:
- User authentication
- CRUD operations
- Validation
- File uploads
- Nested routers
- Middleware examples
- Comprehensive test suite


# 📊 Performance Tips (Suite)

1. **Use async middlewares** for I/O operations
2. **Avoid heavy synchronous operations** inside request handlers
3. **Minimize deep-nested routers** unless needed
4. **Reuse validation schemas** instead of re-creating them for each request
5. **Use reverse proxy headers correctly** (`trust proxy`) when hosting behind Nginx
6. **Disable console logs in production** or use a real logger with adjustable log levels


## Debug & Introspection Tools

Lieko Express comes with powerful built-in development and debugging utilities.

### 🐞 Enable Debug Mode

```js
const app = Lieko();

// Enable debug mode (never use in production!)
app.settings.debug = true;
// or simply
app.enable('debug')
```

When `debug` is enabled, Lieko automatically logs every request with a beautiful, color-coded output containing:

- Method + full URL
- Real client IP (IPv4/IPv6)
- Status code (color-coded)
- Ultra-precise response time (µs / ms / s)
- Route parameters, query string, body, uploaded files

**Example output:**
```
DEBUG REQUEST
→ GET /api/users/42?page=2&active=true
→ IP: 127.0.0.1
→ Status: 200
→ Duration: 1.847ms
→ Params: {"id":"42"}
→ Query: {"page":2,"active":true}
→ Body: {}
→ Files: 
---------------------------------------------
```

**Warning:** Never enable `app.enable('debug')` in production (performance impact + potential sensitive data leak).

### List All Registered Routes

```js
// Returns an array of route objects — perfect for tests or auto-docs
const routes = app.listRoutes();
console.log(routes);
/*
[
  { method: 'GET',    path: '/api/users',         middlewares: 1 },
  { method: 'POST',   path: '/api/users',         middlewares: 2 },
  { method: 'GET',    path: '/api/users/:id',     middlewares: 0 },
  { method: 'DELETE', path: '/api/users/:id',     middlewares: 1 },
  ...
]
*/
```

Ideal for generating OpenAPI specs, runtime validation, or integration tests.

### Pretty-Print All Routes in Console

```js
// Display a clean table
app.printRoutes();
```

**Sample output:**
```
Registered Routes:

GET     /api/users            (middlewares: 1)
POST    /api/users            (middlewares: 2)
GET     /api/users/:id        (middlewares: 0)
DELETE  /api/users/:id        (middlewares: 1)
PATCH   /api/users/:id        (middlewares: 0)
ALL     /webhook/*            (middlewares: 0)

```

### Nested (group-based):

```js
app.printRoutesNested();
```

Example:

```
/api   [auth]
  /api/admin   [auth, requireAdmin]
    GET   /users
    POST  /users
  GET   /profile
```

Perfect to quickly verify that all your routes and middlewares are correctly registered.

## ⚙️ Application Settings

Lieko Express provides a small but effective settings mechanism.

You can configure:

```js
app.set('trust proxy', value);
app.set('debug', boolean);
app.set('x-powered-by', boolean);
app.set('strictTrailingSlash', boolean);
app.set('allowTrailingSlash', boolean);
```

# 🌐 Trust Proxy & IP Parsing

Lieko improves on Express with a powerful trust proxy system.

### Configure:

```js
app.set('trust proxy', true);
```

### Supported values:

* `true` — trust all
* `"loopback"`
* `"127.0.0.1"`
* `["10.0.0.1", "10.0.0.2"]`
* custom function `(ip) => boolean`

### Provided fields:

```js
req.ip.raw
req.ip.ipv4
req.ip.ipv6
req.ips  // full proxy chain
```

Lieko correctly handles:

* IPv6
* IPv4-mapped IPv6 (`::ffff:127.0.0.1`)
* Multi-proxy headers


## 🧩 Internals & Architecture

This section describes how Lieko Express works under the hood.

### Request Lifecycle

1. Enhance request object (IP parsing, protocol, host…)
2. Parse query string
3. Parse body (`json`, `urlencoded`, `multipart/form-data`, or text)
4. Apply **global middlewares**
5. Match route using regex-based router
6. Apply **route middlewares**
7. Execute route handler
8. Apply 404 handler if no route matched
9. Send error responses using the built-in error system

### Router Internals

Routes are converted to regular expressions:

```txt
/users/:id  →  ^/users/(?<id>[^/]+)$
/files/*    →  ^/files/.*$
```

This allows:

* Named parameters
* Wildcards
* Fast matching


## 🧱 Extending Lieko Express

Because the framework is intentionally small, you can easily extend it.

### Custom Response Helpers

```js
app.use((req, res, next) => {
  res.created = (data) => {
    res.status(201).json({ success: true, data });
  };
  next();
});
```

### Custom Middlewares

```js
const timing = (req, res, next) => {
  const start = Date.now();
  res.end = ((original) => (...args) => {
    console.log(`⏱️ ${req.method} ${req.url} took ${Date.now() - start}ms`);
    original(...args);
  })(res.end);
  next();
};

app.use(timing);
```

# 🔌 Plugins

A plugin is simply a function receiving `app`:

```js
function myPlugin(app) {
  app.get('/plugin-test', (req, res) => res.ok("OK"));
}

myPlugin(app);
```
## 📦 API Reference

### `Lieko()`

Creates a new application instance.

### `Lieko.Router()`

Creates a modular router (internally: a Lieko app).

### `app.use(...)`

Supported patterns:

| Signature                         | Description              |
| --------------------------------- | ------------------------ |
| `app.use(fn)`                     | Global middleware        |
| `app.use(path, fn)`               | Path-filtered middleware |
| `app.use(path, router)`           | Mount router             |
| `app.use(path, mw1, mw2, router)` | Mix middlewares + router |

### `app.get/post/put/delete/patch/all(path, ...handlers)`

Registers routes with optional middlewares.

### `app.notFound(handler)`

Custom 404 callback.

```js
app.notFound((req, res) => {
  res.error({
    code: "NOT_FOUND",
    message: `Route "${req.method} ${req.originalUrl}" does not exist`
  });
});

// With logging
app.notFound((req, res) => {
  console.warn(`404: ${req.method} ${req.originalUrl}`);
  res.error("ROUTE_NOT_FOUND");
});

// With HTML Response
app.notFound((req, res) => {
  res.status(404).send("<h1>Page Not Found</h1>");
});
```

### `app.errorHandler(handler)`

Register a custom 500 handler.



## 🔍 Known Limitations

Because Lieko Express is minimalistic:

* No template engine
* No streaming uploads for multipart/form-data (parsed in memory)
* No built-in cookies/sessions
* No WebSocket support yet
* Routers cannot have their own `notFound` handler (inherited from parent)

Future versions may address some of these.


## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a pull request



## 📄 License

MIT License — free to use in personal and commercial projects.