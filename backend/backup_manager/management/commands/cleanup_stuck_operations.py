"""
Commande Django pour nettoyer les opérations de sauvegarde/restauration bloquées
"""

import logging
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import timedelta
from backup_manager.models import BackupHistory, RestoreHistory

logger = logging.getLogger('backup_manager')

class Command(BaseCommand):
    help = 'Nettoie les opérations de sauvegarde et restauration bloquées'

    def add_arguments(self, parser):
        parser.add_argument(
            '--hours',
            type=int,
            default=6,
            help='Nombre d\'heures après lesquelles une opération est considérée comme bloquée'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force le nettoyage sans demander de confirmation'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les opérations qui seraient nettoyées sans les modifier'
        )
        parser.add_argument(
            '--restore-id',
            type=int,
            help='ID spécifique d\'une restauration à marquer comme échouée'
        )
        parser.add_argument(
            '--minutes',
            type=int,
            help='Nombre de minutes après lesquelles une opération est considérée comme bloquée (alternative à --hours)'
        )
        parser.add_argument(
            '--show-stats',
            action='store_true',
            help='Affiche uniquement les statistiques actuelles des opérations'
        )

    def handle(self, *args, **options):
        force = options['force']
        dry_run = options['dry_run']
        restore_id = options.get('restore_id')
        show_stats = options.get('show_stats')
        
        # Afficher uniquement les statistiques si demandé
        if show_stats:
            self.show_current_stats()
            return
        
        # Traitement spécifique pour un ID de restauration
        if restore_id:
            return self.handle_specific_restore(restore_id, force, dry_run)
        
        # Calcul du seuil de temps
        if options.get('minutes') is not None:
            threshold = timezone.now() - timedelta(minutes=options['minutes'])
            time_display = f"{options['minutes']} minute(s)"
        else:
            hours = options['hours']
            threshold = timezone.now() - timedelta(hours=hours)
            time_display = f"{hours} heure(s)"
        
        # Recherche des sauvegardes bloquées
        stuck_backups = BackupHistory.objects.filter(
            status__in=['running', 'pending'],
            started_at__lt=threshold
        )
        
        # Recherche des restaurations bloquées
        stuck_restores = RestoreHistory.objects.filter(
            status__in=['running', 'pending'],
            started_at__lt=threshold
        )
        
        total_stuck = stuck_backups.count() + stuck_restores.count()
        
        if total_stuck == 0:
            self.stdout.write(self.style.SUCCESS('✅ Aucune opération bloquée détectée'))
            return
        
        self.stdout.write(self.style.WARNING(
            f'🔍 {stuck_backups.count()} sauvegarde(s) et {stuck_restores.count()} restauration(s) '
            f'bloquées depuis plus de {time_display}'
        ))
        
        # Afficher les détails des opérations bloquées
        if stuck_backups.exists():
            self.stdout.write(self.style.WARNING('\n📋 Sauvegardes bloquées:'))
            for backup in stuck_backups:
                duration = timezone.now() - backup.started_at
                hours_stuck = duration.total_seconds() / 3600
                self.stdout.write(f'  - ID: {backup.id}, Nom: {backup.backup_name}, '
                                f'Type: {backup.backup_type}, '
                                f'Bloquée depuis: {hours_stuck:.1f} heures')
        
        if stuck_restores.exists():
            self.stdout.write(self.style.WARNING('\n📋 Restaurations bloquées:'))
            for restore in stuck_restores:
                duration = timezone.now() - restore.started_at
                hours_stuck = duration.total_seconds() / 3600
                self.stdout.write(f'  - ID: {restore.id}, '
                                f'Source: {restore.backup_source.backup_name if restore.backup_source else "Inconnue"}, '
                                f'Bloquée depuis: {hours_stuck:.1f} heures')
        
        # Demander confirmation si --force n'est pas utilisé
        if not force and not dry_run:
            confirm = input('\n⚠️ Voulez-vous marquer ces opérations comme échouées? (oui/non): ')
            if confirm.lower() not in ['oui', 'o', 'yes', 'y']:
                self.stdout.write(self.style.WARNING('❌ Opération annulée'))
                return
        
        if dry_run:
            self.stdout.write(self.style.SUCCESS(
                f'\n✅ Mode simulation: {total_stuck} opération(s) seraient marquées comme échouées'
            ))
            return
        
        # Marquer les sauvegardes comme échouées
        for backup in stuck_backups:
            backup.status = 'failed'
            backup.completed_at = timezone.now()
            backup.error_message = f'Opération automatiquement marquée comme échouée après {time_display}'
            backup.save()
            logger.warning(f"Sauvegarde ID {backup.id} ({backup.backup_name}) marquée comme échouée - bloquée depuis {time_display}")
        
        # Marquer les restaurations comme échouées
        for restore in stuck_restores:
            restore.status = 'failed'
            restore.completed_at = timezone.now()
            restore.error_message = f'Opération automatiquement marquée comme échouée après {time_display}'
            restore.save()
            logger.warning(f"Restauration ID {restore.id} marquée comme échouée - bloquée depuis {time_display}")
        
        self.stdout.write(self.style.SUCCESS(
            f'\n✅ {total_stuck} opération(s) marquée(s) comme échouée(s) avec succès'
        ))
    
    def handle_specific_restore(self, restore_id, force, dry_run):
        """Traite une restauration spécifique par ID"""
        try:
            restore = RestoreHistory.objects.get(id=restore_id)
            
            self.stdout.write(self.style.WARNING(
                f'🔍 Restauration ID {restore_id} trouvée:'
            ))
            self.stdout.write(f'  - Nom: {restore.restore_name}')
            self.stdout.write(f'  - Statut actuel: {restore.status}')
            self.stdout.write(f'  - Source: {restore.backup_source.backup_name if restore.backup_source else "Inconnue"}')
            if restore.started_at:
                duration = timezone.now() - restore.started_at
                hours_stuck = duration.total_seconds() / 3600
                self.stdout.write(f'  - Démarrée depuis: {hours_stuck:.1f} heures')
            
            if not force and not dry_run:
                confirm = input('\n⚠️ Voulez-vous marquer cette restauration comme échouée? (oui/non): ')
                if confirm.lower() not in ['oui', 'o', 'yes', 'y']:
                    self.stdout.write(self.style.WARNING('❌ Opération annulée'))
                    return
            
            if dry_run:
                self.stdout.write(self.style.SUCCESS(
                    f'\n✅ Mode simulation: La restauration ID {restore_id} serait marquée comme échouée'
                ))
                return
            
            # Marquer la restauration comme échouée
            restore.status = 'failed'
            restore.completed_at = timezone.now()
            restore.error_message = f'Opération manuellement marquée comme échouée via commande cleanup_stuck_operations'
            restore.save()
            
            logger.warning(f"Restauration ID {restore_id} ({restore.restore_name}) manuellement marquée comme échouée")
            
            self.stdout.write(self.style.SUCCESS(
                f'\n✅ Restauration ID {restore_id} marquée comme échouée avec succès'
            ))
            
        except RestoreHistory.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ Restauration avec ID {restore_id} introuvable'))
    
    def show_current_stats(self):
        """Affiche les statistiques actuelles"""
        self.stdout.write(self.style.SUCCESS("\n📊 État actuel des opérations:"))
        
        # Sauvegardes
        running_backups = BackupHistory.objects.filter(status='running').count()
        pending_backups = BackupHistory.objects.filter(status='pending').count()
        completed_backups = BackupHistory.objects.filter(status='completed').count()
        failed_backups = BackupHistory.objects.filter(status='failed').count()
        
        self.stdout.write(self.style.SUCCESS("📦 Sauvegardes:"))
        self.stdout.write(f"  - En cours: {running_backups}")
        self.stdout.write(f"  - En attente: {pending_backups}")
        self.stdout.write(f"  - Terminées: {completed_backups}")
        self.stdout.write(f"  - Échouées: {failed_backups}")
        
        # Restaurations
        running_restores = RestoreHistory.objects.filter(status='running').count()
        pending_restores = RestoreHistory.objects.filter(status='pending').count()
        completed_restores = RestoreHistory.objects.filter(status='completed').count()
        failed_restores = RestoreHistory.objects.filter(status='failed').count()
        
        self.stdout.write(self.style.SUCCESS("\n🔄 Restaurations:"))
        self.stdout.write(f"  - En cours: {running_restores}")
        self.stdout.write(f"  - En attente: {pending_restores}")
        self.stdout.write(f"  - Terminées: {completed_restores}")
        self.stdout.write(f"  - Échouées: {failed_restores}")
        
        # Détails des restaurations en cours
        if running_restores > 0:
            self.stdout.write(self.style.WARNING("\n📋 Détails des restaurations en cours:"))
            for restore in RestoreHistory.objects.filter(status='running'):
                duration = timezone.now() - restore.started_at if restore.started_at else timedelta(seconds=0)
                hours_running = duration.total_seconds() / 3600
                self.stdout.write(f"  - ID: {restore.id}, Nom: {restore.restore_name}")
                self.stdout.write(f"    Source: {restore.backup_source.backup_name if restore.backup_source else 'Inconnue'}")
                self.stdout.write(f"    Démarrée depuis: {hours_running:.1f} heures")
                self.stdout.write(f"    Créée par: {restore.created_by.username}")
                self.stdout.write("") 