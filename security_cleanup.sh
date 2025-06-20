#!/bin/bash
set -e

echo "🛡️ Script de nettoyage de sécurité - Cochin Project Manager"
echo "=========================================================="

# Configuration
DRY_RUN=${DRY_RUN:-false}
INTERACTIVE=${INTERACTIVE:-true}

if [ "$DRY_RUN" = true ]; then
    echo "🔍 MODE SIMULATION - Aucun fichier ne sera supprimé"
    echo ""
fi

# Fonction pour supprimer un fichier avec confirmation
remove_file() {
    local file=$1
    local reason=$2
    
    if [ -f "$file" ] || [ -d "$file" ]; then
        echo "🗑️  Fichier trouvé: $file"
        echo "   Raison: $reason"
        
        if [ "$DRY_RUN" = true ]; then
            echo "   [SIMULATION] Serait supprimé"
            return
        fi
        
        if [ "$INTERACTIVE" = true ]; then
            read -p "   Supprimer ? (o/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Oo]$ ]]; then
                echo "   ⏭️  Ignoré"
                return
            fi
        fi
        
        rm -rf "$file"
        echo "   ✅ Supprimé"
    fi
}

# Fonction pour déplacer un fichier
move_file() {
    local src=$1
    local dst_dir=$2
    local reason=$3
    
    if [ -f "$src" ]; then
        echo "📦 Fichier trouvé: $src"
        echo "   Raison: $reason"
        
        if [ "$DRY_RUN" = true ]; then
            echo "   [SIMULATION] Serait déplacé vers $dst_dir/"
            return
        fi
        
        if [ "$INTERACTIVE" = true ]; then
            read -p "   Déplacer vers $dst_dir/ ? (o/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Oo]$ ]]; then
                echo "   ⏭️  Ignoré"
                return
            fi
        fi
        
        mkdir -p "$dst_dir"
        mv "$src" "$dst_dir/"
        echo "   ✅ Déplacé vers $dst_dir/"
    fi
}

echo "🔍 Analyse des fichiers dangereux..."
echo ""

# 1. Fichiers CSV sensibles
echo "📄 FICHIERS CSV SENSIBLES"
echo "-------------------------"
remove_file "Feuille de calcul sans titre - Feuille1.csv" "Fichier CSV avec données potentiellement sensibles"

# 2. Fichiers système macOS
echo ""
echo "🍎 FICHIERS SYSTÈME MACOS"
echo "-------------------------"
remove_file "backend/.DS_Store" "Métadonnées système macOS"
remove_file ".DS_Store" "Métadonnées système macOS (racine)"

# Chercher tous les .DS_Store
echo "🔍 Recherche de tous les fichiers .DS_Store..."
if [ "$DRY_RUN" = false ]; then
    find . -name ".DS_Store" -type f -delete 2>/dev/null && echo "✅ Tous les .DS_Store supprimés" || echo "ℹ️  Aucun .DS_Store trouvé"
else
    ds_count=$(find . -name ".DS_Store" -type f | wc -l)
    echo "[SIMULATION] $ds_count fichiers .DS_Store seraient supprimés"
fi

# 3. Fichiers de base de données de développement
echo ""
echo "💾 BASE DE DONNÉES DE DÉVELOPPEMENT"
echo "-----------------------------------"
if [ -f "backend/db.sqlite3" ]; then
    echo "🗑️  Base de données trouvée: backend/db.sqlite3"
    echo "   Raison: Peut contenir des données sensibles de développement"
    
    if [ "$DRY_RUN" = true ]; then
        echo "   [SIMULATION] Serait sauvegardée puis nettoyée"
    else
        if [ "$INTERACTIVE" = true ]; then
            read -p "   Sauvegarder et nettoyer la DB ? (o/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Oo]$ ]]; then
                cp backend/db.sqlite3 backend/db.sqlite3.backup.$(date +%Y%m%d_%H%M%S)
                echo "" > backend/db.sqlite3
                echo "   ✅ DB sauvegardée et nettoyée"
            fi
        else
            cp backend/db.sqlite3 backend/db.sqlite3.backup.$(date +%Y%m%d_%H%M%S)
            echo "" > backend/db.sqlite3
            echo "   ✅ DB sauvegardée et nettoyée"
        fi
    fi
fi

# 4. Fichiers de test dangereux
echo ""
echo "🧪 FICHIERS DE TEST"
echo "-------------------"
remove_file "backend/test_backup.zip" "Archive de test potentiellement sensible"
remove_file "backend/test_backup.sql" "Dump SQL de test potentiellement sensible"

