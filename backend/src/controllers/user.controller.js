const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class UserController {
  // Recuperer tous les utilisateurs
  static async getAllUsers(req, res) {
    try {
      const users = await User.findAll();
      // Transformer les donnees pour exclure le mot de passe
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }));
      res.json(sanitizedUsers);
    } catch (error) {
      console.error('Erreur lors de la recuperation des utilisateurs:', error);
      res.status(500).json({ message: 'Erreur lors de la recuperation des utilisateurs' });
    }
  }

  // Recuperer un utilisateur par son ID
  static async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouve' });
      }
      // Transformer les donnees pour exclure le mot de passe
      const sanitizedUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      };
      res.json(sanitizedUser);
    } catch (error) {
      console.error('Erreur lors de la recuperation de l\'utilisateur:', error);
      res.status(500).json({ message: 'Erreur lors de la recuperation de l\'utilisateur' });
    }
  }

  // Creer un nouvel utilisateur
  static async createUser(req, res) {
    try {
      const { username, email, password } = req.body;

      // Verification si l'utilisateur existe deja
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: 'Ce nom d\'utilisateur est deja utilise' });
      }

      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Cet email est deja utilise' });
      }

      // Hashage du mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);

      // Creation de l'utilisateur
      const userId = await User.create({
        username,
        email,
        password: hashedPassword
      });

      // Generation du token JWT
      const token = jwt.sign(
        { id: userId, username },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        message: 'Utilisateur cree avec succes',
        token,
        user: {
          id: userId,
          username,
          email
        }
      });
    } catch (error) {
      console.error('Erreur lors de la creation de l\'utilisateur:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  // Mettre a jour un utilisateur
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      // Si un nouveau mot de passe est fourni, le hasher
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      const success = await User.update(id, updateData);
      if (!success) {
        return res.status(404).json({ message: 'Utilisateur non trouve' });
      }

      res.json({ message: 'Utilisateur mis a jour avec succes' });
    } catch (error) {
      console.error('Erreur lors de la mise a jour de l\'utilisateur:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  // Supprimer un utilisateur
  static async deleteUser(req, res) {
    try {
      const success = await User.delete(req.params.id);
      if (!success) {
        return res.status(404).json({ message: 'Utilisateur non trouve' });
      }
      res.json({ message: 'Utilisateur supprime avec succes' });
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
}

module.exports = UserController; 