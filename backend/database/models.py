# backend/database/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
import json
from datetime import date, datetime, timedelta

User = get_user_model()

class DynamicTable(models.Model):
    """
    Définit une table dynamique dans le système.
    """
    name = models.CharField(_('nom de la table'), max_length=64)
    slug = models.SlugField(_('identifiant'), max_length=64, unique=True)
    description = models.TextField(_('description'), blank=True)
    created_at = models.DateTimeField(_('date de création'), auto_now_add=True)
    updated_at = models.DateTimeField(_('date de modification'), auto_now=True)
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='created_tables',
        verbose_name=_('créé par')
    )
    is_active = models.BooleanField(_('active'), default=True)
    
    class Meta:
        verbose_name = _('table dynamique')
        verbose_name_plural = _('tables dynamiques')
        ordering = ['name']
    
    def __str__(self):
        return self.name
    
    def get_fields(self):
        """Retourne tous les champs de cette table"""
        return self.fields.filter(is_active=True).order_by('order')
    
    def get_records(self):
        """Retourne tous les enregistrements de cette table"""
        return DynamicRecord.objects.filter(table=self, is_active=True)

    def get_next_custom_id(self):
        """Génère le prochain ID personnalisé pour cette table"""
        
        # Trouver le dernier ID utilisé pour cette table
        last_record = self.records.filter(is_active=True).order_by('-custom_id').first()
        if last_record and last_record.custom_id:
            return last_record.custom_id + 1
        return 1

    def get_custom_id_field_name(self):
        """Retourne le nom du champ ID personnalisé pour cette table"""
        return f"id_{self.slug}"

class DynamicField(models.Model):
    """
    Définit un champ dans une table dynamique.
    """
    FIELD_TYPES = (
        ('text', _('Texte')),
        ('long_text', _('Texte long')),
        ('number', _('Nombre')),
        ('decimal', _('Nombre décimal')),
        ('date', _('Date')),
        ('datetime', _('Date et heure')),
        ('boolean', _('Booléen')),
        ('choice', _('Choix')),
        ('foreign_key', _('Clé étrangère')),
        ('file', _('Fichier')),
        ('image', _('Image')),
    )
    
    table = models.ForeignKey(
        DynamicTable, 
        on_delete=models.CASCADE, 
        related_name='fields',
        verbose_name=_('table')
    )
    name = models.CharField(_('nom du champ'), max_length=64)
    slug = models.SlugField(_('identifiant'), max_length=64)
    description = models.TextField(_('description'), blank=True)
    field_type = models.CharField(_('type de champ'), max_length=20, choices=FIELD_TYPES)
    is_required = models.BooleanField(_('obligatoire'), default=False)
    is_unique = models.BooleanField(_('unique'), default=False)
    is_searchable = models.BooleanField(_('recherchable'), default=False)
    is_active = models.BooleanField(_('actif'), default=True)
    order = models.PositiveIntegerField(_('ordre'), default=0)
    default_value = models.TextField(_('valeur par défaut'), blank=True)
    options = models.JSONField(_('options'), blank=True, null=True, 
                              help_text=_('Options pour les champs de type choix, stockées en JSON'))
    related_table = models.ForeignKey(
        DynamicTable, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='referenced_by_fields',
        verbose_name=_('table liée')
    )
    
    class Meta:
        verbose_name = _('champ dynamique')
        verbose_name_plural = _('champs dynamiques')
        unique_together = (('table', 'slug'),)
        ordering = ['table', 'order']
    
    def __str__(self):
        return f"{self.table.name} - {self.name}"
    
    def get_options_list(self):
        """Retourne la liste des options pour les champs de type choix"""
        if self.field_type == 'choice' and self.options:
            try:
                return json.loads(self.options)
            except (json.JSONDecodeError, TypeError):
                return []
        return []
    
    def get_foreign_key_choices(self):
        """
        Retourne les choix disponibles pour une clé étrangère avec affichage intelligent
        """
        if self.field_type != 'foreign_key' or not self.related_table:
            return []
        
        choices = []
        related_records = DynamicRecord.objects.filter(
            table=self.related_table,
            is_active=True
        )
        
        # Trouver le meilleur champ pour l'affichage
        display_field = self._find_best_display_field()
        
        for record in related_records:
            # La valeur stockée reste l'ID Django (système actuel)
            record_id = record.id
            
            # Améliorer l'affichage
            if display_field:
                display_value = record.get_value(display_field.slug)
                if display_value:
                    display_text = f"{display_value} (ID: {record_id})"
                else:
                    display_text = f"Enregistrement #{record_id}"
            else:
                display_text = f"Enregistrement #{record_id}"
            
            choices.append({
                'value': record_id,      # ✅ Garde l'ID Django (système actuel)
                'display': display_text  # ✅ Affichage amélioré
            })
        
        return sorted(choices, key=lambda x: x['display'])
    
    def _find_best_display_field(self):
        """
        Trouve le meilleur champ pour afficher la FK (nom, titre, etc.)
        """
        if not self.related_table:
            return None
        
        # Priorité des noms de champs pour l'affichage
        priority_names = [
            'nom', 'name', 'title', 'titre', 'libelle', 'label', 
            'designation', 'description', 'nom_contact', 'nom_client'
        ]
        
        # Chercher par priorité
        for name in priority_names:
            field = self.related_table.fields.filter(
                slug__icontains=name,
                field_type__in=['text', 'long_text'],
                is_active=True
            ).first()
            if field:
                return field
        
        # Sinon, prendre le premier champ texte
        return self.related_table.fields.filter(
            field_type__in=['text', 'long_text'],
            is_active=True
        ).order_by('order').first()

class DynamicRecord(models.Model):
    """
    Stocke un enregistrement dans une table dynamique.
    """
    table = models.ForeignKey(
        DynamicTable, 
        on_delete=models.CASCADE, 
        related_name='records',
        verbose_name=_('table')
    )
    custom_id = models.PositiveIntegerField(_('ID personnalisé'), blank=True, null=True)
    created_at = models.DateTimeField(_('date de création'), auto_now_add=True)
    updated_at = models.DateTimeField(_('date de modification'), auto_now=True)
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='created_records',
        verbose_name=_('créé par')
    )
    updated_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='updated_records',
        verbose_name=_('modifié par')
    )
    is_active = models.BooleanField(_('actif'), default=True)
    
    # Champs pour le suivi des notifications Discord pour les devis
    discord_start_notified = models.BooleanField(_('notification début envoyée'), default=False)
    discord_end_notified = models.BooleanField(_('notification fin envoyée'), default=False)
    
    class Meta:
        verbose_name = _('enregistrement dynamique')
        verbose_name_plural = _('enregistrements dynamiques')
        ordering = ['-updated_at']
        unique_together = [['table', 'custom_id']]
    
    def __str__(self):
        custom_id_display = f" ({self.table.get_custom_id_field_name()}: {self.custom_id})" if self.custom_id else ""
        return f"Enregistrement {self.id}{custom_id_display} - {self.table.name}"
    
    def save(self, *args, **kwargs):
        """Génère automatiquement un custom_id si nécessaire"""
        if not self.custom_id:
            self.custom_id = self.table.get_next_custom_id()
        super().save(*args, **kwargs)

    def get_primary_identifier(self):
        """Retourne l'identifiant principal (custom_id si disponible, sinon id Django)"""
        return self.custom_id if self.custom_id else self.id

    def get_custom_id_field_name(self):
        """Retourne le nom du champ ID personnalisé pour cette table"""
        return self.table.get_custom_id_field_name()

    def get_values(self):
        """Retourne toutes les valeurs de cet enregistrement"""
        return self.values.filter(field__is_active=True)
    
    def get_value(self, field_slug):
        """Retourne la valeur d'un champ spécifique"""
        try:
            return self.values.get(field__slug=field_slug, field__is_active=True).value
        except DynamicValue.DoesNotExist:
            return None
    
    def set_value(self, field_slug, value):
        """Définit la valeur d'un champ spécifique"""
        try:
            field = self.table.fields.get(slug=field_slug, is_active=True)
            dynamic_value, created = DynamicValue.objects.get_or_create(
                record=self,
                field=field,
                defaults={'value': str(value) if value is not None else ''}
            )
            if not created:
                dynamic_value.value = str(value) if value is not None else ''
                dynamic_value.save()
            return True
        except DynamicField.DoesNotExist:
            return False
    
    def get_foreign_key_display(self, field_slug):
        """Retourne l'affichage d'une clé étrangère"""
        try:
            field = self.table.fields.get(slug=field_slug, is_active=True, field_type='foreign_key')
            value = self.get_value(field_slug)
            if not value:
                return None
            
            # Trouver l'enregistrement lié
            try:
                fk_record = DynamicRecord.objects.get(id=int(value), table=field.related_table)
                
                # Trouver un champ texte pour l'affichage
                display_field = field._find_best_display_field()
                if display_field:
                    display_value = fk_record.get_value(display_field.slug)
                    if display_value:
                        return f"{display_value} (ID: {fk_record.id})"
                
                return f"Enregistrement #{fk_record.id}"
            except (DynamicRecord.DoesNotExist, ValueError):
                return f"Enregistrement introuvable (ID: {value})"
            
        except DynamicField.DoesNotExist:
            return None
    
    def is_devis(self):
        """Détermine si cet enregistrement est un devis"""
        return self.table.slug == 'devis'
    
    def check_devis_notifications(self):
        """
        Vérifie si des notifications Discord doivent être envoyées pour ce devis
        Retourne True si une notification a été envoyée
        """
        if not self.is_devis():
            return False
            
        # Vérifier si le devis est actif
        statut = self.get_value('statut')
        if not statut or statut.lower() != 'true':
            return False
            
        # Récupérer les dates
        date_debut_str = self.get_value('date_debut')
        date_rendu_str = self.get_value('date_rendu')
        
        if not date_debut_str or not date_rendu_str:
            return False
            
        try:
            # Convertir les dates (format YYYY-MM-DD)
            date_debut = datetime.strptime(date_debut_str, '%Y-%m-%d').date()
            date_rendu = datetime.strptime(date_rendu_str, '%Y-%m-%d').date()
            today = date.today()
            
            # Notification de début
            if date_debut == today and not self.discord_start_notified:
                from services.discord_notification_service import DiscordNotificationService
                
                # Préparer les données du devis
                devis_data = {
                    'numero_devis': self.get_value('numero_devis'),
                    'montant': self.get_value('montant'),
                    'date_debut': date_debut_str,
                    'date_rendu': date_rendu_str,
                    'agent_plateforme': self.get_value('agent_plateforme')
                }
                
                # Envoyer la notification
                service = DiscordNotificationService()
                if service.send_devis_start_notification(devis_data):
                    self.discord_start_notified = True
                    self.save(update_fields=['discord_start_notified'])
                    return True
            
            # Notification de fin
            if date_rendu == today and not self.discord_end_notified:
                from services.discord_notification_service import DiscordNotificationService
                
                # Préparer les données du devis
                devis_data = {
                    'numero_devis': self.get_value('numero_devis'),
                    'montant': self.get_value('montant'),
                    'date_debut': date_debut_str,
                    'date_rendu': date_rendu_str,
                    'agent_plateforme': self.get_value('agent_plateforme')
                }
                
                # Envoyer la notification
                service = DiscordNotificationService()
                if service.send_devis_end_notification(devis_data):
                    self.discord_end_notified = True
                    self.save(update_fields=['discord_end_notified'])
                    return True
                    
        except (ValueError, TypeError) as e:
            # Erreur de format de date
            print(f"Erreur lors du traitement des dates du devis {self.id}: {e}")
            
        return False

