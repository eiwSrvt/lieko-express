function auth(req, res, next) {
  const auth = req.headers['authorization'];

  if (!auth) {
    return res.error({
      code: 'NO_TOKEN_PROVIDED',
      status: 401,
      message: 'Missing or invalid token'
    });
  }

  req.user = {
    id: 1,
    username: 'john_doe',
    role: 'admin',
    isAdmin: true
  };
  next();
}

function requireAdmin(req, res, next) {  
  if (!req.user) {
    return res.error({
      code: 'NO_TOKEN_PROVIDED',
      status: 401,
      message: 'Authentication required'
    });
  }

  if (!req.user.isAdmin) {
    return res.error({
      code: 'FORBIDDEN',
      status: 403,
      message: 'Admin only'
    });
  }
  next();
}

module.exports = { auth, requireAdmin };
