const Lieko = require('lieko-express');
const config = require('./config');
const logger = require('./middleware/logger');
const cors = require('./middleware/cors');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const mountRoutes = require('./routes');

const app = Lieko();

app.enable('debug');
//app.enable('trust proxy');
app.enable('allowTrailingSlash');
app.disable('x-powered-by');

app.use(logger);
app.use(cors);

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