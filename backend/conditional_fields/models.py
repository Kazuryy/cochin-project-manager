from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from database.models import DynamicTable, DynamicField

User = get_user_model()

class ConditionalFieldRule(models.Model):
    """
    Règle définissant un champ conditionnel
    Définit quels champs supplémentaires apparaissent selon la valeur d'un champ parent
    """
    parent_table = models.ForeignKey(DynamicTable, on_delete=models.CASCADE, related_name='conditional_rules')
    parent_field = models.ForeignKey(DynamicField, on_delete=models.CASCADE, related_name='conditional_rules')
    parent_value = models.CharField(max_length=100, help_text="Valeur qui déclenche l'apparition du champ conditionnel")
    
    conditional_field_name = models.CharField(max_length=100, help_text="Nom technique du champ conditionnel")
    conditional_field_label = models.CharField(max_length=200, help_text="Label affiché du champ conditionnel")
    is_required = models.BooleanField(default=True)
    order = models.IntegerField(default=0, help_text="Ordre d'affichage")
    
    # Nouveaux champs pour référencer la source des options
    source_table = models.ForeignKey(DynamicTable, on_delete=models.CASCADE, null=True, blank=True, 
                                   related_name='sourced_conditional_rules',
                                   help_text="Table source pour les options (ex: table Choix)")
    source_field = models.ForeignKey(DynamicField, on_delete=models.CASCADE, null=True, blank=True,
                                   related_name='sourced_conditional_rules',
                                   help_text="Champ source pour les options")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_conditional_rules',
        verbose_name=_('Créé par')
    )
    
    class Meta:
        verbose_name = _('Règle de champ conditionnel')
        verbose_name_plural = _('Règles de champs conditionnels')
        unique_together = ['parent_table', 'parent_field', 'parent_value', 'conditional_field_name']
        ordering = ['order', 'conditional_field_label']
    
    def __str__(self):
        return f"{self.parent_field.name}={self.parent_value} → {self.conditional_field_label}"
    
    def generate_field_name(self):
        """Génère automatiquement le nom du champ basé sur la valeur parent"""
        if not self.conditional_field_name:
            # Nettoyer et formater la valeur parent
            clean_value = self.parent_value.lower().strip()
            clean_value = clean_value.replace(' ', '_').replace('-', '_')
            # Garder seulement les caractères alphanumériques et underscores
            import re
            clean_value = re.sub(r'[^a-z0-9_]', '', clean_value)
            self.conditional_field_name = f"{clean_value}_sous_type"
        return self.conditional_field_name

class ConditionalFieldOption(models.Model):
    """
    Options disponibles pour un champ conditionnel
    """
    conditional_rule = models.ForeignKey(ConditionalFieldRule, on_delete=models.CASCADE, related_name='options')
    value = models.CharField(max_length=100, help_text="Valeur technique de l'option")
    label = models.CharField(max_length=200, help_text="Label affiché de l'option")
    order = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_conditional_options',
        verbose_name=_('Créé par')
    )
    
    class Meta:
        verbose_name = _('Option de champ conditionnel')
        verbose_name_plural = _('Options de champs conditionnels')
        unique_together = ['conditional_rule', 'value']
        ordering = ['order', 'label']
    
    def __str__(self):
        return f"{self.conditional_rule} → {self.label}"
