# backend/database/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
import json

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
    
    class Meta:
        verbose_name = _('enregistrement dynamique')
        verbose_name_plural = _('enregistrements dynamiques')
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"Enregistrement {self.id} - {self.table.name}"
    
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
            value_obj, created = DynamicValue.objects.get_or_create(
                record=self,
                field=field,
                defaults={'value': value}
            )
            if not created:
                value_obj.value = value
                value_obj.save()
            return value_obj
        except DynamicField.DoesNotExist:
            return None
        
    def get_foreign_key_display(self, field_slug):
        """
        Retourne une version lisible d'une clé étrangère pour l'affichage
        """
        try:
            field = self.table.fields.get(slug=field_slug, is_active=True)
            if field.field_type != 'foreign_key':
                return None
            
            fk_id = self.get_value(field_slug)
            if not fk_id:
                return None
            
            try:
                # Récupérer l'enregistrement lié par son ID Django
                related_record = DynamicRecord.objects.get(
                    table=field.related_table,
                    id=int(fk_id),
                    is_active=True
                )
                
                # Trouver le meilleur champ d'affichage
                display_field = field._find_best_display_field()
                if display_field:
                    display_value = related_record.get_value(display_field.slug)
                    if display_value:
                        return f"{display_value} (ID: {fk_id})"
                
                return f"Enregistrement #{fk_id}"
                
            except (DynamicRecord.DoesNotExist, ValueError):
                return f"Référence invalide: {fk_id}"
                
        except DynamicField.DoesNotExist:
            return None

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