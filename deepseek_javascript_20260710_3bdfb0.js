// services/authService.js - Authentication service with bcrypt
const { getDatabase } = require('../database/dbInit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'audit-planner-secret-key-2024';
const SALT_ROUNDS = 10;

class AuthService {
  async login(username, password) {
    const db = getDatabase();
    
    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
      
      if (!user) {
        return { success: false, message: 'Invalid username or password' };
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return { success: false, message: 'Invalid username or password' };
      }
      
      // Update last login
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?').run(user.user_id);
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.user_id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
      );
      
      return {
        success: true,
        token,
        user: {
          userId: user.user_id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role
        }
      };
    } catch (error) {
      return { success: false, message: `Login error: ${error.message}` };
    }
  }

  async registerUser(userData) {
    const db = getDatabase();
    
    try {
      const { username, password, fullName, email, role } = userData;
      
      // Check if username exists
      const existingUser = db.prepare('SELECT user_id FROM users WHERE username = ?').get(username);
      if (existingUser) {
        return { success: false, message: 'Username already exists' };
      }
      
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      
      const result = db.prepare(
        'INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)'
      ).run(username, passwordHash, fullName, email, role || 'auditor');
      
      return { success: true, userId: result.lastInsertRowid };
    } catch (error) {
      return { success: false, message: `Registration error: ${error.message}` };
    }
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
}

module.exports = new AuthService();