# backend/database/signals.py
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.utils.text import slugify
from django.core.exceptions import ValidationError
from .models import DynamicTable, DynamicField

@receiver(pre_save, sender=DynamicTable)
def create_table_slug(sender, instance, **kwargs):
    """
    Génère automatiquement le slug de la table s'il n'est pas défini
    """
    if not instance.slug:
        base_slug = slugify(instance.name)
        slug = base_slug
        counter = 1
        
        # Vérifier si le slug existe déjà
        while DynamicTable.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
            
        instance.slug = slug

@receiver(pre_save, sender=DynamicField)
def create_field_slug(sender, instance, **kwargs):
    """
    Génère automatiquement le slug du champ s'il n'est pas défini
    """
    if not instance.slug:
        base_slug = slugify(instance.name)
        slug = base_slug
        counter = 1
        
        # Vérifier si le slug existe déjà dans la même table
        while DynamicField.objects.filter(table=instance.table, slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
            
        instance.slug = slug

@receiver(pre_save, sender=DynamicField)
def validate_field_options(sender, instance, **kwargs):
    """
    Valide les options des champs selon leur type
    """
    if instance.field_type == 'choice' and not instance.options:
        raise ValidationError({'options': 'Les options sont requises pour les champs de type choix.'})
    
    if instance.field_type == 'foreign_key' and not instance.related_table:
        raise ValidationError({'related_table': 'Une table liée est requise pour les champs de type clé étrangère.'})