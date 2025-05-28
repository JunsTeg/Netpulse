import { Sequelize } from 'sequelize';
const dotenv = require('dotenv');
const path = require('path');

// Chargement du fichier .env depuis la racine du projet
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || '',
  process.env.MYSQL_USER || '',
  process.env.MYSQL_PASSWORD || '',
  {
    host: 'localhost', // nom d'hote pour acces local a la base Docker
    port: Number(process.env.MYSQL_PORT) || 3306,
    dialect: 'mysql',
    logging: process.env.APP_ENV === 'development', // désactive les logs en prod
  }
);

// Test de connexion a la base de donnees
sequelize.authenticate()
  .then(() => {
    console.log('Connexion a la base de donnees reussie.');
  })
  .catch((err) => {
    console.error('Impossible de se connecter a la base de donnees:', err);
  });
