"""
Commande Django pour lancer les sauvegardes automatiques
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from backup_manager.models import BackupConfiguration
from backup_manager.services import BackupService
from django.utils import timezone
import json

User = get_user_model()


class Command(BaseCommand):
    help = 'Lance les sauvegardes configurées'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--config',
            type=str,
            help='Nom de la configuration de sauvegarde à lancer'
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Lance toutes les configurations actives'
        )
        parser.add_argument(
            '--frequency',
            type=str,
            choices=['daily', 'weekly', 'monthly'],
            help='Lance les configurations avec cette fréquence'
        )
        parser.add_argument(
            '--user',
            type=str,
            default='system',
            help='Nom d\'utilisateur pour la sauvegarde (défaut: system)'
        )
    
    def handle(self, *args, **options):
        user = self._get_or_create_user(options['user'])
        configs = self._get_configurations_to_run(options)
        
        if not configs:
            self.stdout.write(self.style.WARNING('Aucune configuration de sauvegarde trouvée'))
            return
        
        self._run_backups(configs, user)
    
    def _get_or_create_user(self, username):
        """Récupère ou crée l'utilisateur pour la sauvegarde"""
        try:
            if username == 'system':
                user, created = User.objects.get_or_create(
                    username='system_backup',
                    defaults={
                        'email': 'system@backup.local',
                        'is_active': False,
                        'is_staff': False
                    }
                )
                if created:
                    self.stdout.write(self.style.SUCCESS('Utilisateur système de sauvegarde créé'))
                return user
            else:
                return User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f"Utilisateur '{username}' introuvable")
    
    def _get_configurations_to_run(self, options):
        """Détermine les configurations à lancer selon les options"""
        if options['config']:
            try:
                return [BackupConfiguration.objects.get(name=options['config'], is_active=True)]
            except BackupConfiguration.DoesNotExist:
                raise CommandError(f"Configuration '{options['config']}' introuvable ou inactive")
        
        elif options['all']:
            return BackupConfiguration.objects.filter(is_active=True)
        
        elif options['frequency']:
            return BackupConfiguration.objects.filter(frequency=options['frequency'], is_active=True)
        
        else:
            return BackupConfiguration.objects.filter(frequency='manual', is_active=True)
    
    def _run_backups(self, configs, user):
        """Lance les sauvegardes et affiche le résumé"""
        total_configs = len(configs)
        successful_backups = 0
        failed_backups = 0
        
        self.stdout.write(f"Lancement de {total_configs} sauvegarde(s)...")
        
        for config in configs:
            if self._run_single_backup(config, user):
                successful_backups += 1
            else:
                failed_backups += 1
        
        self._display_summary(total_configs, successful_backups, failed_backups)
    
    def _run_single_backup(self, config, user):
        """Lance une sauvegarde unique et retourne True si succès"""
        try:
            self.stdout.write(f"🚀 Début de la sauvegarde '{config.name}'...")
            
            # Utiliser directement le service au lieu de l'API pour éviter les problèmes de permissions
            backup_service = BackupService()
            backup_name = f"{config.name}_auto_{timezone.now().strftime('%d%m%y_%H%M')}"
            
            # Lancer la sauvegarde via le service
            backup_history = backup_service.create_backup(
                config=config,
                user=user,
                backup_name=backup_name
            )
            
                self.stdout.write(
                    self.style.SUCCESS(
                    f"✅ Sauvegarde '{config.name}' terminée avec succès "
                    f"(ID: {backup_history.id}, Status: {backup_history.status})"
                    )
                )
                return True
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Erreur lors de la sauvegarde '{config.name}': {str(e)}")
            )
            return False
    

    
    def _display_summary(self, total_configs, successful_backups, failed_backups):
        """Affiche le résumé final"""
        self.stdout.write("\n" + "="*50)
        self.stdout.write("📊 RÉSUMÉ:")
        self.stdout.write(f"   • Total: {total_configs}")
        self.stdout.write(self.style.SUCCESS(f"   • Réussies: {successful_backups}"))
        
        if failed_backups > 0:
            self.stdout.write(self.style.ERROR(f"   • Échouées: {failed_backups}"))
            self.stdout.write("="*50)
            raise CommandError(f"{failed_backups} sauvegarde(s) ont échoué")
        
        self.stdout.write("="*50)
        self.stdout.write(self.style.SUCCESS("Toutes les sauvegardes ont été réalisées avec succès !")) 