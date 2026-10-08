const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Please sign in to continue.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.sub) throw new Error('Token has no subject');
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' });
  }
}

module.exports = authenticate;
