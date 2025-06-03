from django.contrib import admin
from .models import ConditionalFieldRule, ConditionalFieldOption

class ConditionalFieldOptionInline(admin.TabularInline):
    model = ConditionalFieldOption
    extra = 1
    fields = ['value', 'label', 'order']
    ordering = ['order', 'label']

@admin.register(ConditionalFieldRule)
class ConditionalFieldRuleAdmin(admin.ModelAdmin):
    list_display = [
        'parent_table', 'parent_field', 'parent_value', 
        'conditional_field_label', 'conditional_field_name',
        'is_required', 'source_table', 'source_field', 'options_count'
    ]
    list_filter = ['parent_table', 'parent_field', 'is_required', 'source_table']
    search_fields = [
        'parent_value', 'conditional_field_name', 'conditional_field_label'
    ]
    ordering = ['parent_table', 'parent_field', 'order']
    
    fieldsets = (
        ('Configuration parent', {
            'fields': ('parent_table', 'parent_field', 'parent_value')
        }),
        ('Champ conditionnel', {
            'fields': ('conditional_field_name', 'conditional_field_label', 'is_required')
        }),
        ('Source des options', {
            'fields': ('source_table', 'source_field'),
            'description': 'Table et champ d\'où viennent les options (ex: table Choix)'
        }),
        ('Paramètres', {
            'fields': ('order',),
            'classes': ('collapse',)
        })
    )
    
    inlines = [ConditionalFieldOptionInline]
    
    def options_count(self, obj):
        return obj.options.count()
    options_count.short_description = 'Nb options'
    
    def save_model(self, request, obj, form, change):
        if not change:  # Nouveau objet
            obj.created_by = request.user
        
        # Générer automatiquement le nom du champ si pas défini
        if not obj.conditional_field_name:
            obj.generate_field_name()
            
        super().save_model(request, obj, form, change)

@admin.register(ConditionalFieldOption)
class ConditionalFieldOptionAdmin(admin.ModelAdmin):
    list_display = [
        'conditional_rule', 'label', 'value', 'order'
    ]
    list_filter = [
        'conditional_rule__parent_table',
        'conditional_rule__parent_field'
    ]
    search_fields = ['label', 'value']
    ordering = ['conditional_rule', 'order', 'label']
    
    def save_model(self, request, obj, form, change):
        if not change:  # Nouveau objet
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
