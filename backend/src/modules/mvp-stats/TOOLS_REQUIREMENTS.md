# 🛠️ OUTILS REQUIS POUR LA COLLECTE DES STATISTIQUES MVP

## 📋 **RÉSUMÉ EXÉCUTIF**

Le module MVP Stats utilise une stratégie de collecte hybride combinant des outils Windows natifs et des outils tiers pour maximiser la précision et la fiabilité des données collectées.

## 🔧 **OUTILS NATIFS WINDOWS (OBLIGATOIRES)**

### **1. PowerShell (Inclus par défaut)**
- **Version minimale** : PowerShell 5.1 ou PowerShell Core 6+
- **Vérification** : `$PSVersionTable.PSVersion`
- **Utilisation** : Exécution de commandes système et collecte de métriques

### **2. Commandes Réseau (Incluses par défaut)**
- **Ping** : Test de connectivité et mesure de latence
- **Get-NetAdapter** : Informations sur les interfaces réseau
- **Get-NetAdapterStatistics** : Statistiques de trafic réseau
- **Get-Counter** : Métriques de performance système
- **Get-WmiObject** : Informations système détaillées

### **3. Commandes Système (Incluses par défaut)**
- **wmic** : Windows Management Instrumentation
- **netstat** : Statistiques de connexions réseau
- **tasklist** : Liste des processus en cours

## 🚀 **OUTILS TIERS (RECOMMANDÉS)**

### **1. Iperf3 - Test de Bande Passante**
- **Version** : 3.x
- **Installation** : `choco install iperf3`
- **URL** : https://iperf.fr/iperf-download.php
- **Utilisation** : Mesure précise de la bande passante
- **Avantages** : Précision élevée, support UDP/TCP, tests bidirectionnels

### **2. Nmap - Découverte et Analyse Réseau**
- **Version** : 7.x+
- **Installation** : `choco install nmap`
- **URL** : https://nmap.org/download.html
- **Utilisation** : Découverte d'appareils, analyse de ports, détection de services
- **Avantages** : Découverte automatique, analyse de vulnérabilités

### **3. SNMP Tools - Gestion Réseau**
- **Installation** : `choco install snmp-tools`
- **Utilisation** : Collecte de données SNMP des équipements réseau
- **Avantages** : Standard industriel, données structurées

## 📦 **DÉPENDANCES NODE.JS**

### **Dépendances Principales**
```bash
npm install axios        # Requêtes HTTP
npm install uuid         # Génération d'identifiants uniques
npm install moment       # Gestion des dates et heures
npm install winston      # Logging avancé
```

### **Dépendances de Développement**
```bash
npm install --save-dev @types/node    # Types TypeScript pour Node.js
npm install --save-dev @types/uuid    # Types TypeScript pour UUID
```

## 🔄 **STRATÉGIE DE COLLECTE HYBRIDE**

### **Priorité 1 : Outils Tiers (Haute Précision)**
1. **Iperf3** : Bande passante, latence, jitter
2. **Nmap** : Découverte d'appareils, analyse de ports
3. **SNMP** : Métriques système des équipements réseau

### **Priorité 2 : Outils Windows Natifs (Fallback)**
1. **PowerShell** : CPU, mémoire, processus
2. **Ping** : Latence de base
3. **Get-NetAdapter** : Statistiques réseau

### **Priorité 3 : Estimation (Dernier Recours)**
1. **Calculs basés sur les données disponibles**
2. **Interpolation de données historiques**
3. **Valeurs par défaut sécurisées**

## 📊 **MÉTRIQUES COLLECTÉES PAR OUTIL**

### **Iperf3**
- ✅ Bande passante download/upload (Mbps)
- ✅ Latence (ms)
- ✅ Jitter (ms)
- ✅ Perte de paquets (%)

### **Nmap**
- ✅ Découverte d'appareils
- ✅ Services actifs
- ✅ Système d'exploitation détecté
- ✅ Temps de réponse

### **SNMP**
- ✅ Utilisation CPU (%)
- ✅ Utilisation mémoire (%)
- ✅ Trafic réseau (bytes)
- ✅ Température (si supportée)

### **PowerShell**
- ✅ Utilisation CPU (%)
- ✅ Utilisation mémoire (MB)
- ✅ Processus actifs
- ✅ Services système

