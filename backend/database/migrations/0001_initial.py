# Generated by Django 5.2.1 on 2025-06-17 14:10

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DynamicTable',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=64, verbose_name='nom de la table')),
                ('slug', models.SlugField(max_length=64, unique=True, verbose_name='identifiant')),
                ('description', models.TextField(blank=True, verbose_name='description')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='date de création')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='date de modification')),
                ('is_active', models.BooleanField(default=True, verbose_name='active')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_tables', to=settings.AUTH_USER_MODEL, verbose_name='créé par')),
            ],
            options={
                'verbose_name': 'table dynamique',
                'verbose_name_plural': 'tables dynamiques',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='DynamicRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('custom_id', models.PositiveIntegerField(blank=True, null=True, verbose_name='ID personnalisé')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='date de création')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='date de modification')),
                ('is_active', models.BooleanField(default=True, verbose_name='actif')),
                ('discord_start_notified', models.BooleanField(default=False, verbose_name='notification début envoyée')),
                ('discord_end_notified', models.BooleanField(default=False, verbose_name='notification fin envoyée')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_records', to=settings.AUTH_USER_MODEL, verbose_name='créé par')),
                ('updated_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_records', to=settings.AUTH_USER_MODEL, verbose_name='modifié par')),
                ('table', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='records', to='database.dynamictable', verbose_name='table')),
            ],
            options={
                'verbose_name': 'enregistrement dynamique',
                'verbose_name_plural': 'enregistrements dynamiques',
                'ordering': ['-updated_at'],
                'unique_together': {('table', 'custom_id')},
            },
        ),
        migrations.CreateModel(
            name='DynamicField',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=64, verbose_name='nom du champ')),
                ('slug', models.SlugField(max_length=64, verbose_name='identifiant')),
                ('description', models.TextField(blank=True, verbose_name='description')),
                ('field_type', models.CharField(choices=[('text', 'Texte'), ('long_text', 'Texte long'), ('number', 'Nombre'), ('decimal', 'Nombre décimal'), ('date', 'Date'), ('datetime', 'Date et heure'), ('boolean', 'Booléen'), ('choice', 'Choix'), ('foreign_key', 'Clé étrangère'), ('file', 'Fichier'), ('image', 'Image')], max_length=20, verbose_name='type de champ')),
                ('is_required', models.BooleanField(default=False, verbose_name='obligatoire')),
                ('is_unique', models.BooleanField(default=False, verbose_name='unique')),
                ('is_searchable', models.BooleanField(default=False, verbose_name='recherchable')),
                ('is_active', models.BooleanField(default=True, verbose_name='actif')),
                ('order', models.PositiveIntegerField(default=0, verbose_name='ordre')),
                ('default_value', models.TextField(blank=True, verbose_name='valeur par défaut')),
                ('options', models.JSONField(blank=True, help_text='Options pour les champs de type choix, stockées en JSON', null=True, verbose_name='options')),
                ('related_table', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='referenced_by_fields', to='database.dynamictable', verbose_name='table liée')),
                ('table', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fields', to='database.dynamictable', verbose_name='table')),
            ],
            options={
                'verbose_name': 'champ dynamique',
                'verbose_name_plural': 'champs dynamiques',
                'ordering': ['table', 'order'],
                'unique_together': {('table', 'slug')},
            },
        ),
        migrations.CreateModel(
            name='DynamicValue',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('value', models.TextField(blank=True, verbose_name='valeur')),
                ('field', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='values', to='database.dynamicfield', verbose_name='champ')),
                ('record', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='values', to='database.dynamicrecord', verbose_name='enregistrement')),
            ],
            options={
                'verbose_name': 'valeur dynamique',
                'verbose_name_plural': 'valeurs dynamiques',
                'unique_together': {('record', 'field')},
            },
        ),
    ]
