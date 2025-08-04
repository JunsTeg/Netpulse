# Script d'installation du module MVP Stats
# Ce script automatise l'installation et la configuration du module MVP Stats

param(
    [switch]$SkipTools,
    [switch]$Force,
    [string]$ConfigPath = ".\mvp-config.json"
)

Write-Host "=== INSTALLATION MODULE MVP STATS ===" -ForegroundColor Green
Write-Host "Version: 1.0.0" -ForegroundColor Yellow
Write-Host "Date: $(Get-Date)" -ForegroundColor Yellow
Write-Host ""

# Fonction pour afficher les messages d'erreur
function Write-Error {
    param([string]$Message)
    Write-Host "❌ ERREUR: $Message" -ForegroundColor Red
}

# Fonction pour afficher les messages de succès
function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

# Fonction pour afficher les messages d'information
function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

# Fonction pour afficher les messages d'avertissement
function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

# Vérification des prérequis
Write-Info "Vérification des prérequis..."

# Vérifier Node.js
try {
    $nodeVersion = node --version
    Write-Success "Node.js détecté: $nodeVersion"
} catch {
    Write-Error "Node.js n'est pas installé ou n'est pas dans le PATH"
    Write-Info "Veuillez installer Node.js depuis https://nodejs.org/"
    exit 1
}

# Vérifier npm
try {
    $npmVersion = npm --version
    Write-Success "npm détecté: $npmVersion"
} catch {
    Write-Error "npm n'est pas installé ou n'est pas dans le PATH"
    exit 1
}

# Vérifier PowerShell version
$psVersion = $PSVersionTable.PSVersion
if ($psVersion.Major -lt 5) {
    Write-Warning "PowerShell 5.0+ recommandé. Version actuelle: $psVersion"
} else {
    Write-Success "PowerShell version: $psVersion"
}

Write-Host ""

# Installation des outils tiers (optionnel)
if (-not $SkipTools) {
    Write-Info "Installation des outils tiers recommandés..."
    
    # Vérifier si winget est disponible
    try {
        winget --version | Out-Null
        Write-Success "winget détecté"
        
        # Installer Iperf3
        Write-Info "Installation d'Iperf3..."
        try {
            winget install iperf3 --accept-source-agreements --accept-package-agreements
            Write-Success "Iperf3 installé avec succès"
        } catch {
            Write-Warning "Échec de l'installation d'Iperf3: $($_.Exception.Message)"
        }
        
        # Installer Nmap
        Write-Info "Installation de Nmap..."
        try {
            winget install nmap --accept-source-agreements --accept-package-agreements
            Write-Success "Nmap installé avec succès"
        } catch {
            Write-Warning "Échec de l'installation de Nmap: $($_.Exception.Message)"
        }
        
        # Installer Wireshark (optionnel)
        Write-Info "Installation de Wireshark (optionnel)..."
        try {
            winget install wireshark --accept-source-agreements --accept-package-agreements
            Write-Success "Wireshark installé avec succès"
        } catch {
            Write-Warning "Échec de l'installation de Wireshark: $($_.Exception.Message)"
        }
        
    } catch {
        Write-Warning "winget non disponible. Installation manuelle requise."
        Write-Info "Veuillez installer manuellement:"
        Write-Info "  - Iperf3: https://iperf.fr/iperf-download.php"
        Write-Info "  - Nmap: https://nmap.org/download.html"
        Write-Info "  - Wireshark: https://www.wireshark.org/download.html"
    }
} else {
    Write-Info "Installation des outils tiers ignorée"
}

Write-Host ""

# Vérification de la structure du projet
Write-Info "Vérification de la structure du projet..."

$requiredFiles = @(
    "src\modules\mvp-stats\mvp-stats.module.ts",
    "src\modules\mvp-stats\mvp-stats.service.ts",
    "src\modules\mvp-stats\mvp-stats.controller.ts",
    "src\modules\mvp-stats\mvp-stats.types.ts",
    "src\modules\mvp-stats\services\mvp-device-collector.service.ts",
    "src\modules\mvp-stats\services\mvp-data-processor.service.ts",
    "src\modules\mvp-stats\services\mvp-anomaly-detector.service.ts",
    "src\modules\mvp-stats\services\mvp-response-formatter.service.ts",
    "src\modules\mvp-stats\repositories\mvp-stats.repository.ts",
    "src\modules\mvp-stats\README.md"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Success "Fichier trouvé: $file"
    } else {
        Write-Error "Fichier manquant: $file"
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Error "Certains fichiers requis sont manquants. Installation incomplète."
    exit 1
}

Write-Host ""

# Création de la configuration par défaut
Write-Info "Création de la configuration par défaut..."

$defaultConfig = @{
    timeout = 30000
    retries = 2
    parallelCollectors = 5
    useIperf3 = $true
    useNmap = $true
    anomalyThresholds = @{
        cpu = 80
        memory = 1000
        bandwidth = 1
        latency = 100
    }
}

