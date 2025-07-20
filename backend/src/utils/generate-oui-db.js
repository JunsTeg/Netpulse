const fs = require('fs');
const path = require('path');

const ouiTxtPath = path.resolve(__dirname, 'oui.txt');
const outputPath = path.resolve(__dirname, 'oui-db.json');

const content = fs.readFileSync(ouiTxtPath, 'utf-8');
const lines = content.split(/\r?\n/);
const ouiDb = {};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Cherche les lignes du type XX-XX-XX   (hex)    Vendor
  const match = line.match(/^([0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2})\s+\(hex\)\s+(.+)$/);
  if (match) {
    const oui = match[1].toUpperCase().replace(/-/g, ':');
    const vendor = match[2].trim();
    ouiDb[oui] = vendor;
  }
}

fs.writeFileSync(outputPath, JSON.stringify(ouiDb, null, 2), 'utf-8');
console.log(`Fichier oui-db.json généré avec ${Object.keys(ouiDb).length} entrées.`); 