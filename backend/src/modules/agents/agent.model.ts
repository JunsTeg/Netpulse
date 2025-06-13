import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database';

export const Agent = sequelize.define('Agent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  config: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('OK', 'KO', 'PENDING'),
    defaultValue: 'PENDING',
  },
  lastRun: {
    type: DataTypes.DATE,
  },
})