try {
    $defaultConfig | ConvertTo-Json -Depth 3 | Out-File -FilePath $ConfigPath -Encoding UTF8
    Write-Success "Configuration créée: $ConfigPath"
} catch {
    Write-Warning "Impossible de créer la configuration: $($_.Exception.Message)"
}

Write-Host ""

# Vérification des dépendances npm
Write-Info "Vérification des dépendances npm..."

$requiredDependencies = @(
    "@nestjs/common",
    "@nestjs/core",
    "sequelize",
    "uuid"
)

$packageJson = Get-Content "package.json" | ConvertFrom-Json
$installedDependencies = $packageJson.dependencies.PSObject.Properties.Name

$missingDependencies = @()
foreach ($dep in $requiredDependencies) {
    if ($installedDependencies -contains $dep) {
        Write-Success "Dépendance trouvée: $dep"
    } else {
        Write-Warning "Dépendance manquante: $dep"
        $missingDependencies += $dep
    }
}

if ($missingDependencies.Count -gt 0) {
    Write-Info "Installation des dépendances manquantes..."
    try {
        npm install $missingDependencies
        Write-Success "Dépendances installées avec succès"
    } catch {
        Write-Error "Échec de l'installation des dépendances: $($_.Exception.Message)"
    }
}

Write-Host ""

# Test de compilation TypeScript
Write-Info "Test de compilation TypeScript..."

try {
    npx tsc --noEmit
    Write-Success "Compilation TypeScript réussie"
} catch {
    Write-Error "Erreurs de compilation TypeScript détectées"
    Write-Info "Veuillez corriger les erreurs avant de continuer"
    exit 1
}

Write-Host ""

# Création du script de test
Write-Info "Création du script de test..."

$testScript = @"
# Script de test pour le module MVP Stats
Write-Host "=== TEST MODULE MVP STATS ===" -ForegroundColor Green

# Test de santé du module
Write-Host "Test de santé du module..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mvp-stats/health" -Method GET
    Write-Host "✅ Module MVP Stats opérationnel" -ForegroundColor Green
    Write-Host "Version: $($response.version)" -ForegroundColor Yellow
    Write-Host "Status: $($response.status)" -ForegroundColor Yellow
} catch {
    Write-Host "❌ Module MVP Stats non accessible" -ForegroundColor Red
    Write-Host "Assurez-vous que l'application est démarrée" -ForegroundColor Yellow
}

# Test de configuration
Write-Host "`nTest de configuration..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mvp-stats/config" -Method GET
    Write-Host "✅ Configuration accessible" -ForegroundColor Green
    Write-Host "Timeout: $($response.data.timeout)ms" -ForegroundColor Yellow
    Write-Host "Collecteurs parallèles: $($response.data.parallelCollectors)" -ForegroundColor Yellow
} catch {
    Write-Host "❌ Configuration non accessible" -ForegroundColor Red
}

Write-Host "`nTest terminé" -ForegroundColor Green
"@

try {
    $testScript | Out-File -FilePath "test-mvp-stats.ps1" -Encoding UTF8
    Write-Success "Script de test créé: test-mvp-stats.ps1"
} catch {
    Write-Warning "Impossible de créer le script de test: $($_.Exception.Message)"
}

Write-Host ""

# Instructions finales
Write-Host "=== INSTALLATION TERMINÉE ===" -ForegroundColor Green
Write-Host ""
Write-Host "📋 PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. Intégrer le module dans app.module.ts:" -ForegroundColor White
Write-Host "   import { MvpStatsModule } from './modules/mvp-stats/mvp-stats.module';" -ForegroundColor Gray
Write-Host "   @Module({ imports: [MvpStatsModule] })" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Démarrer l'application:" -ForegroundColor White
Write-Host "   npm run start:dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Tester le module:" -ForegroundColor White
Write-Host "   .\test-mvp-stats.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Consulter la documentation:" -ForegroundColor White
Write-Host "   src\modules\mvp-stats\README.md" -ForegroundColor Gray
Write-Host ""
Write-Host "🔗 ENDPOINTS DISPONIBLES:" -ForegroundColor Yellow
Write-Host "• POST /api/mvp-stats/collect     - Collecte de statistiques" -ForegroundColor Gray
Write-Host "• GET  /api/mvp-stats/recent      - Statistiques récentes" -ForegroundColor Gray
Write-Host "• GET  /api/mvp-stats/dashboard   - Tableau de bord" -ForegroundColor Gray
Write-Host "• GET  /api/mvp-stats/health      - Santé du module" -ForegroundColor Gray
Write-Host ""
Write-Host "📁 FICHIERS CRÉÉS:" -ForegroundColor Yellow
Write-Host "• $ConfigPath" -ForegroundColor Gray
Write-Host "• test-mvp-stats.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Installation réussie!" -ForegroundColor Green 