# 5. Scripts vides ou dangereux
echo ""
echo "📜 SCRIPTS DANGEREUX"
echo "--------------------"
remove_file "backend/scripts/cleanup.sh" "Script vide mais exécutable"

# 6. Déplacer les fichiers de test Python
echo ""
echo "🐍 SCRIPTS DE TEST PYTHON"
echo "-------------------------"
for test_file in backend/test_*.py; do
    if [ -f "$test_file" ]; then
        move_file "$test_file" "backend/tests" "Script de test à organiser"
    fi
done

# 7. Nettoyer les caches Python
echo ""
echo "🗄️  CACHE PYTHON"
echo "----------------"
echo "🔍 Recherche des caches Python..."
if [ "$DRY_RUN" = false ]; then
    # Supprimer __pycache__
    find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null && echo "✅ Dossiers __pycache__ supprimés" || echo "ℹ️  Aucun cache trouvé"
    # Supprimer .pyc
    find . -name "*.pyc" -delete 2>/dev/null && echo "✅ Fichiers .pyc supprimés" || echo "ℹ️  Aucun fichier .pyc trouvé"
else
    pycache_count=$(find . -name "__pycache__" -type d | wc -l)
    pyc_count=$(find . -name "*.pyc" | wc -l)
    echo "[SIMULATION] $pycache_count dossiers __pycache__ et $pyc_count fichiers .pyc seraient supprimés"
fi

# 8. Analyser les logs volumineux
echo ""
echo "📋 LOGS VOLUMINEUX"
echo "------------------"
if [ -d "backend/logs" ]; then
    large_logs=$(find backend/logs -name "*.log" -size +10M 2>/dev/null)
    if [ -n "$large_logs" ]; then
        echo "⚠️  Logs volumineux trouvés:"
        echo "$large_logs"
        
        if [ "$DRY_RUN" = true ]; then
            echo "[SIMULATION] Ces logs seraient archivés"
        else
            if [ "$INTERACTIVE" = true ]; then
                read -p "Archiver ces logs ? (o/N) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Oo]$ ]]; then
                    mkdir -p backend/logs/archives
                    timestamp=$(date +%Y%m%d_%H%M%S)
                    echo "$large_logs" | while read log_file; do
                        if [ -f "$log_file" ]; then
                            base_name=$(basename "$log_file")
                            cp "$log_file" "backend/logs/archives/${base_name}_${timestamp}"
                            echo "" > "$log_file"
                            echo "   ✅ $log_file archivé"
                        fi
                    done
                fi
            fi
        fi
    else
        echo "✅ Aucun log volumineux trouvé"
    fi
else
    echo "ℹ️  Dossier logs non trouvé"
fi

# 9. Vérifier les permissions des scripts
echo ""
echo "🔐 PERMISSIONS DES SCRIPTS"
echo "--------------------------"
dangerous_perms=$(find . -name "*.sh" -perm 777 2>/dev/null)
if [ -n "$dangerous_perms" ]; then
    echo "⚠️  Scripts avec permissions 777 (dangereux):"
    echo "$dangerous_perms"
    
    if [ "$DRY_RUN" = false ] && [ "$INTERACTIVE" = true ]; then
        read -p "Corriger les permissions (750) ? (o/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Oo]$ ]]; then
            echo "$dangerous_perms" | xargs chmod 750
            echo "✅ Permissions corrigées"
        fi
    fi
else
    echo "✅ Permissions des scripts OK"
fi

# Résumé final
echo ""
echo "📊 RÉSUMÉ DU NETTOYAGE"
echo "======================"

if [ "$DRY_RUN" = true ]; then
    echo "🔍 MODE SIMULATION - Aucune modification effectuée"
    echo ""
    echo "Pour exécuter réellement le nettoyage :"
    echo "  DRY_RUN=false ./security_cleanup.sh"
    echo ""
    echo "Pour un nettoyage automatique (sans confirmation) :"
    echo "  DRY_RUN=false INTERACTIVE=false ./security_cleanup.sh"
else
    echo "✅ Nettoyage de sécurité terminé"
    echo ""
    echo "📋 Prochaines étapes recommandées :"
    echo "  1. Mettre à jour .gitignore"
    echo "  2. Remplacer backup_health_check.sh par version Python"
    echo "  3. Tester le déploiement"
    echo "  4. Commiter les changements"
fi

echo ""
echo "🛡️ Audit de sécurité terminé" 