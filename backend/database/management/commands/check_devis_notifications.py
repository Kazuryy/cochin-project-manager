from django.core.management.base import BaseCommand
from django.utils import timezone
from database.models import DynamicTable, DynamicRecord
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Vérifie et envoie les notifications Discord pour les devis'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force l\'envoi des notifications même si elles ont déjà été envoyées'
        )
        parser.add_argument(
            '--devis-id',
            type=int,
            help='ID spécifique d\'un devis à vérifier'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🔍 Vérification des notifications de devis...'))
        
        force_send = options.get('force', False)
        specific_devis_id = options.get('devis_id')
        
        if force_send:
            self.stdout.write(self.style.WARNING('⚠️ Mode force activé: les notifications seront renvoyées'))
        
        # Trouver la table des devis
        try:
            devis_table = DynamicTable.objects.get(slug='devis')
        except DynamicTable.DoesNotExist:
            self.stdout.write(self.style.WARNING('⚠️ Table des devis introuvable'))
            return
            
        # Récupérer les devis actifs (tous ou un spécifique)
        if specific_devis_id:
            devis_records = DynamicRecord.objects.filter(
                table=devis_table,
                is_active=True,
                id=specific_devis_id
            )
            self.stdout.write(f'🎯 Vérification du devis spécifique ID: {specific_devis_id}')
        else:
            devis_records = DynamicRecord.objects.filter(
                table=devis_table,
                is_active=True
            )
            self.stdout.write(f'📊 {devis_records.count()} devis trouvés')
        
        # Compteurs
        notifications_sent = 0
        errors = 0
        
        # Vérifier chaque devis
        for devis in devis_records:
            try:
                # En mode force, réinitialiser les flags de notification
                if force_send:
                    devis.discord_start_notified = False
                    devis.discord_end_notified = False
                    devis.save(update_fields=['discord_start_notified', 'discord_end_notified'])
                
                if devis.check_devis_notifications():
                    notifications_sent += 1
                    self.stdout.write(f'✅ Notification envoyée pour le devis {devis.id}')
            except Exception as e:
                errors += 1
                logger.error(f"Erreur lors du traitement du devis {devis.id}: {e}")
                self.stdout.write(self.style.ERROR(f'❌ Erreur pour le devis {devis.id}: {e}'))
                
        # Afficher le résultat
        self.stdout.write(self.style.SUCCESS(
            f'✅ Terminé: {notifications_sent} notification(s) envoyée(s), {errors} erreur(s)'
        )) 