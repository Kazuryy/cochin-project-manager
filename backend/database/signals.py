# backend/database/signals.py
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.utils.text import slugify
from django.core.exceptions import ValidationError
from django.db import models
import uuid
import logging

from .models import DynamicTable, DynamicField, DynamicRecord
from conditional_fields.models import ConditionalFieldRule

logger = logging.getLogger(__name__)

# Constantes pour améliorer la lisibilité et éviter les magic strings
TABLE_NAMES_KEYWORDS = ['tablenames', 'table_names', 'types']
TYPE_FIELD_NAMES = ['nom', 'name', 'title', 'titre', 'label']
DEFAULT_SLUG_PREFIX = 'table'
MAX_SLUG_ATTEMPTS = 100  # Protection contre les boucles infinies

@receiver(pre_save, sender=DynamicTable)
def create_table_slug(sender, instance, **kwargs):
    """
    Génère automatiquement le slug de la table s'il n'est pas défini
    ou assure son unicité s'il est fourni
    """
    if not instance.slug:
        # Générer le slug à partir du nom, avec fallback sécurisé
        if instance.name:
            instance.slug = slugify(instance.name) or f"{DEFAULT_SLUG_PREFIX}-{uuid.uuid4().hex[:6]}"
        else:
            instance.slug = f"{DEFAULT_SLUG_PREFIX}-{uuid.uuid4().hex[:6]}"
    
    # Assurer l'unicité du slug
    instance.slug = _ensure_unique_table_slug(instance)

def _ensure_unique_table_slug(instance):
    """
    Helper function pour assurer l'unicité du slug de table
    """
    original_slug = instance.slug
    query = DynamicTable.objects.filter(slug=original_slug)
    
    # Exclure l'instance actuelle si on met à jour
    if instance.pk:
        query = query.exclude(pk=instance.pk)
        
    # Si le slug existe déjà, générer un identifiant unique
    if query.exists():
        suffix = uuid.uuid4().hex[:6]
        return f"{original_slug}-{suffix}"
    
    return original_slug

@receiver(pre_save, sender=DynamicField)
def create_field_slug(sender, instance, **kwargs):
    """
    Génère automatiquement le slug du champ s'il n'est pas défini
    """
    # Vérification de sécurité
    if not instance.table:
        raise ValidationError({'table': 'Le champ doit être associé à une table.'})
    
    if not instance.slug and instance.name:
        instance.slug = _generate_unique_field_slug(instance)

def _generate_unique_field_slug(instance):
    """
    Helper function pour générer un slug unique de champ
    """
    base_slug = slugify(instance.name) or 'field'
    slug = base_slug
    counter = 1
    
    # Protection contre les boucles infinies
    for _ in range(MAX_SLUG_ATTEMPTS):
        if not DynamicField.objects.filter(table=instance.table, slug=slug).exists():
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    # Si on n'arrive pas à trouver un slug unique, utiliser UUID
    return f"{base_slug}-{uuid.uuid4().hex[:6]}"

@receiver(pre_save, sender=DynamicField)
def validate_field_options(sender, instance, **kwargs):
    """
    Valide les options des champs selon leur type
    """
    validations = {
        'choice': {
            'field': 'options',
            'condition': lambda i: not i.options,
            'message': 'Les options sont requises pour les champs de type choix.'
        },
        'foreign_key': {
            'field': 'related_table',
            'condition': lambda i: not i.related_table,
            'message': 'Une table liée est requise pour les champs de type clé étrangère.'
        }
    }
    
    validation = validations.get(instance.field_type)
    if validation and validation['condition'](instance):
        raise ValidationError({validation['field']: validation['message']})

@receiver(post_save, sender=DynamicRecord)
def auto_create_conditional_rules(sender, instance, created, **kwargs):
    """
    Crée automatiquement les règles conditionnelles quand un nouveau type est ajouté
    """
    if not created or not instance.table:
        return
    
    # Vérifier si c'est un enregistrement dans une table de types
    if not _is_type_table(instance.table):
        return
    
    try:
        type_name = _extract_type_name(instance)
        if not type_name:
            return
        
        # Récupérer les tables nécessaires en une seule requête optimisée
        tables = _get_required_tables()
        if not tables['project'] or not tables['choix']:
            return
        
        # Créer la règle conditionnelle
        _create_conditional_rule(type_name, tables)
        
    except (ValidationError, DynamicTable.DoesNotExist, DynamicField.DoesNotExist) as e:
        logger.warning(f"Impossible de créer la règle conditionnelle pour {instance}: {e}")
    except Exception as e:
        logger.error(f"Erreur inattendue dans auto_create_conditional_rules: {e}", exc_info=True)

def _is_type_table(table):
    """Vérifie si la table est une table de types"""
    return table.name.lower() in TABLE_NAMES_KEYWORDS

def _extract_type_name(instance):
    """Extrait le nom du type depuis les valeurs de l'enregistrement"""
    # Optimisation: utiliser select_related pour éviter les requêtes N+1
    values = instance.values.select_related('field').all()
    
    for value in values:
        if value.field.name.lower() in TYPE_FIELD_NAMES:
            return value.value.strip()
    return None

def _get_required_tables():
    """Récupère les tables nécessaires de manière optimisée"""
    tables = DynamicTable.objects.filter(
        models.Q(name__icontains='projet') | models.Q(name='Choix')
    ).prefetch_related('fields')
    
    result = {'project': None, 'choix': None}
    for table in tables:
        if 'projet' in table.name.lower():
            result['project'] = table
        elif table.name == 'Choix':
            result['choix'] = table
    
    return result

def _create_conditional_rule(type_name, tables):
    """Crée la règle conditionnelle si les conditions sont remplies"""
    project_table = tables['project']
    choix_table = tables['choix']
    
    # Trouver le champ type dans la table projet
    type_field = project_table.fields.filter(
        models.Q(name__icontains='type') | models.Q(slug__icontains='type')
    ).first()
    
    if not type_field:
        logger.debug(f"Aucun champ type trouvé dans la table {project_table.name}")
        return
    
    # Chercher le champ correspondant dans la table Choix
    auto_detected_field = _find_matching_choice_field(choix_table, type_name)
    
    if auto_detected_field:
        _, created_rule = ConditionalFieldRule.objects.get_or_create(
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
            logger.info(f"Règle conditionnelle auto-créée: {type_name} → {auto_detected_field.name}")

def _find_matching_choice_field(choix_table, type_name):
    """Trouve le champ correspondant dans la table Choix"""
    # Générer les noms potentiels de manière plus systématique
    potential_patterns = [
        f"Sous type {type_name}",
        f"sous type {type_name.lower()}",
        f"Sous-type {type_name}",
        f"sous-type {type_name.lower()}",
        f"SousType{type_name}",
        f"soustype{type_name.lower()}"
    ]
    
    # Optimisation: une seule requête avec OR pour tous les patterns
    q_objects = models.Q()
    for pattern in potential_patterns:
        q_objects |= models.Q(name__iexact=pattern)
    
    return choix_table.fields.filter(q_objects).first()