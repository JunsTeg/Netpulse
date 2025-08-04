# =====================================================
# SCRIPT D'INSTALLATION MVP STATS - Outils de Collecte
# Date: 2025-01-27
# Description: Installation des outils requis pour la collecte de statistiques
# =====================================================

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "INSTALLATION DES OUTILS MVP STATS" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# =====================================================
# ÉTAPE 1: VÉRIFICATION DES PRÉREQUIS
# =====================================================

Write-Host "`n[1/6] Vérification des prérequis..." -ForegroundColor Yellow

# Vérifier PowerShell version
$psVersion = $PSVersionTable.PSVersion
Write-Host "PowerShell Version: $psVersion" -ForegroundColor Green

# Vérifier Node.js
try {
    $nodeVersion = node --version
    Write-Host "Node.js Version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js non trouvé. Veuillez installer Node.js depuis https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Vérifier npm
try {
    $npmVersion = npm --version
    Write-Host "npm Version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm non trouvé. Veuillez installer npm." -ForegroundColor Red
    exit 1
}

# Vérifier Git
try {
    $gitVersion = git --version
    Write-Host "Git Version: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Git non trouvé. Recommandé pour le versioning." -ForegroundColor Yellow
}

# =====================================================
# ÉTAPE 2: VÉRIFICATION DES OUTILS NATIFS WINDOWS
# =====================================================

Write-Host "`n[2/6] Vérification des outils Windows natifs..." -ForegroundColor Yellow

# Vérifier Ping
try {
    ping -n 1 127.0.0.1 | Out-Null
    Write-Host "✅ Ping: Disponible" -ForegroundColor Green
} catch {
    Write-Host "❌ Ping: Non disponible" -ForegroundColor Red
}

# Vérifier PowerShell cmdlets
try {
    Get-NetAdapter | Out-Null
    Write-Host "✅ Get-NetAdapter: Disponible" -ForegroundColor Green
} catch {
    Write-Host "❌ Get-NetAdapter: Non disponible" -ForegroundColor Red
}

try {
    Get-Counter | Out-Null
    Write-Host "✅ Get-Counter: Disponible" -ForegroundColor Green
} catch {
    Write-Host "❌ Get-Counter: Non disponible" -ForegroundColor Red
}

try {
    Get-WmiObject -Class Win32_Processor | Out-Null
    Write-Host "✅ Get-WmiObject: Disponible" -ForegroundColor Green
} catch {
    Write-Host "❌ Get-WmiObject: Non disponible" -ForegroundColor Red
}

# =====================================================
# ÉTAPE 3: INSTALLATION DE CHOCOLATEY (SI NÉCESSAIRE)
# =====================================================

Write-Host "`n[3/6] Vérification de Chocolatey..." -ForegroundColor Yellow

try {
    choco --version | Out-Null
    Write-Host "✅ Chocolatey: Déjà installé" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Chocolatey: Installation en cours..." -ForegroundColor Yellow
    
    $installChoco = Read-Host "Installer Chocolatey ? (y/n)"
    if ($installChoco -eq 'y' -or $installChoco -eq 'Y') {
        Write-Host "Installation de Chocolatey..." -ForegroundColor Cyan
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        Write-Host "✅ Chocolatey: Installé avec succès" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Chocolatey: Installation ignorée. Les outils tiers devront être installés manuellement." -ForegroundColor Yellow
    }
}

# =====================================================
# ÉTAPE 4: INSTALLATION DES OUTILS TIERS
# =====================================================

Write-Host "`n[4/6] Installation des outils tiers..." -ForegroundColor Yellow

# Fonction pour installer un outil
function Install-Tool {
    param(
        [string]$ToolName,
        [string]$ChocoPackage,
        [string]$ManualUrl,
        [string]$TestCommand
    )
    
    Write-Host "Vérification de $ToolName..." -ForegroundColor Cyan
    
    try {
        & $TestCommand | Out-Null
        Write-Host "✅ $ToolName: Déjà installé" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ $ToolName: Non trouvé" -ForegroundColor Red
        
        $installTool = Read-Host "Installer $ToolName ? (y/n)"
        if ($installTool -eq 'y' -or $installTool -eq 'Y') {
            try {
                choco install $ChocoPackage -y
                Write-Host "✅ $ToolName: Installé avec succès" -ForegroundColor Green
                return $true
            } catch {
                Write-Host "❌ Échec de l'installation automatique de $ToolName" -ForegroundColor Red
                Write-Host "📥 Installation manuelle: $ManualUrl" -ForegroundColor Yellow
                return $false
            }
        } else {
            Write-Host "⚠️ $ToolName: Installation ignorée" -ForegroundColor Yellow
            return $false
        }
    }
}

# Installation des outils
$tools = @(
    @{
        Name = "Iperf3"
        ChocoPackage = "iperf3"
        ManualUrl = "https://iperf.fr/iperf-download.php"
        TestCommand = "iperf3"
    },
    @{
        Name = "Nmap"
        ChocoPackage = "nmap"
        ManualUrl = "https://nmap.org/download.html"
        TestCommand = "nmap"
    },
    @{
        Name = "SNMP Tools"
        ChocoPackage = "snmp-tools"
        ManualUrl = "Activer les fonctionnalités SNMP dans Windows"
        TestCommand = "snmpget"
    }
)

$installedTools = @()
foreach ($tool in $tools) {
    if (Install-Tool -ToolName $tool.Name -ChocoPackage $tool.ChocoPackage -ManualUrl $tool.ManualUrl -TestCommand $tool.TestCommand) {
        $installedTools += $tool.Name
    }
}

# =====================================================
# ÉTAPE 5: CONFIGURATION DES VARIABLES D'ENVIRONNEMENT
# =====================================================

Write-Host "`n[5/6] Configuration des variables d'environnement..." -ForegroundColor Yellow

# Ajouter les outils au PATH si nécessaire
$toolsPaths = @(
    "C:\iperf3",
    "C:\Program Files (x86)\Nmap",
    "C:\Program Files\Nmap"
)

$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$pathUpdated = $false

foreach ($path in $toolsPaths) {
    if (Test-Path $path) {
        if ($currentPath -notlike "*$path*") {
            $currentPath += ";$path"
            $pathUpdated = $true
            Write-Host "✅ Ajouté au PATH: $path" -ForegroundColor Green
        }
    }
}

if ($pathUpdated) {
    [Environment]::SetEnvironmentVariable("PATH", $currentPath, "User")
    Write-Host "✅ Variables d'environnement mises à jour" -ForegroundColor Green
    Write-Host "⚠️ Redémarrez votre terminal pour que les changements prennent effet" -ForegroundColor Yellow
}

# =====================================================
# ÉTAPE 6: INSTALLATION DES DÉPENDANCES NODE.JS
# =====================================================

Write-Host "`n[6/6] Installation des dépendances Node.js..." -ForegroundColor Yellow

# Vérifier si on est dans le bon répertoire
if (Test-Path "backend\package.json") {
    Write-Host "Installation des dépendances backend..." -ForegroundColor Cyan
    Set-Location backend
    npm install
    
    # Installation des dépendances spécifiques MVP
    Write-Host "Installation des dépendances MVP..." -ForegroundColor Cyan
    npm install axios uuid moment winston
    npm install --save-dev @types/node @types/uuid
    
    Write-Host "✅ Dépendances Node.js installées" -ForegroundColor Green
} else {
    Write-Host "⚠️ Répertoire backend non trouvé. Veuillez exécuter ce script depuis la racine du projet." -ForegroundColor Yellow
}

# =====================================================
# RÉSUMÉ DE L'INSTALLATION
# =====================================================

Write-Host "`n=====================================================" -ForegroundColor Cyan
Write-Host "RÉSUMÉ DE L'INSTALLATION" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

Write-Host "`n✅ Outils natifs Windows:" -ForegroundColor Green
Write-Host "   - PowerShell (v$psVersion)"
Write-Host "   - Ping"
Write-Host "   - Get-NetAdapter"
Write-Host "   - Get-Counter"
Write-Host "   - Get-WmiObject"

Write-Host "`n✅ Outils tiers installés:" -ForegroundColor Green
foreach ($tool in $installedTools) {
    Write-Host "   - $tool"
}

if ($installedTools.Count -eq 0) {
    Write-Host "   - Aucun outil tiers installé" -ForegroundColor Yellow
}

Write-Host "`n✅ Dépendances Node.js:" -ForegroundColor Green
Write-Host "   - axios (requêtes HTTP)"
Write-Host "   - uuid (génération d'identifiants)"
Write-Host "   - moment (gestion des dates)"
Write-Host "   - winston (logging)"

Write-Host "`n📋 PROCHAINES ÉTAPES:" -ForegroundColor Cyan
Write-Host "1. Redémarrez votre terminal pour les variables d'environnement"
Write-Host "2. Exécutez la migration SQL: mysql/migrations/mvp_stats_schema_update.sql"
Write-Host "3. Démarrez le backend: npm run start:dev"
Write-Host "4. Testez la collecte via l'interface web"

Write-Host "`n🎉 Installation terminée avec succès!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan 