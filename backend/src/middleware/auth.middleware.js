const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const authMiddleware = async (req, res, next) => {
  try {
    // Recuperer le token du header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token d\'authentification manquant' });
    }

    const token = authHeader.split(' ')[1];

    // Verifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Recuperer l'utilisateur
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouve' });
    }

    // Verifier si l'utilisateur est actif
    if (!user.isActive) {
      return res.status(401).json({ message: 'Compte desactive' });
    }

    // Ajouter l'utilisateur a la requete
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token invalide' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expire' });
    }
    console.error('Erreur d\'authentification:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

module.exports = authMiddleware; 