const db = require('../config/database');

class User {
  // Recuperer tous les utilisateurs
  static async findAll() {
    try {
      const [rows] = await db.query(
        'SELECT id, username, email, isActive, createdAt, lastLoginAt FROM utilisateur'
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Recuperer un utilisateur par son ID
  static async findById(id) {
    try {
      const [rows] = await db.query(
        'SELECT id, username, email, isActive, createdAt, lastLoginAt FROM utilisateur WHERE id = ?',
        [id]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Recuperer un utilisateur par son nom d'utilisateur
  static async findByUsername(username) {
    try {
      const [rows] = await db.query(
        'SELECT id, username, email, password, isActive, createdAt, lastLoginAt FROM utilisateur WHERE username = ?',
        [username]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Recuperer un utilisateur par son email
  static async findByEmail(email) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM utilisateur WHERE email = ?',
        [email]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Creer un nouvel utilisateur
  static async create(userData) {
    try {
      const [result] = await db.query(
        'INSERT INTO utilisateur (id, username, email, password, isActive) VALUES (UUID(), ?, ?, ?, TRUE)',
        [userData.username, userData.email, userData.password]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  // Mettre a jour un utilisateur
  static async update(id, userData) {
    try {
      const updateFields = [];
      const values = [];

      if (userData.username) {
        updateFields.push('username = ?');
        values.push(userData.username);
      }
      if (userData.email) {
        updateFields.push('email = ?');
        values.push(userData.email);
      }
      if (userData.password) {
        updateFields.push('password = ?');
        values.push(userData.password);
      }
      if (userData.isActive !== undefined) {
        updateFields.push('isActive = ?');
        values.push(userData.isActive);
      }

      if (updateFields.length === 0) {
        return null;
      }

      values.push(id);
      const [result] = await db.query(
        `UPDATE utilisateur SET ${updateFields.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // Supprimer un utilisateur
  static async delete(id) {
    try {
      const [result] = await db.query(
        'DELETE FROM utilisateur WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // Mettre a jour la date de derniere connexion
  static async updateLastLogin(id) {
    try {
      const [result] = await db.query(
        'UPDATE utilisateur SET lastLoginAt = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User; 