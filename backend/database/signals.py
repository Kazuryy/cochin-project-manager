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
    ou assure son unicité s'il est fourni
    """
    if not instance.slug:
        from django.utils.text import slugify
        instance.slug = slugify(instance.name)
        
        # Fallback si le slug est vide après slugify
        if not instance.slug:
            instance.slug = 'table'
    
    # Vérifier l'unicité du slug actuel
    original_slug = instance.slug
    query = DynamicTable.objects.filter(slug=instance.slug)
    
    # Exclure l'instance actuelle si on met à jour
    if instance.pk:
        query = query.exclude(pk=instance.pk)
        
    # Si le slug existe déjà, générer un identifiant aléatoire
    if query.exists():
        import uuid
        # Utiliser les 6 premiers caractères d'un UUID
        suffix = str(uuid.uuid4())[:6]
        instance.slug = f"{original_slug}-{suffix}"

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