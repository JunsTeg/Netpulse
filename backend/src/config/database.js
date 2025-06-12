const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'netpulse',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test de la connexion
pool.getConnection()
  .then(connection => {
    console.log('Connexion a la base de donnees reussie');
    connection.release();
  })
  .catch(err => {
    console.error('Erreur de connexion a la base de donnees:', err);
  });

module.exports = pool; 