const db = require('../../helpers/db');

const normalizeString = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? v[0] : '');

const listComments = (req, res) => {
    let comments = [...db.comments];

    if (req.query.search) {
        const term = normalizeString(req.query.search).trim().toLowerCase();
        comments = comments.filter(c => c.text.toLowerCase().includes(term));
    }

    if (req.query.postId !== undefined) {
        const id = Number(req.query.postId);
        if (!isNaN(id)) comments = comments.filter(c => c.postId === id);
    }

    if (req.query.userId !== undefined) {
        const id = Number(req.query.userId);
        if (!isNaN(id)) comments = comments.filter(c => c.userId === id);
    }

    if (req.query.approved !== undefined) {
        const approved = req.query.approved === 'true' || req.query.approved === true;
        comments = comments.filter(c => c.approved === approved);
    }

    const total = comments.length;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 15;
    const start = (page - 1) * limit;

    res.paginated(comments.slice(start, start + limit), total, 'Comments retrieved successfully');
};

const getComment = (req, res) => {
    const comment = db.comments.find(c => c.id === +req.params.id);
    if (!comment) return res.error({ code: 'NOT_FOUND', message: 'Comment not found' });

    res.ok(comment);
};

const createComment = (req, res) => {
    const { text, postId } = req.body;

    const newComment = {
        id: db.comments.length + 1,
        postId: Number(postId),
        userId: req.user?.id || 1,
        text,
        approved: false,
        createdAt: new Date().toISOString()
    };

    db.comments.push(newComment);
    db.saveComments(db.comments);

    res.status(201).ok(newComment, 'Comment created successfully');
};

const approveComment = (req, res) => {
    const comment = db.comments.find(c => c.id === +req.params.id);
    if (!comment) return res.error({ code: 'NOT_FOUND', message: 'Comment not found' });

    comment.approved = true;
    db.saveComments(db.comments);

    res.ok(comment, 'Comment approved successfully');
};

const deleteComment = (req, res) => {
    const index = db.comments.findIndex(c => c.id === +req.params.id);
    if (index === -1) return res.error({ code: 'NOT_FOUND', message: 'Comment not found' });

    db.comments.splice(index, 1);
    db.saveComments(db.comments);

    res.ok(null, 'Comment deleted successfully');
};

module.exports = {
    listComments,
    getComment,
    createComment,
    approveComment,
    deleteComment
};
