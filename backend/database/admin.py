# backend/database/admin.py
from django.contrib import admin
from .models import DynamicTable, DynamicField, DynamicRecord, DynamicValue

class DynamicFieldInline(admin.TabularInline):
    model = DynamicField
    fk_name = 'table'
    extra = 1
    fields = ['name', 'field_type', 'is_required', 'is_unique', 'is_searchable', 'order']

@admin.register(DynamicTable)
class DynamicTableAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'created_at', 'is_active')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [DynamicFieldInline]

@admin.register(DynamicField)
class DynamicFieldAdmin(admin.ModelAdmin):
    list_display = ('name', 'table', 'field_type', 'is_required', 'is_unique', 'order', 'is_active')
    list_filter = ('table', 'field_type', 'is_required', 'is_active')
    search_fields = ('name', 'slug', 'description', 'table__name')
    prepopulated_fields = {'slug': ('name',)}

class DynamicValueInline(admin.TabularInline):
    model = DynamicValue
    extra = 1

@admin.register(DynamicRecord)
class DynamicRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'table', 'created_at', 'updated_at', 'is_active')
    list_filter = ('table', 'is_active', 'created_at')
    inlines = [DynamicValueInline]

@admin.register(DynamicValue)
class DynamicValueAdmin(admin.ModelAdmin):
    list_display = ('record', 'field', 'value')
    list_filter = ('field__table', 'field')
    search_fields = ('value', 'field__name', 'record__id')