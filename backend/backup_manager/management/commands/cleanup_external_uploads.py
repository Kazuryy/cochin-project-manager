#!/usr/bin/env python
"""
Commande de nettoyage des uploads externes
Supprime les uploads échoués ou obsolètes pour permettre aux utilisateurs de recommencer
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from pathlib import Path

from backup_manager.models import UploadedBackup, ExternalRestoration
from backup_manager.services.external_restore_service import ExternalRestoreService


class Command(BaseCommand):
    help = 'Nettoie les uploads externes échoués ou obsolètes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--max-age-hours',
            type=int,
            default=24,
            help='Âge maximum des uploads échoués à conserver (heures, défaut: 24)'
        )
        parser.add_argument(
            '--status',
            choices=['failed_validation', 'corrupted', 'pending_validation', 'all_failed'],
            default='all_failed',
            help='Types d\'uploads à nettoyer (défaut: all_failed)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulation sans suppression réelle'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Forcer la suppression sans confirmation'
        )

    def handle(self, *args, **options):
        self.dry_run = options['dry_run']
        self.force = options['force']
        max_age_hours = options['max_age_hours']
        status_filter = options['status']

        self.stdout.write(
            self.style.SUCCESS(f"🧹 Nettoyage des uploads externes")
        )
        self.stdout.write(f"   📅 Âge maximum: {max_age_hours} heures")
        self.stdout.write(f"   📊 Filtre statut: {status_filter}")
        if self.dry_run:
            self.stdout.write(self.style.WARNING("   🔍 MODE SIMULATION (dry-run)"))

        # Calculer la date limite
        cutoff_date = timezone.now() - timedelta(hours=max_age_hours)

        # Construire le filtre de requête
        filter_kwargs = {'uploaded_at__lt': cutoff_date}
        
        if status_filter == 'failed_validation':
            filter_kwargs['status'] = 'failed_validation'
        elif status_filter == 'corrupted':
            filter_kwargs['status'] = 'corrupted'
        elif status_filter == 'pending_validation':
            filter_kwargs['status'] = 'pending_validation'
        elif status_filter == 'all_failed':
            filter_kwargs['status__in'] = ['failed_validation', 'corrupted', 'pending_validation']

        # Récupérer les uploads à nettoyer
        uploads_to_clean = UploadedBackup.objects.filter(**filter_kwargs)
        total_uploads = uploads_to_clean.count()

        if total_uploads == 0:
            self.stdout.write(
                self.style.SUCCESS("✅ Aucun upload externe à nettoyer trouvé")
            )
            return

        self.stdout.write(f"\n📋 Uploads externes trouvés à nettoyer: {total_uploads}")
        
        # Afficher la liste des uploads
        for upload in uploads_to_clean:
            age_hours = (timezone.now() - upload.uploaded_at).total_seconds() / 3600
            file_size = "Inconnu"
            if upload.file_path and Path(upload.file_path).exists():
                file_size = f"{Path(upload.file_path).stat().st_size // 1024} KB"
            
            self.stdout.write(
                f"   📤 ID {upload.id}: {upload.upload_name} "
                f"({upload.status}, {age_hours:.1f}h, {file_size})"
            )
            
            if upload.error_message:
                self.stdout.write(f"      ❌ Erreur: {upload.error_message}")

        # Confirmation si pas en mode force
        if not self.force and not self.dry_run:
            self.stdout.write("\n⚠️ Cette opération va:")
            self.stdout.write("   • Supprimer les enregistrements de la base de données")
            self.stdout.write("   • Supprimer les fichiers physiques associés")
            self.stdout.write("   • Supprimer les restaurations externes liées")
            
            confirm = input("\nÊtes-vous sûr de vouloir continuer ? (oui/non): ")
            if confirm.lower() not in ['oui', 'o', 'yes', 'y']:
                self.stdout.write(self.style.WARNING("🚫 Opération annulée"))
                return

        # Effectuer le nettoyage
        cleaned_files = 0
        cleaned_uploads = 0
        cleaned_restorations = 0

        for upload in uploads_to_clean:
            # Supprimer les restaurations externes liées
            related_restorations = ExternalRestoration.objects.filter(uploaded_backup=upload)
            restoration_count = related_restorations.count()
            
            if not self.dry_run:
                related_restorations.delete()
            cleaned_restorations += restoration_count

            # Supprimer le fichier physique
            if upload.file_path and Path(upload.file_path).exists():
                try:
                    if not self.dry_run:
                        Path(upload.file_path).unlink()
                    cleaned_files += 1
                    self.stdout.write(f"   🗑️ Fichier supprimé: {upload.file_path}")
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"   ❌ Erreur suppression fichier {upload.file_path}: {e}")
                    )

            # Supprimer l'enregistrement
            if not self.dry_run:
                upload.delete()
            cleaned_uploads += 1

        # Nettoyer les répertoires vides
        external_service = ExternalRestoreService()
        upload_dir = external_service._create_isolated_upload_directory()
        
        if not self.dry_run:
            self._cleanup_empty_directories(upload_dir)

        # Résumé final
        self.stdout.write(f"\n📊 Résumé du nettoyage:")
        self.stdout.write(f"   📤 Uploads supprimés: {cleaned_uploads}")
        self.stdout.write(f"   🗑️ Fichiers supprimés: {cleaned_files}")
        self.stdout.write(f"   🔄 Restaurations supprimées: {cleaned_restorations}")

        if self.dry_run:
            self.stdout.write(
                self.style.WARNING("🔍 Simulation terminée - aucun changement effectué")
            )
        else:
            self.stdout.write(
                self.style.SUCCESS("✅ Nettoyage terminé avec succès")
            )

    def _cleanup_empty_directories(self, base_dir):
        """Supprime les répertoires vides dans le répertoire des uploads"""
        try:
            for item in base_dir.rglob('*'):
                if item.is_dir() and not any(item.iterdir()):
                    try:
                        item.rmdir()
                        self.stdout.write(f"   📁 Répertoire vide supprimé: {item}")
                    except OSError:
                        pass  # Répertoire non vide ou erreur de permission
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(f"⚠️ Erreur lors du nettoyage des répertoires: {e}")
            ) 