const Lieko = require('lieko-express');
const config = require('./config');
const logger = require('./middleware/logger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const mountRoutes = require('./routes');

const app = Lieko();

app.enable('debug');
//app.enable('trust proxy');
app.enable('allowTrailingSlash');
app.disable('x-powered-by');

// Only for overide default settings json: 1mb, url: 1mb
//app.json({ limit: '50mb' });
//app.urlencoded({ limit: '100kb', extended: false });
//app.multipart({ limit: '50mb' })

app.use(logger);
app.cors({ debug: true });

mountRoutes(app);

app.notFound(notFoundHandler);
app.errorHandler(errorHandler);

app.printRoutes();
//app.printRoutesNested();

const server = app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════╗
║        Lieko Express API Running         ║
╠══════════════════════════════════════════╣
║  Environment : ${config.env.padEnd(24)}  ║
║  Port        : ${config.port.toString().padEnd(24)}  ║
║  URL         : http://localhost:${config.port}     ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = server;