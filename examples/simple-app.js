const Lieko = require('../lieko-express');
const { Router, schema, validators, validate } = Lieko;

const app = Lieko();

//app.settings['trust proxy'] = true;
app.set('allowTrailingSlash', true);

// Logging middleware
app.use((req, res, next) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const durationNs = end - start;
        const durationMs = Number(durationNs) / 1_000_000;

        let timeStr;
        if (durationMs < 1) {
            timeStr = `${(durationMs * 1000).toFixed(1)}µs`;
        } else if (durationMs < 1000) {
            timeStr = `${durationMs.toFixed(3).replace(/\.?0+$/, '')}ms`;
        } else {
            timeStr = `${(durationMs / 1000).toFixed(3)}s`;
        }

        const timestamp = new Date()
            .toISOString()
            .replace('T', ' ')
            .split('.')[0];

        const ip = req.ip.ipv4 || 'unknown';

        console.log(
            `[${timestamp}] ${req.method} ${res.statusCode} ${req.originalUrl || req.url} | ${ip} | Duration: ${timeStr}`
        );
    });

    next();
});
app.enable('debug');
//app.cors({ debug: true });

const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.error({
            code: 'NO_TOKEN_PROVIDED',
            message: 'Authorization token is required'
        });
    }

    if (token !== 'Bearer secret-token-123') {
        return res.error({
            code: 'INVALID_TOKEN',
            message: 'Invalid authorization token'
        });
    }

    req.user = { id: 1, username: 'john_doe', role: 'admin' };
    next();
};

const db = {
    users: [
        { id: 1, username: 'john_doe', email: 'john@example.com', age: 30, active: true },
        { id: 2, username: 'jane_smith', email: 'jane@example.com', age: 25, active: true }
    ],
    posts: [
        { id: 1, title: 'First Post', content: 'Hello World', userId: 1, published: true },
        { id: 2, title: 'Second Post', content: 'Learning Lieko', userId: 1, published: false }
    ],
    comments: [
        { id: 1, postId: 1, userId: 2, text: 'Great post!', approved: true }
    ]
};

const userCreateSchema = schema({
    username: [
        validators.required('Username is required'),
        validators.string('Username must be a string'),
        validators.minLength(3, 'Username must be at least 3 characters'),
        validators.maxLength(20, 'Username must not exceed 20 characters'),
        validators.pattern(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores')
    ],
    email: [
        validators.required('Email is required'),
        validators.email('Invalid email format')
    ],
    age: [
        validators.required('Age is required'),
        validators.number('Age must be a number'),
        validators.min(18, 'Must be at least 18 years old'),
        validators.max(120, 'Age must be realistic')
    ],
    acceptTerms: [
        validators.required('You must accept the terms'),
        validators.mustBeTrue('You must accept the terms and conditions')
    ]
});

const postCreateSchema = schema({
    title: [
        validators.required('Title is required'),
        validators.string('Title must be a string'),
        validators.minLength(5, 'Title must be at least 5 characters'),
        validators.maxLength(100, 'Title must not exceed 100 characters')
    ],
    content: [
        validators.required('Content is required'),
        validators.string('Content must be a string'),
        validators.minLength(10, 'Content must be at least 10 characters')
    ],
    published: [
        validators.boolean('Published must be a boolean')
    ]
});

const commentSchema = schema({
    text: [
        validators.required('Comment text is required'),
        validators.string('Comment must be a string'),
        validators.minLength(1, 'Comment cannot be empty'),
        validators.maxLength(500, 'Comment must not exceed 500 characters')
    ],
    postId: [
        validators.required('Post ID is required'),
        validators.number('Post ID must be a number'),
        validators.custom((value) => {
            return db.posts.some(p => p.id === value);
        }, 'Post does not exist')
    ]
});

app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Lieko Express API',
        version: '1.0.0',
        endpoints: {
            users: '/api/users',
            posts: '/api/posts',
            comments: '/api/comments',
            protected: '/api/protected'
        }
    });
});

app.get('/ping', (req, res) => {
    res.setHeader('X-Pong', 'true');
    res.send('pong');
});

app.get('/health', (req, res) => {
    res.ok({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

const usersRouter = Lieko.Router();

// GET /api/users - List users with optional filters
usersRouter.get('/', (req, res) => {
    const { active, minAge } = req.query;

    let users = [...db.users];

    if (active !== undefined) {
        users = users.filter(u => u.active === active);
    }

    if (minAge !== undefined) {
        users = users.filter(u => u.age >= minAge);
    }

    res.ok(users, 'Users retrieved successfully');
});

// GET /api/users/:id - Get user by ID
usersRouter.get('/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const user = db.users.find(u => u.id === userId);

    if (!user) {
        return res.error({
            code: 'NOT_FOUND',
            message: 'User not found'
        });
    }

    res.ok(user);
});

// POST /api/users - Create a new user
usersRouter.post('/', validate(userCreateSchema), (req, res) => {
    const { username, email, age, acceptTerms } = req.body;

    const existing = db.users.find(u => u.username === username || u.email === email);
    if (existing) {
        return res.error({
            code: 'RECORD_EXISTS',
            message: 'Username or email already exists'
        });
    }

    const newUser = {
        id: db.users.length + 1,
        username,
        email,
        age,
        active: true
    };

    db.users.push(newUser);
    res.created(newUser, 'User created successfully');
});

// PUT /api/users/:id - Update user by ID
usersRouter.put('/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const userIndex = db.users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.error({
            code: 'NOT_FOUND',
            message: 'User not found'
        });
    }

    db.users[userIndex] = { ...db.users[userIndex], ...req.body, id: userId };
    res.ok(db.users[userIndex], 'User updated successfully');
});

