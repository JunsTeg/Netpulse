CREATE TABLE utilisateur (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastLoginAt DATETIME
);

CREATE TABLE appareils (
    id VARCHAR(36) PRIMARY KEY,
    hostname VARCHAR(255),
    ipAddress VARCHAR(45),
    macAddress VARCHAR(45),
    os VARCHAR(100),
    deviceType VARCHAR(100),
    stats JSON,
    lastSeen DATETIME,
    firstDiscovered DATETIME,
    createAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE journaux (
    id VARCHAR(36) PRIMARY KEY,
    deviceId VARCHAR(36),
    port INT,
    protocol VARCHAR(20),
    timestamp DATETIME,
    rawData JSON,
    parsedData JSON,
    logType VARCHAR(100),
    severity VARCHAR(50),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deviceId) REFERENCES appareils(id) ON DELETE CASCADE
);

CREATE TABLE statistiques_reseau (
    id VARCHAR(36) PRIMARY KEY,
    deviceId VARCHAR(36),
    bandwidth FLOAT,
    latency FLOAT,
    packetLoss FLOAT,
    cpuUsage FLOAT,
    memoryUsage FLOAT,
    timestamp DATETIME,
    intervalLabel VARCHAR(50),
    FOREIGN KEY (deviceId) REFERENCES appareils(id) ON DELETE CASCADE
);

CREATE TABLE topologie_reseau (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME,
    data JSON,
    isActive BOOLEAN
);

CREATE TABLE configuration_agent (
    id VARCHAR(36) PRIMARY KEY,
    agentType VARCHAR(100),
    deviceId VARCHAR(36),
    config JSON,
    intervalLabel VARCHAR(50),
    isActive BOOLEAN,
    lastExecutedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME,
    FOREIGN KEY (deviceId) REFERENCES appareils(id) ON DELETE CASCADE
);

CREATE TABLE analyse_modele (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255),
    type VARCHAR(100),
    algorithm VARCHAR(100),
    status VARCHAR(50),
    trainingDataSource VARCHAR(255),
    accuracy FLOAT,
    lastTrainedAt DATETIME,
    parameters JSON
);

CREATE TABLE parametres (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100),
    category VARCHAR(100),
    value VARCHAR(255),
    description TEXT,
    isSystem BOOLEAN,
    updatedAt DATETIME,
    updatedByUserId VARCHAR(36),
    FOREIGN KEY (updatedByUserId) REFERENCES utilisateur(id)
);

CREATE TABLE seuils_alerte (
    id VARCHAR(36) PRIMARY KEY,
    metricName VARCHAR(100),
    threshold FLOAT,
    `condition` VARCHAR(50),
    severity VARCHAR(50),
    isActive BOOLEAN,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME
);

CREATE TABLE anomalies (
    id VARCHAR(36) PRIMARY KEY,
    deviceId VARCHAR(36),
    logId VARCHAR(36),
    severity VARCHAR(50),
    description TEXT,
    anomalyType VARCHAR(100),
    detectedAt DATETIME,
    isConfirmed BOOLEAN,
    resolvedAt DATETIME,
    assignedToUserId VARCHAR(36),
    FOREIGN KEY (deviceId) REFERENCES appareils(id),
    FOREIGN KEY (logId) REFERENCES journaux(id),
    FOREIGN KEY (assignedToUserId) REFERENCES utilisateur(id)
);

CREATE TABLE alertes (
    id VARCHAR(36) PRIMARY KEY,
    anomalyId VARCHAR(36),
    status VARCHAR(50),
    priority VARCHAR(50),
    triggeredAt DATETIME,
    resolvedAt DATETIME,
    resolutionNotes TEXT,
    notified BOOLEAN,
    FOREIGN KEY (anomalyId) REFERENCES anomalies(id)
);

CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36),
    alertId VARCHAR(36),
    message TEXT,
    link VARCHAR(255),
    isRead BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    readAt DATETIME,
    notificationType VARCHAR(50),
    FOREIGN KEY (userId) REFERENCES utilisateur(id),
    FOREIGN KEY (alertId) REFERENCES alertes(id)
);

CREATE TABLE historiques (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36),
    action VARCHAR(100),
    targetType VARCHAR(100),
    targetId VARCHAR(36),
    timestamp DATETIME,
    detail TEXT,
    ipAddress VARCHAR(45),
    FOREIGN KEY (userId) REFERENCES utilisateur(id)
);

CREATE TABLE retours (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36),
    alertId VARCHAR(36),
    message TEXT,
    isTruePositive BOOLEAN,
    actionTaken TEXT,
    comment TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES utilisateur(id),
    FOREIGN KEY (alertId) REFERENCES alertes(id)
); 