class DynamicValue(models.Model):
    """
    Stocke une valeur pour un champ d'un enregistrement.
    """
    record = models.ForeignKey(
        DynamicRecord, 
        on_delete=models.CASCADE, 
        related_name='values',
        verbose_name=_('enregistrement')
    )
    field = models.ForeignKey(
        DynamicField, 
        on_delete=models.CASCADE, 
        related_name='values',
        verbose_name=_('champ')
    )
    value = models.TextField(_('valeur'), blank=True)
    
    class Meta:
        verbose_name = _('valeur dynamique')
        verbose_name_plural = _('valeurs dynamiques')
        unique_together = (('record', 'field'),)
    
    def __str__(self):
        return f"{self.record} - {self.field.name}: {self.value}"
    
    def _convert_to_int(self, value):
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    def get_formatted_value(self):
        """
        Retourne la valeur formatée selon le type de champ
        """
        if self.value is None:
            return None
        
        field_type = self.field.field_type
        
        if field_type == 'boolean':
            return self.value.lower() in ('true', '1', 't', 'y', 'yes', 'oui')
        
        elif field_type == 'number':
            return self._convert_to_int(self.value)
        
        elif field_type == 'decimal':
            try:
                return float(self.value)
            except (ValueError, TypeError):
                return None
        
        elif field_type == 'choice':
            return self.value
        
        elif field_type == 'foreign_key':
            return self._convert_to_int(self.value)
        
        # Pour les autres types (text, long_text, date, datetime, file, image),
        # on renvoie la valeur telle quelle
        return self.value