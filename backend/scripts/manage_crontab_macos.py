#!/usr/bin/env python3
"""
Script spécialisé pour gérer les tâches cron sur macOS
Contourne les problèmes de permissions "Operation not permitted"
Usage: python scripts/manage_crontab_macos.py [install|remove|status|test]
"""

import sys
import os
import subprocess
import tempfile
from pathlib import Path
import platform

# Ajouter le répertoire parent au path pour les imports Django
sys.path.insert(0, str(Path(__file__).parent.parent))

def is_macos():
    """Vérifier si on est sur macOS."""
    return platform.system() == 'Darwin'

def check_permissions():
    """Vérifier les permissions système."""
    print("🔍 Vérification des permissions système...")
    
    # Vérifier les permissions du répertoire temporaire
    temp_dir = tempfile.gettempdir()
    print(f"📁 Répertoire temporaire: {temp_dir}")
    
    try:
        # Tester l'écriture dans /tmp
        test_file = os.path.join(temp_dir, 'cron_test.tmp')
        with open(test_file, 'w') as f:
            f.write('test')
        os.remove(test_file)
        print("✅ Permissions /tmp OK")
    except Exception as e:
        print(f"❌ Problème permissions /tmp: {e}")
        return False
    
    # Vérifier crontab
    try:
        result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Accès crontab OK")
        else:
            print(f"⚠️ Crontab: {result.stderr}")
    except Exception as e:
        print(f"❌ Problème crontab: {e}")
        return False
    
    return True

def setup_alternative_tmpdir():
    """Créer un répertoire temporaire alternatif."""
    user_home = os.path.expanduser('~')
    alt_tmp = os.path.join(user_home, '.local', 'tmp', 'django-cron')
    
    try:
        os.makedirs(alt_tmp, exist_ok=True)
        print(f"✅ Répertoire temporaire alternatif créé: {alt_tmp}")
        
        # Tester l'écriture
        test_file = os.path.join(alt_tmp, 'test.tmp')
        with open(test_file, 'w') as f:
            f.write('test')
        os.remove(test_file)
        
        return alt_tmp
    except Exception as e:
        print(f"❌ Impossible de créer le répertoire alternatif: {e}")
        return None

def install_cron_with_workaround():
    """Installer les tâches cron avec des solutions de contournement."""
    print("🔧 Installation des tâches cron avec solutions macOS...")
    
    if not is_macos():
        print("ℹ️ Ce script est optimisé pour macOS, utilisation normale...")
        return run_standard_cron_install()
    
    # Solution 1: Utiliser un répertoire temporaire alternatif
    alt_tmp = setup_alternative_tmpdir()
    if alt_tmp:
        print("🎯 Solution 1: Répertoire temporaire alternatif")
        try:
            env = os.environ.copy()
            env['TMPDIR'] = alt_tmp
            env['TEMP'] = alt_tmp
            env['TMP'] = alt_tmp
            
            result = subprocess.run(
                ['python', 'manage.py', 'crontab', 'add'],
                env=env,
                capture_output=True,
                text=True,
                cwd=Path(__file__).parent.parent
            )
            
            if result.returncode == 0:
                print("✅ Installation réussie avec répertoire alternatif!")
                return True
            else:
                print(f"❌ Échec solution 1: {result.stderr}")
        except Exception as e:
            print(f"❌ Erreur solution 1: {e}")
    
    # Solution 2: Installation avec sudo (temporaire)
    print("🎯 Solution 2: Installation avec sudo")
    try:
        print("⚠️ Une authentification sudo sera demandée...")
        result = subprocess.run(
            ['sudo', 'python', 'manage.py', 'crontab', 'add'],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )
        
        if result.returncode == 0:
            print("✅ Installation réussie avec sudo!")
            print("ℹ️ Note: Les tâches peuvent s'exécuter en tant que root")
            return True
        else:
            print(f"❌ Échec solution 2: {result.stderr}")
    except Exception as e:
        print(f"❌ Erreur solution 2: {e}")
    
    # Solution 3: Manuel crontab
    print("🎯 Solution 3: Installation manuelle dans crontab")
    return install_manual_crontab()

