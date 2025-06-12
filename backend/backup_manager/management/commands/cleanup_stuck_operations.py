"""
Commande Django pour nettoyer les opérations de sauvegarde/restauration bloquées
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import timedelta
from backup_manager.models import BackupHistory, RestoreHistory


class Command(BaseCommand):
    help = 'Nettoie les opérations de sauvegarde/restauration bloquées'

    def add_arguments(self, parser):
        parser.add_argument(
            '--threshold-minutes',
            type=int,
            default=30,
            help='Nombre de minutes après lesquelles une opération est considérée comme bloquée (défaut: 30)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les opérations qui seraient nettoyées sans les modifier'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force le nettoyage sans demander confirmation'
        )

    def handle(self, *args, **options):
        threshold_minutes = options['threshold_minutes']
        dry_run = options['dry_run']
        force = options['force']
        
        now = timezone.now()
        threshold = now - timedelta(minutes=threshold_minutes)
        
        self.stdout.write(
            self.style.SUCCESS(f"🧹 Nettoyage des opérations bloquées depuis plus de {threshold_minutes} minutes")
        )
        self.stdout.write(f"⏰ Seuil: {threshold}")
        
        # Trouver les opérations bloquées
        stuck_backups = BackupHistory.objects.filter(
            status='running',
            started_at__lt=threshold
        )
        
        stuck_restores = RestoreHistory.objects.filter(
            status='running',
            started_at__lt=threshold
        )
        
        total_stuck = stuck_backups.count() + stuck_restores.count()
        
        if total_stuck == 0:
            self.stdout.write(self.style.SUCCESS("✅ Aucune opération bloquée trouvée."))
            return
        
        # Afficher les opérations trouvées
        self.stdout.write(f"\n📦 Sauvegardes bloquées: {stuck_backups.count()}")
        for backup in stuck_backups:
            age = now - backup.started_at
            hours = age.total_seconds() / 3600
            self.stdout.write(f"  - ID {backup.id}: {backup.backup_name} (depuis {hours:.1f}h)")
        
        self.stdout.write(f"\n🔄 Restaurations bloquées: {stuck_restores.count()}")
        for restore in stuck_restores:
            age = now - restore.started_at
            hours = age.total_seconds() / 3600
            self.stdout.write(f"  - ID {restore.id}: {restore.restore_name} (depuis {hours:.1f}h)")
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f"\n🔍 DRY RUN: {total_stuck} opération(s) seraient nettoyée(s)")
            )
            return
        
        # Demander confirmation
        if not force:
            confirm = input(f"\n❓ Nettoyer {total_stuck} opération(s) bloquée(s) ? [y/N] ")
            if confirm.lower() != 'y':
                self.stdout.write("❌ Opération annulée.")
                return
        
        # Nettoyer les sauvegardes
        cleaned_backups = 0
        for backup in stuck_backups:
            age = now - backup.started_at
            hours = age.total_seconds() / 3600
            
            backup.status = 'failed'
            backup.completed_at = now
            backup.error_message = f"Opération automatiquement interrompue après {hours:.1f}h (processus probablement mort)"
            backup.save()
            
            cleaned_backups += 1
            self.stdout.write(f"  ✅ Sauvegarde ID {backup.id} marquée comme échouée")
        
        # Nettoyer les restaurations
        cleaned_restores = 0
        for restore in stuck_restores:
            age = now - restore.started_at
            hours = age.total_seconds() / 3600
            
            restore.status = 'failed'
            restore.completed_at = now
            restore.error_message = f"Opération automatiquement interrompue après {hours:.1f}h (processus probablement mort)"
            restore.save()
            
            cleaned_restores += 1
            self.stdout.write(f"  ✅ Restauration ID {restore.id} marquée comme échouée")
        
        total_cleaned = cleaned_backups + cleaned_restores
        self.stdout.write(
            self.style.SUCCESS(f"\n🎯 {total_cleaned} opération(s) nettoyée(s) avec succès !")
        )
        
        # Afficher les statistiques finales
        self.show_current_stats()
    
    def show_current_stats(self):
        """Affiche les statistiques actuelles"""
        self.stdout.write("\n📊 État actuel des opérations:")
        
        # Sauvegardes
        running_backups = BackupHistory.objects.filter(status='running').count()
        pending_backups = BackupHistory.objects.filter(status='pending').count()
        completed_backups = BackupHistory.objects.filter(status='completed').count()
        failed_backups = BackupHistory.objects.filter(status='failed').count()
        
        self.stdout.write("📦 Sauvegardes:")
        self.stdout.write(f"  - En cours: {running_backups}")
        self.stdout.write(f"  - En attente: {pending_backups}")
        self.stdout.write(f"  - Terminées: {completed_backups}")
        self.stdout.write(f"  - Échouées: {failed_backups}")
        
        # Restaurations
        running_restores = RestoreHistory.objects.filter(status='running').count()
        pending_restores = RestoreHistory.objects.filter(status='pending').count()
        completed_restores = RestoreHistory.objects.filter(status='completed').count()
        failed_restores = RestoreHistory.objects.filter(status='failed').count()
        
        self.stdout.write("🔄 Restaurations:")
        self.stdout.write(f"  - En cours: {running_restores}")
        self.stdout.write(f"  - En attente: {pending_restores}")
        self.stdout.write(f"  - Terminées: {completed_restores}")
        self.stdout.write(f"  - Échouées: {failed_restores}") 