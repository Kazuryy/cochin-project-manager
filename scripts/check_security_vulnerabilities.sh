#!/bin/bash

# 🛡️ Script de vérification des vulnérabilités de sécurité
# Utilise Trivy pour scanner les images Docker locales

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-finnick5}"
BACKEND_IMAGE="${DOCKERHUB_USERNAME}/cochin-project-manager-backend"
FRONTEND_IMAGE="${DOCKERHUB_USERNAME}/cochin-project-manager-frontend"
TAG="${1:-dev}"

echo -e "${BLUE}🛡️ Vérification des vulnérabilités de sécurité${NC}"
echo "========================================================"

# Vérifier si Trivy est installé
if ! command -v trivy &> /dev/null; then
    echo -e "${YELLOW}⚠️ Trivy n'est pas installé. Installation en cours...${NC}"
    
    # Installation selon l'OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install trivy
        else
            echo -e "${RED}❌ Homebrew requis pour installer Trivy sur macOS${NC}"
            echo "Installation: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    else
        echo -e "${RED}❌ OS non supporté pour l'installation automatique de Trivy${NC}"
        echo "Voir: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
        exit 1
    fi
fi

# Fonction pour scanner une image
scan_image() {
    local image_name="$1"
    local image_tag="$2"
    local full_image="${image_name}:${image_tag}"
    
    echo -e "\n${BLUE}🔍 Scan de sécurité: ${full_image}${NC}"
    echo "----------------------------------------"
    
    # Vérifier si l'image existe localement
    if ! docker image inspect "$full_image" &> /dev/null; then
        echo -e "${YELLOW}⚠️ Image non trouvée localement. Tentative de pull...${NC}"
        if ! docker pull "$full_image" 2>/dev/null; then
            echo -e "${RED}❌ Impossible de récupérer l'image ${full_image}${NC}"
            return 1
        fi
    fi
    
    # Scan avec Trivy
    echo -e "${BLUE}📊 Analyse des vulnérabilités...${NC}"
    
    # Scan complet avec détails
    trivy image \
        --severity HIGH,CRITICAL \
        --format table \
        --no-progress \
        "$full_image"
    
    # Compter les vulnérabilités critiques
    local critical_count=$(trivy image --severity CRITICAL --format json --quiet "$full_image" 2>/dev/null | jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL") | .VulnerabilityID' | wc -l || echo "0")
    local high_count=$(trivy image --severity HIGH --format json --quiet "$full_image" 2>/dev/null | jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH") | .VulnerabilityID' | wc -l || echo "0")
    
    echo -e "\n${BLUE}📈 Résumé pour ${full_image}:${NC}"
    echo "  • Vulnérabilités CRITIQUES: ${critical_count}"
    echo "  • Vulnérabilités ÉLEVÉES: ${high_count}"
    
    if [ "$critical_count" -gt 0 ]; then
        echo -e "${RED}❌ Vulnérabilités CRITIQUES détectées !${NC}"
        
        # Détail des vulnérabilités critiques
        echo -e "\n${RED}🚨 VULNÉRABILITÉS CRITIQUES:${NC}"
        trivy image --severity CRITICAL --format json --quiet "$full_image" 2>/dev/null | \
            jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL") | "  • \(.VulnerabilityID): \(.PkgName) (\(.InstalledVersion)) - \(.Title)"' 2>/dev/null || \
            echo "  Erreur lors de l'extraction des détails"
        
        return 1
    elif [ "$high_count" -gt 0 ]; then
        echo -e "${YELLOW}⚠️ Vulnérabilités ÉLEVÉES détectées${NC}"
        return 2
    else
        echo -e "${GREEN}✅ Aucune vulnérabilité critique ou élevée${NC}"
        return 0
    fi
}

# Fonction principale
main() {
    local exit_code=0
    
    echo -e "${BLUE}🐳 Images à analyser:${NC}"
    echo "  • Backend: ${BACKEND_IMAGE}:${TAG}"
    echo "  • Frontend: ${FRONTEND_IMAGE}:${TAG}"
    echo ""
    
    # Scanner l'image backend
    if scan_image "$BACKEND_IMAGE" "$TAG"; then
        echo -e "${GREEN}✅ Backend: Scan OK${NC}"
    else
        local backend_result=$?
        if [ $backend_result -eq 1 ]; then
            echo -e "${RED}❌ Backend: Vulnérabilités CRITIQUES${NC}"
            exit_code=1
        else
            echo -e "${YELLOW}⚠️ Backend: Vulnérabilités ÉLEVÉES${NC}"
            [ $exit_code -eq 0 ] && exit_code=2
        fi
    fi
    
    # Scanner l'image frontend
    if scan_image "$FRONTEND_IMAGE" "$TAG"; then
        echo -e "${GREEN}✅ Frontend: Scan OK${NC}"
    else
        local frontend_result=$?
        if [ $frontend_result -eq 1 ]; then
            echo -e "${RED}❌ Frontend: Vulnérabilités CRITIQUES${NC}"
            exit_code=1
        else
            echo -e "${YELLOW}⚠️ Frontend: Vulnérabilités ÉLEVÉES${NC}"
            [ $exit_code -eq 0 ] && exit_code=2
        fi
    fi
    
    # Résumé final
    echo ""
    echo "========================================================"
    case $exit_code in
        0)
            echo -e "${GREEN}🎉 SUCCÈS: Aucune vulnérabilité critique détectée${NC}"
            ;;
        1)
            echo -e "${RED}🚨 ÉCHEC: Vulnérabilités CRITIQUES détectées${NC}"
            echo -e "${YELLOW}Action requise: Mettre à jour les images Docker${NC}"
            ;;
        2)
            echo -e "${YELLOW}⚠️ ATTENTION: Vulnérabilités ÉLEVÉES détectées${NC}"
            echo -e "${YELLOW}Recommandation: Mettre à jour dès que possible${NC}"
            ;;
    esac
    
    return $exit_code
}

# Vérifier les arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [TAG]"
    echo ""
    echo "Options:"
    echo "  TAG     Tag des images à scanner (défaut: dev)"
    echo ""
    echo "Variables d'environnement:"
    echo "  DOCKERHUB_USERNAME    Nom d'utilisateur Docker Hub (défaut: finnick5)"
    echo ""
    echo "Exemples:"
    echo "  $0                    # Scan des images :dev"
    echo "  $0 latest             # Scan des images :latest"
    echo "  $0 v1.0.0             # Scan des images :v1.0.0"
    exit 0
fi

# Exécuter le scan
main "$@" 