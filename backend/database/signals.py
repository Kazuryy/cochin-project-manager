# backend/database/signals.py
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.utils.text import slugify
from django.core.exceptions import ValidationError
from .models import DynamicTable, DynamicField
from django.db import models
from .models import DynamicRecord
from conditional_fields.models import ConditionalFieldRule

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

@receiver(post_save, sender=DynamicRecord)
def auto_create_conditional_rules(sender, instance, created, **kwargs):
    """
    Crée automatiquement les règles conditionnelles quand un nouveau type est ajouté dans TableNames
    """
    if not created:
        return
    
    # Vérifier si c'est un enregistrement dans la table TableNames/Types
    if not instance.table or not instance.table.name.lower() in ['tablenames', 'table_names', 'types']:
        return
    
    try:
        # Récupérer le nom du type depuis les valeurs
        type_name = None
        for value in instance.values.all():
            if value.field.name.lower() in ['nom', 'name', 'title', 'titre', 'label']:
                type_name = value.value.strip()
                break
        
        if not type_name:
            return
        
        # Trouver les tables nécessaires
        project_table = DynamicTable.objects.filter(name__icontains='projet').first()
        choix_table = DynamicTable.objects.filter(name='Choix').first()
        
        if not project_table or not choix_table:
            return
        
        # Trouver le champ type_projet
        type_field = project_table.fields.filter(
            models.Q(name__icontains='type') | models.Q(slug__icontains='type')
        ).first()
        
        if not type_field:
            return
        
        # Chercher un champ "Sous type {type_name}" dans la table Choix
        potential_field_names = [
            f"Sous type {type_name}",
            f"sous type {type_name.lower()}",
            f"Sous-type {type_name}",
            f"sous-type {type_name.lower()}"
        ]
        
        auto_detected_field = None
        for field_name in potential_field_names:
            auto_detected_field = choix_table.fields.filter(name__iexact=field_name).first()
            if auto_detected_field:
                break
        
        if auto_detected_field:
            # Créer la règle automatiquement
            rule, created_rule = ConditionalFieldRule.objects.get_or_create(
                parent_table=project_table,
                parent_field=type_field,
                parent_value=type_name.lower(),
                conditional_field_name=auto_detected_field.name.lower().replace(' ', '_'),
                defaults={
                    'conditional_field_label': auto_detected_field.name,
                    'is_required': True,
                    'order': 0,
                    'source_table': choix_table,
                    'source_field': auto_detected_field,
                }
            )
            
            if created_rule:
                print(f"🎯 Signal: Règle auto-créée: {type_name} → {auto_detected_field.name}")
        
    except Exception as e:
        print(f"❌ Erreur dans le signal auto_create_conditional_rules: {e}")