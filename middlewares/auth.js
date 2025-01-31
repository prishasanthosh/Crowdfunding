const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', ''); 
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, 'secret_key'); 
        req.user = decoded; 
        next(); 
    } catch (err) {
        return res.status(400).json({ message: 'Invalid token' });
    }
};

module.exports = authMiddleware;
