"""
Commande Django pour nettoyer les fichiers temporaires de sauvegarde/restauration
"""

from django.core.management.base import BaseCommand, CommandError
from backup_manager.services.cleanup_service import CleanupService


class Command(BaseCommand):
    help = 'Nettoie les fichiers temporaires de sauvegarde/restauration'

    def add_arguments(self, parser):
        parser.add_argument(
            '--max-age-hours',
            type=int,
            default=24,
            help='Âge maximum en heures des fichiers à conserver (défaut: 24)'
        )
        parser.add_argument(
            '--aggressive',
            action='store_true',
            help='Nettoyage agressif (2h pour uploads, 1h pour fichiers déchiffrés)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche ce qui serait supprimé sans le faire'
        )
        parser.add_argument(
            '--stats-only',
            action='store_true',
            help='Affiche seulement les statistiques d\'espace disque'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force le nettoyage sans demander confirmation'
        )

    def handle(self, *args, **options):
        max_age_hours = options['max_age_hours']
        aggressive = options['aggressive']
        dry_run = options['dry_run']
        stats_only = options['stats_only']
        force = options['force']
        
        cleanup_service = CleanupService()
        
        # Ajuster les paramètres pour le mode agressif
        if aggressive:
            max_age_hours = min(max_age_hours, 2)
            self.stdout.write(
                self.style.WARNING(f"🔥 Mode agressif activé - nettoyage des fichiers > {max_age_hours}h")
            )
        
        # Traitement selon le mode
        if stats_only:
            self._handle_stats_only(cleanup_service)
        elif dry_run:
            self._handle_dry_run(cleanup_service, max_age_hours)
        else:
            self._handle_cleanup(cleanup_service, max_age_hours, force)
    
    def _handle_stats_only(self, cleanup_service):
        """Gère le mode stats-only"""
        self.show_cleanup_stats(cleanup_service)
    
    def _handle_dry_run(self, cleanup_service, max_age_hours):
        """Gère le mode dry-run"""
        # Afficher l'état avant nettoyage
        self.stdout.write(self.style.SUCCESS("📊 État avant nettoyage:"))
        stats_before = cleanup_service.get_cleanup_stats()
        self.display_stats(stats_before)
        
        self.stdout.write(
            self.style.WARNING(f"\n🔍 DRY RUN - Simulation du nettoyage (âge max: {max_age_hours}h)")
        )
        
        # Effectuer la simulation
        dry_results = cleanup_service.dry_run_cleanup(max_age_hours)
        self._display_dry_run_results(cleanup_service, dry_results)
    
    def _handle_cleanup(self, cleanup_service, max_age_hours, force):
        """Gère le nettoyage réel"""
        # Afficher l'état avant nettoyage
        self.stdout.write(self.style.SUCCESS("📊 État avant nettoyage:"))
        stats_before = cleanup_service.get_cleanup_stats()
        self.display_stats(stats_before)
        
        # Vérifier confirmation si nécessaire
        if not self._confirm_cleanup(cleanup_service, stats_before, force):
            return
        
        # Effectuer le nettoyage
        self._execute_cleanup(cleanup_service, max_age_hours)
    
    def _display_dry_run_results(self, cleanup_service, dry_results):
        """Affiche les résultats du dry-run"""
        # Afficher ce qui serait supprimé
        self.stdout.write("\n📋 Fichiers qui seraient supprimés:")
        
        for operation, data in dry_results.items():
            if operation == 'totals':
                continue
                
            icon = {
                'restore_temp': '🔄',
                'temp_files': '📁', 
                'upload_files': '📤',
                'orphaned_files': '🗑️',
                'decrypted_files': '🔓'
            }.get(operation, '📂')
            
            files_count = data.get('files_to_delete', 0)
            size_to_free = data.get('size_to_free', 0)
            
            if files_count > 0:
                self.stdout.write(
                    f"   {icon} {operation:<15}: "
                    f"{files_count} fichiers, "
                    f"{cleanup_service.format_size(size_to_free)} à libérer"
                )
                
                if 'directories_to_remove' in data and data['directories_to_remove'] > 0:
                    self.stdout.write(f"      └─ {data['directories_to_remove']} répertoires")
        
        # Résumé de la simulation
        totals = dry_results['totals']
        self.stdout.write(
            self.style.SUCCESS(
                f"\n🎯 Simulation terminée:\n"
                f"   • {totals['files_to_delete']} fichiers seraient supprimés\n"
                f"   • {totals['size_to_free_formatted']} seraient libérés"
            )
        )
    
    def _confirm_cleanup(self, cleanup_service, stats_before, force):
        """Vérifie la confirmation pour le nettoyage"""
        # Calculer l'espace total à libérer
        total_temp_size = sum(
            stats_before[key]['size'] 
            for key in ['restore_temp', 'temp', 'uploads'] 
            if key in stats_before
        )
        
        if not force and total_temp_size > 0:
            formatted_size = cleanup_service.format_size(total_temp_size)
            confirm = input(
                f"\n❓ Nettoyer ~{formatted_size} de fichiers temporaires ? [y/N] "
            )
            if confirm.lower() != 'y':
                self.stdout.write("❌ Nettoyage annulé.")
                return False
        
        return True
    
    def _execute_cleanup(self, cleanup_service, max_age_hours):
        """Exécute le nettoyage et affiche les résultats"""
        self.stdout.write(
            self.style.SUCCESS(f"\n🧹 Lancement du nettoyage (âge max: {max_age_hours}h)")
        )
        
        try:
            results = cleanup_service.cleanup_all_temporary_files(max_age_hours)
            
            # Afficher les résultats détaillés
            self.display_cleanup_results(results)
            
            # Afficher l'état après nettoyage
            self.stdout.write(self.style.SUCCESS("\n📊 État après nettoyage:"))
            stats_after = cleanup_service.get_cleanup_stats()
            self.display_stats(stats_after)
            
            # Résumé final
            totals = results['totals']
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n🎯 Nettoyage terminé en {totals['duration_seconds']}s:\n"
                    f"   • {totals['files_deleted']} fichiers supprimés\n"
                    f"   • {cleanup_service.format_size(totals['size_freed'])} libérés"
                )
            )
            
        except Exception as e:
            raise CommandError(f"Erreur lors du nettoyage: {e}")
    
    def show_cleanup_stats(self, cleanup_service):
        """Affiche les statistiques d'espace disque"""
        self.stdout.write(self.style.SUCCESS("📊 Statistiques d'espace disque:"))
        
        stats = cleanup_service.get_cleanup_stats()
        self.display_stats(stats)
        
        # Calculer les totaux
        total_size = sum(stats[key]['size'] for key in stats)
        total_files = sum(stats[key]['file_count'] for key in stats)
        
        self.stdout.write("\n📋 Résumé:")
        self.stdout.write(f"   • Taille totale: {cleanup_service.format_size(total_size)}")
        self.stdout.write(f"   • Fichiers totaux: {total_files}")
        
        # Recommandations
        temp_size = sum(
            stats[key]['size'] 
            for key in ['restore_temp', 'temp', 'uploads'] 
            if key in stats
        )
        
        if temp_size > 100 * 1024 * 1024:  # Plus de 100MB de fichiers temporaires
            self.stdout.write(
                self.style.WARNING(
                    f"\n⚠️  Recommandation: {cleanup_service.format_size(temp_size)} "
                    f"de fichiers temporaires détectés. Envisagez un nettoyage."
                )
            )
    
    def display_stats(self, stats):
        """Affiche les statistiques de manière formatée"""
        for directory, data in stats.items():
            icon = {
                'storage': '💾',
                'restore_temp': '🔄', 
                'temp': '📁',
                'uploads': '📤'
            }.get(directory, '📂')
            
            self.stdout.write(
                f"   {icon} {directory:<15}: "
                f"{data['size_formatted']:<10} "
                f"({data['file_count']} fichiers)"
            )
    
    def display_cleanup_results(self, results):
        """Affiche les résultats détaillés du nettoyage"""
        self.stdout.write("\n📋 Résultats détaillés:")
        
        for operation, data in results.items():
            if operation == 'totals':
                continue
                
            icon = {
                'restore_temp': '🔄',
                'temp_files': '📁', 
                'upload_files': '📤',
                'orphaned_files': '🗑️',
                'decrypted_files': '🔓'
            }.get(operation, '📂')
            
            files_count = data.get('files_deleted', 0)
            size_freed = data.get('size_freed', 0)
            
            if files_count > 0:
                from backup_manager.services.cleanup_service import CleanupService
                cleanup_service = CleanupService()
                
                self.stdout.write(
                    f"   {icon} {operation:<15}: "
                    f"{files_count} fichiers, "
                    f"{cleanup_service.format_size(size_freed)} libérés"
                )
                
                # Afficher les répertoires supprimés si applicable
                if 'directories_removed' in data and data['directories_removed'] > 0:
                    self.stdout.write(
                        f"      └─ {data['directories_removed']} répertoires supprimés"
                    ) 