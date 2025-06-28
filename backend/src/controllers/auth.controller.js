const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Verifier si l'utilisateur existe
    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    console.log('Utilisateur trouve:', { id: user.id, username: user.username, lastLoginAt: user.lastLoginAt });

    // Verifier si le compte est actif
    if (!user.isActive) {
      return res.status(401).json({ message: 'Ce compte est desactive' });
    }

    // Verifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    // Mettre a jour la derniere connexion
    const updateResult = await User.updateLastLogin(user.id);
    console.log('Mise a jour derniere connexion:', { userId: user.id, success: updateResult });

    // Recuperer l'utilisateur mis a jour
    const updatedUser = await User.findById(user.id);
    console.log('Utilisateur apres mise a jour:', { id: updatedUser.id, lastLoginAt: updatedUser.lastLoginAt });

    // Generer le token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      config.jwtSecret,
      { expiresIn: '20h' }
    );

    // Retourner les informations de l'utilisateur et le token
    res.json({
      access_token: token,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        isActive: updatedUser.isActive,
        lastLoginAt: updatedUser.lastLoginAt
      }
    });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
}; 