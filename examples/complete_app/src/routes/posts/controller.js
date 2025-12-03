const db = require('../../helpers/db');

const normalizeString = (value) => {
    if (Array.isArray(value)) return value[0] || '';
    if (typeof value === 'string') return value;
    return '';
};

const listPosts = (req, res) => {
    let posts = [...db.posts];

    // TEXT SEARCH
    const rawSearch = req.query.search;
    if (rawSearch) {
        const term = normalizeString(rawSearch).trim().toLowerCase();
        if (term) {
            posts = posts.filter(p =>
                p.title.toLowerCase().includes(term) ||
                p.content.toLowerCase().includes(term)
            );
        }
    }

    // SORTING
    if (req.query.sort) {
        const [field, direction = 'asc'] = String(req.query.sort).split(':');
        const order = direction.toLowerCase() === 'desc' ? -1 : 1;
        const allowed = ['id', 'title', 'createdAt', 'userId', 'published'];

        if (allowed.includes(field)) {
            posts.sort((a, b) =>
                a[field] > b[field] ? order : a[field] < b[field] ? -order : 0
            );
        }
    }

    // FILTER PUBLISHED
    if (req.query.published !== undefined) {
        const published = req.query.published === 'true' || req.query.published === true;
        posts = posts.filter(p => p.published === published);
    }

    // FILTER BY USER
    if (req.query.userId !== undefined) {
        const userId = Number(req.query.userId);
        if (!isNaN(userId)) posts = posts.filter(p => p.userId === userId);
    }

    // PAGINATION
    const total = posts.length;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const start = (page - 1) * limit;

    res.paginated(posts.slice(start, start + limit), total, 'Posts retrieved successfully');
};

const getPost = (req, res) => {
    const postId = +req.params.id;
    const post = db.posts.find(p => p.id === postId);
    if (!post) return res.error({ code: 'NOT_FOUND', message: 'Post not found' });

    const comments = db.comments.filter(c => c.postId === postId);
    res.ok({ ...post, comments });
};

const createPost = (req, res) => {
    const { title, content, published = false } = req.body;

    const newPost = {
        id: db.posts.length + 1,
        title,
        content, 
        published: Boolean(published),
        userId: req.user.id,
        createdAt: new Date().toISOString()
    };

    db.posts.push(newPost);
    db.savePosts(db.posts);

    res.status(201).ok(newPost, 'Post created successfully');
};

const publishPost = (req, res) => {
    const postId = +req.params.id;
    const post = db.posts.find(p => p.id === postId);

    if (!post) return res.error({ code: 'NOT_FOUND', message: 'Post not found' });

    post.published = true;
    db.savePosts(db.posts);

    res.ok(post, 'Post published successfully');
};

const updatePost = (req, res) => {
    const postId = +req.params.id;
    const post = db.posts.find(p => p.id === postId);
    if (!post) return res.error({ code: 'NOT_FOUND', message: 'Post not found' });

    const { title, content, published } = req.body;

    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;
    if (published !== undefined) post.published = Boolean(published);

    db.savePosts(db.posts);

    res.ok(post, 'Post updated successfully');
};

const deletePost = (req, res) => {
    const id = +req.params.id;
    const index = db.posts.findIndex(p => p.id === id);

    if (index === -1) return res.error({ code: 'NOT_FOUND', message: 'Post not found' });

    db.posts.splice(index, 1);
    db.savePosts(db.posts);

    res.ok(null, 'Post deleted successfully');
};

module.exports = {
    listPosts,
    getPost,
    createPost,
    publishPost,
    updatePost,
    deletePost
};
