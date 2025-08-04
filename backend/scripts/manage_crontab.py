#!/usr/bin/env python3
"""
Script utilitaire pour gérer les tâches cron django-crontab
Usage: python scripts/manage_crontab.py [add|remove|show|status]
"""

import sys
import os
import subprocess
from pathlib import Path

# Ajouter le répertoire parent au path pour les imports Django
sys.path.insert(0, str(Path(__file__).parent.parent))

def run_command(command):
    """Exécuter une commande et retourner le résultat."""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            capture_output=True, 
            text=True, 
            cwd=Path(__file__).parent.parent
        )
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def show_cronjobs():
    """Afficher les tâches cron configurées."""
    print("🕐 Tâches cron configurées :")
    print("=" * 50)
    
    # Afficher la configuration Django
    ret, out, err = run_command("python manage.py crontab show")
    if ret == 0:
        print(out)
    else:
        print(f"❌ Erreur : {err}")
    
    print("\n📋 Planification des tâches :")
    print("- 🔔 Notifications devis : tous les jours à 8h00")
    print("- 🧹 Nettoyage fichiers temp : tous les jours à 2h00") 
    print("- 🔧 Nettoyage opérations bloquées : toutes les 6h")
    print("- 🔄 Resynchronisation DB/fichiers : dimanches à 3h00")
    print("- 🗑️  Nettoyage agressif temp : samedis à 1h00")

def add_cronjobs():
    """Ajouter les tâches cron au système."""
    print("➕ Ajout des tâches cron...")
    ret, out, err = run_command("python manage.py crontab add")
    if ret == 0:
        print("✅ Tâches cron ajoutées avec succès !")
        print(out)
    else:
        print(f"❌ Erreur lors de l'ajout : {err}")
        if "Operation not permitted" in err:
            print("")
            print("🍎 SOLUTION MACOS:")
            print("   Ce problème est courant sur macOS due aux restrictions de sécurité.")
            print("   Utilisez le script spécialisé :")
            print("   python scripts/manage_crontab_macos.py install")
    return ret == 0

def remove_cronjobs():
    """Supprimer les tâches cron du système."""
    print("➖ Suppression des tâches cron...")
    ret, out, err = run_command("python manage.py crontab remove")
    if ret == 0:
        print("✅ Tâches cron supprimées avec succès !")
        print(out)
    else:
        print(f"❌ Erreur lors de la suppression : {err}")
    return ret == 0

def system_status():
    """Vérifier le statut du système cron."""
    print("🔍 Statut du système cron :")
    print("=" * 50)
    
    # Vérifier le service cron sur macOS
    ret, out, err = run_command("launchctl list | grep cron")
    if ret == 0 and out.strip():
        print("✅ Service cron actif")
    else:
        print("⚠️  Service cron non détecté ou inactif")
    
    # Vérifier les tâches dans le crontab système
    ret, out, err = run_command("crontab -l 2>/dev/null | grep django-cronjobs | wc -l")
    if ret == 0:
        count = out.strip()
        if int(count) > 0:
            print(f"✅ {count} tâches Django actives dans crontab")
        else:
            print("⚠️  Aucune tâche Django trouvée dans crontab")
    
    # Vérifier les permissions d'écriture des répertoires
    backup_dir = Path(__file__).parent.parent / "backups"
    logs_dir = Path(__file__).parent.parent / "logs"
    
    for directory in [backup_dir, logs_dir]:
        if directory.exists() and os.access(directory, os.W_OK):
            print(f"✅ {directory.name}/ - Permissions OK")
        else:
            print(f"⚠️  {directory.name}/ - Permissions insuffisantes ou inexistant")

def test_cronjob():
    """Tester une tâche cron manuellement."""
    print("🧪 Test d'une tâche cron (nettoyage fichiers temporaires)...")
    ret, out, err = run_command("python manage.py cleanup_temp_files --dry-run --verbose")
    if ret == 0:
        print("✅ Test réussi !")
        print(out)
    else:
        print(f"❌ Erreur lors du test : {err}")

def main():
    """Fonction principale."""
    if len(sys.argv) < 2:
        print("Usage: python scripts/manage_crontab.py [add|remove|show|status|test]")
        print("")
        print("Commandes disponibles :")
        print("  add     - Ajouter les tâches cron au système")
        print("  remove  - Supprimer les tâches cron du système") 
        print("  show    - Afficher les tâches cron configurées")
        print("  status  - Vérifier le statut du système cron")
        print("  test    - Tester une tâche cron manuellement")
        print("")
        print("🍎 MACOS: Si vous rencontrez des erreurs 'Operation not permitted',")
        print("   utilisez: python scripts/manage_crontab_macos.py install")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "add":
        add_cronjobs()
    elif command == "remove":
        remove_cronjobs()
    elif command == "show":
        show_cronjobs()
    elif command == "status":
        system_status()
    elif command == "test":
        test_cronjob()
    else:
        print(f"❌ Commande inconnue : {command}")
        sys.exit(1)

if __name__ == "__main__":
    main() 