### **Ping**
- ✅ Latence de base (ms)
- ✅ Disponibilité de l'appareil
- ✅ Temps de réponse

## ⚙️ **CONFIGURATION DES OUTILS**

### **Iperf3 Configuration**
```bash
# Test de bande passante
iperf3 -c [TARGET_IP] -t 10 -i 1

# Test de latence
iperf3 -c [TARGET_IP] -t 5 -i 0.5 -u -b 1M

# Test bidirectionnel
iperf3 -c [TARGET_IP] -t 10 -d
```

### **Nmap Configuration**
```bash
# Scan rapide
nmap -sn [NETWORK_RANGE]

# Scan de ports
nmap -p 80,443,22,3389 [TARGET_IP]

# Détection OS
nmap -O [TARGET_IP]
```

### **SNMP Configuration**
```bash
# Requête CPU
snmpget -v2c -c public [TARGET_IP] .1.3.6.1.2.1.25.3.3.1.2.1

# Requête mémoire
snmpget -v2c -c public [TARGET_IP] .1.3.6.1.2.1.25.2.3.1.6.1
```

## 🔍 **VÉRIFICATION DE L'INSTALLATION**

### **Script de Vérification**
```powershell
# Exécuter le script d'installation
.\install-mvp-stats.ps1
```

### **Vérification Manuelle**
```bash
# Vérifier Iperf3
iperf3 --version

# Vérifier Nmap
nmap --version

# Vérifier SNMP
snmpget --version

# Vérifier PowerShell
$PSVersionTable.PSVersion
```

## 🚨 **DÉPANNAGE**

### **Problèmes Courants**

#### **1. Iperf3 non trouvé**
```bash
# Solution : Ajouter au PATH
set PATH=%PATH%;C:\iperf3
```

#### **2. Nmap bloqué par le pare-feu**
```bash
# Solution : Autoriser dans Windows Defender
# Ajouter une exception pour nmap.exe
```

#### **3. SNMP non configuré**
```bash
# Solution : Activer les fonctionnalités SNMP
# Panneau de configuration > Programmes > Fonctionnalités Windows
```

#### **4. Permissions PowerShell**
```bash
# Solution : Exécuter en tant qu'administrateur
# Ou modifier la politique d'exécution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📈 **PERFORMANCE ET OPTIMISATION**

### **Recommandations**
1. **Limiter les scans simultanés** : Max 5 appareils en parallèle
2. **Timeouts appropriés** : 30s pour Iperf3, 10s pour Nmap
3. **Cache des résultats** : 5 minutes pour éviter la surcharge
4. **Logs détaillés** : Winston pour le debugging

### **Monitoring**
- **Utilisation CPU** : < 20% pendant la collecte
- **Utilisation mémoire** : < 500MB pour le processus
- **Temps de collecte** : < 60s par appareil
- **Taux de succès** : > 90% des appareils

## 🔐 **SÉCURITÉ**

### **Bonnes Pratiques**
1. **Utiliser des comptes dédiés** pour SNMP
2. **Limiter les privilèges** des outils tiers
3. **Auditer les logs** régulièrement
4. **Mettre à jour** les outils tiers

### **Risques**
- **Détection par les IDS** : Nmap peut déclencher des alertes
- **Surcharge réseau** : Iperf3 peut saturer la bande passante
- **Accès non autorisé** : SNMP mal configuré

## 📚 **RESSOURCES ADDITIONNELLES**

### **Documentation Officielle**
- [Iperf3 Documentation](https://iperf.fr/iperf-doc.php)
- [Nmap Documentation](https://nmap.org/docs.html)
- [SNMP RFC](https://tools.ietf.org/html/rfc3411)

### **Tutoriels**
- [Installation Chocolatey](https://chocolatey.org/install)
- [Configuration SNMP Windows](https://docs.microsoft.com/en-us/windows-server/networking/technologies/snmp/snmp-service)
- [PowerShell Best Practices](https://docs.microsoft.com/en-us/powershell/scripting/overview)

---

**Note** : Ce document doit être mis à jour lors de l'ajout de nouveaux outils ou de modifications de la stratégie de collecte. 