// DELETE /api/users/:id - Delete user by ID
usersRouter.delete('/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const userIndex = db.users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.error({
            code: 'NOT_FOUND',
            message: 'User not found'
        });
    }

    db.users.splice(userIndex, 1);
    res.ok({ deleted: true }, 'User deleted successfully');
});

const postsRouter = Lieko.Router();

// GET /api/posts - List posts with optional filters
postsRouter.get('/', (req, res) => {
    const { userId, published } = req.query;

    let posts = [...db.posts];

    if (userId !== undefined) {
        posts = posts.filter(p => p.userId === userId);
    }

    if (published !== undefined) {
        posts = posts.filter(p => p.published === published);
    }

    res.ok(posts);
});

// GET /api/posts/:id - Get post by ID with comments
postsRouter.get('/:id', (req, res) => {
    const postId = parseInt(req.params.id);
    const post = db.posts.find(p => p.id === postId);

    if (!post) {
        return res.error({
            code: 'NOT_FOUND',
            message: 'Post not found'
        });
    }

    const comments = db.comments.filter(c => c.postId === postId);

    res.ok({ ...post, comments });
});

// POST /api/posts - Create a new post (auth required)
postsRouter.post('/', authMiddleware, validate(postCreateSchema), (req, res) => {
    const { title, content, published = false } = req.body;

    const newPost = {
        id: db.posts.length + 1,
        title,
        content,
        published,
        userId: req.user.id
    };

    db.posts.push(newPost);
    res.status(201).ok(newPost, 'Post created successfully');
});

// PATCH /api/posts/:id/publish - Publish a post (auth required)
postsRouter.patch('/:id/publish', authMiddleware, (req, res) => {
    const postId = parseInt(req.params.id);
    const post = db.posts.find(p => p.id === postId);

    if (!post) {
        return res.error({
            code: 'NOT_FOUND',
            message: 'Post not found'
        });
    }

    if (post.userId !== req.user.id) {
        return res.error({
            code: 'FORBIDDEN',
            message: 'You can only publish your own posts'
        });
    }

    post.published = true;
    res.ok(post, 'Post published successfully');
});

const commentsRouter = Router();

// POST /api/comments - Create a new comment
commentsRouter.post('/', validate(commentSchema), (req, res) => {
    const { text, postId } = req.body;

    const newComment = {
        id: db.comments.length + 1,
        postId,
        userId: 1, // Simulé
        text,
        approved: false
    };

    db.comments.push(newComment);
    res.status(201).ok(newComment, 'Comment created successfully');
});

app.use('/api/users', usersRouter);
app.use('/api/posts', postsRouter);
app.use('/api/comments', commentsRouter);

// Protected route example
app.get('/api/protected', authMiddleware, (req, res) => {
    res.ok({
        message: 'This is a protected route',
        user: req.user
    });
});

// Additional test routes
app.get('/test/params/:category/:id', (req, res) => {
    res.ok({
        params: req.params,
        category: req.params.category,
        id: req.params.id
    });
});

// Test query parameters and types
app.get('/test/query', (req, res) => {
    res.ok({
        query: req.query,
        types: Object.keys(req.query).reduce((acc, key) => {
            acc[key] = typeof req.query[key];
            return acc;
        }, {})
    });
});

// Test redirection
app.get('/redirect', (req, res) => {
    res.redirect('/');
});

// Test multipart/form-data
app.post('/test/upload', (req, res) => {
    res.ok({
        body: req.body,
        files: Object.keys(req.files).reduce((acc, key) => {
            acc[key] = {
                filename: req.files[key].filename,
                size: req.files[key].data.length,
                contentType: req.files[key].contentType
            };
            return acc;
        }, {})
    });
});

app.notFound((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.url} not found`
        }
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   Lieko Express Server Started           ║
╠══════════════════════════════════════════╣
║   Port: ${PORT}                             ║
║   URL:  http://localhost:${PORT}            ║
║                                          ║
║   Endpoints:                             ║
║   • GET  /                               ║
║   • GET  /health                         ║
║   • GET  /api/users                      ║
║   • POST /api/users                      ║
║   • GET  /api/posts                      ║
║   • POST /api/posts (auth required)      ║
║   • POST /api/comments                   ║
║   • GET  /api/protected (auth required)  ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;