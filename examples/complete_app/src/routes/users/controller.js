const db = require('../../helpers/db');

const normalizeString = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? v[0] : '');

const listUsers = (req, res) => {
    let users = [...db.users];

    if (req.query.search) {
        const term = normalizeString(req.query.search).trim().toLowerCase();
        users = users.filter(u =>
            u.username.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term)
        );
    }

    if (req.query.active !== undefined) {
        const active = req.query.active === 'true' || req.query.active === true;
        users = users.filter(u => u.active === active);
    }

    if (req.query.minAge !== undefined) {
        const minAge = Number(req.query.minAge);
        if (!isNaN(minAge)) users = users.filter(u => u.age >= minAge);
    }

    if (req.query.sort) {
        const [field, direction = 'asc'] = req.query.sort.split(':');
        const order = direction === 'desc' ? -1 : 1;
        const allowed = ['id', 'username', 'email', 'age', 'active', 'createdAt'];

        if (allowed.includes(field)) {
            users.sort((a, b) =>
                a[field] > b[field] ? order : a[field] < b[field] ? -order : 0
            );
        }
    }

    const total = users.length;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100;
    const start = (page - 1) * limit;

    res.paginated(users.slice(start, start + limit), total, 'Users retrieved successfully');
};

const getUser = (req, res) => {
    const user = db.users.find(u => u.id === +req.params.id);
    if (!user) return res.error({ code: 'NOT_FOUND', message: 'User not found' });

    res.ok({
        ...user,
        posts: db.posts.filter(p => p.userId === user.id),
        comments: db.comments.filter(c => c.userId === user.id)
    });
};

const createUser = (req, res) => {
    const { username, email, age, active } = req.body;

    if (!username) return res.error({ code: 'INVALID', message: 'Username is required' });
    if (!email) return res.error({ code: 'INVALID', message: 'Email is required' });
    if (age === undefined) return res.error({ code: 'INVALID', message: 'Age is required' });

    const newUser = {
        id: db.users.length + 1,
        username,
        email,
        age: Number(age),
        active: Boolean(active),
        createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    db.saveUsers(db.users);

    res.status(201).ok(newUser, 'User created successfully');
};

const updateUser = (req, res) => {
    const user = db.users.find(u => u.id === +req.params.id);
    if (!user) return res.error({ code: 'NOT_FOUND', message: 'User not found' });

    const { username, email, age, active } = req.body;

    if (username !== undefined) user.username = username;
    if (email !== undefined) user.email = email;
    if (age !== undefined) user.age = Number(age);
    if (active !== undefined) user.active = Boolean(active);

    db.saveUsers(db.users);

    res.ok(user, 'User updated successfully');
};

const deleteUser = (req, res) => {
    const index = db.users.findIndex(u => u.id === +req.params.id);
    if (index === -1) return res.error({ code: 'NOT_FOUND', message: 'User not found' });

    db.users.splice(index, 1);
    db.saveUsers(db.users);

    res.ok(null, 'User deleted successfully');
};

module.exports = {
    listUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser
};
