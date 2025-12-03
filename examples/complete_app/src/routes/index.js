const path = require('path');
const fs = require('fs');

const { auth, requireAdmin } = require('../middleware/auth');

const usersRouter = require('./users/router');
const postsRouter = require('./posts/router');
const commentsRouter = require('./comments/router');
const sseRoutes = require('./others/sse');

module.exports = (app) => {

  app.get('/', (req, res) => res.ok({ message: 'Lieko Express API Example v1' }));
  app.get('/ping', (req, res) => res.send('pong'));
  app.get('/health', (req, res) => res.ok({ status: 'ok', uptime: process.uptime() }));

  // Mount SSE Routes at /
  app.use(sseRoutes);

  app.get("/error", () => {
    throw new Error("Test error!");
  });

  app.get('/get-user-5', (req, res) => res.redirect('/api/users/5'));

  app.get('/api/docs/openapi.json', (req, res) => {
    const filePath = path.join(__dirname, '../api/docs/openapi.json');

    try {
      const json = fs.readFileSync(filePath, 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.send(json);
    } catch (error) {
      res.error({ code: 'FILE_ERROR', message: 'Unable to load openapi.json' });
    }

  });

  app.group('/api', auth, (api) => {

    api.get('/protected', (req, res) =>
      res.ok({ message: 'Protected route', user: req.user })
    );

    api.group('/admin', requireAdmin, (admin) => {
      admin.use('/users', usersRouter);
      admin.use('/posts', postsRouter);
      admin.use('/comments', commentsRouter);
    });
  });
};
