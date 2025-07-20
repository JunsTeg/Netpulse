import { Sequelize } from 'sequelize';
const dotenv = require('dotenv');
const path = require('path');

// Chargement du fichier .env depuis la racine du projet
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('Configuration base de données:');
console.log('Database:', process.env.MYSQL_DATABASE);
console.log('User:', process.env.MYSQL_USER);
console.log('Host:', process.env.DB_HOST || 'localhost');
console.log('Port:', process.env.MYSQL_PORT);

export const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || 'netpulse',
  process.env.MYSQL_USER || 'netpulse_user',
  process.env.MYSQL_PASSWORD || 'netpulse_pwd',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    dialect: 'mysql',
    logging: process.env.APP_ENV === 'development',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    },
    retry: {
      max: 3,
      timeout: 10000
    }
  }
);

// Test de connexion a la base de donnees
sequelize.authenticate()
  .then(() => {
    console.log('✅ Connexion a la base de donnees reussie.');
  })
  .catch((err) => {
    console.error('❌ Impossible de se connecter a la base de donnees:', err);
  });