def install_manual_crontab():
    """Installation manuelle des tâches dans le crontab."""
    print("📝 Génération des tâches cron manuelles...")
    
    project_dir = Path(__file__).parent.parent
    python_path = sys.executable
    
    # Définir les tâches cron manuellement (basées sur settings.py)
    cron_jobs = [
        "# Django Cron Jobs - Cochin Project Manager",
        f"0 8 * * * cd {project_dir} && {python_path} manage.py check_devis_notifications",
        f"0 4 * * * cd {project_dir} && {python_path} manage.py run_backup --frequency=daily",
        f"0 5 * * 0 cd {project_dir} && {python_path} manage.py run_backup --frequency=weekly", 
        f"0 6 1 * * cd {project_dir} && {python_path} manage.py run_backup --frequency=monthly",
        f"0 2 * * * cd {project_dir} && {python_path} manage.py cleanup_temp_files --auto",
        f"0 */6 * * * cd {project_dir} && {python_path} manage.py cleanup_stuck_operations --hours=6 --force",
        f"0 3 * * 0 cd {project_dir} && {python_path} manage.py rebuild_backup_paths --force",
        f"0 1 * * 6 cd {project_dir} && {python_path} manage.py cleanup_temp_files --age-hours=2 --force",
        f"0 3 * * * cd {project_dir} && {python_path} manage.py cleanup_logs --compress-days=7 --force",
        f"0 4 * * 0 cd {project_dir} && {python_path} manage.py cleanup_logs --days=30 --compress-days=7 --force",
    ]
    
    cron_content = "\n".join(cron_jobs)
    
    # Sauvegarder dans un fichier temporaire
    temp_cron_file = "/tmp/django_cron_jobs.txt"
    try:
        with open(temp_cron_file, 'w') as f:
            f.write(cron_content + "\n")
        
        print(f"✅ Tâches cron générées dans: {temp_cron_file}")
        print("\n📋 Instructions d'installation manuelle:")
        print("1. Ouvrir le crontab avec: crontab -e")
        print("2. Ajouter les lignes suivantes:")
        print("-" * 50)
        print(cron_content)
        print("-" * 50)
        print(f"3. Ou utiliser: crontab {temp_cron_file}")
        
        # Tentative d'installation automatique
        try:
            result = subprocess.run(['crontab', temp_cron_file], capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ Installation automatique réussie!")
                return True
            else:
                print(f"⚠️ Installation automatique échouée: {result.stderr}")
                print("Utilisez l'installation manuelle ci-dessus.")
        except Exception as e:
            print(f"⚠️ Installation automatique échouée: {e}")
            print("Utilisez l'installation manuelle ci-dessus.")
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur génération fichier: {e}")
        return False

def run_standard_cron_install():
    """Installation standard des tâches cron."""
    try:
        result = subprocess.run(
            ['python', 'manage.py', 'crontab', 'add'],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )
        
        if result.returncode == 0:
            print("✅ Installation standard réussie!")
            return True
        else:
            print(f"❌ Échec installation standard: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Erreur installation standard: {e}")
        return False

def remove_cron_jobs():
    """Supprimer les tâches cron."""
    print("🗑️ Suppression des tâches cron...")
    
    try:
        result = subprocess.run(
            ['python', 'manage.py', 'crontab', 'remove'],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )
        
        if result.returncode == 0:
            print("✅ Tâches cron supprimées!")
        else:
            print(f"❌ Erreur suppression: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Erreur: {e}")

def show_status():
    """Afficher le statut du système cron."""
    print("📊 Statut du système cron")
    print("=" * 50)
    
    # Informations système
    print(f"🖥️  Système: {platform.system()} {platform.release()}")
    print(f"🐍 Python: {sys.executable}")
    print(f"📁 Projet: {Path(__file__).parent.parent}")
    
    # Vérifier les permissions
    check_permissions()
    
    # Compter les tâches Django dans crontab
    try:
        result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
        if result.returncode == 0:
            django_jobs = [line for line in result.stdout.split('\n') if 'manage.py' in line]
            print(f"📋 Tâches Django dans crontab: {len(django_jobs)}")
            
            if django_jobs:
                print("Tâches trouvées:")
                for job in django_jobs:
                    if job.strip():
                        print(f"  - {job.strip()}")
        else:
            print("❌ Impossible de lire le crontab")
            
    except Exception as e:
        print(f"❌ Erreur lecture crontab: {e}")

def test_cron_job():
    """Tester une tâche cron manuellement."""
    print("🧪 Test d'une tâche cron...")
    
    try:
        result = subprocess.run(
            ['python', 'manage.py', 'cleanup_temp_files', '--dry-run', '--verbose'],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )
        
        if result.returncode == 0:
            print("✅ Test réussi!")
            print("Sortie:")
            print(result.stdout)
        else:
            print(f"❌ Test échoué: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Erreur test: {e}")

def main():
    """Fonction principale."""
    if len(sys.argv) < 2:
        print("Usage: python scripts/manage_crontab_macos.py [install|remove|status|test]")
        print("")
        print("Commandes disponibles:")
        print("  install  - Installer les tâches cron avec solutions macOS")
        print("  remove   - Supprimer les tâches cron")
        print("  status   - Afficher le statut et diagnostics")
        print("  test     - Tester une tâche cron manuellement")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    print(f"🍎 Gestionnaire Cron macOS - Commande: {command}")
    print("=" * 60)
    
    if command == "install":
        success = install_cron_with_workaround()
        if success:
            print("\n✅ Installation terminée avec succès!")
        else:
            print("\n❌ Échec de l'installation")
            sys.exit(1)
    elif command == "remove":
        remove_cron_jobs()
    elif command == "status":
        show_status()
    elif command == "test":
        test_cron_job()
    else:
        print(f"❌ Commande inconnue: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()