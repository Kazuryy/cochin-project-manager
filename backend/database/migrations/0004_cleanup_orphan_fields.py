# Generated migration to fix orphan fields issue
from django.db import migrations

def cleanup_orphan_fields_forward(apps, schema_editor):
    """Nettoie les champs orphelins qui empêchent les migrations"""
    DynamicField = apps.get_model('database', 'DynamicField')
    DynamicTable = apps.get_model('database', 'DynamicTable')
    
    # Supprimer tous les champs qui référencent des tables inexistantes
    orphan_count = 0
    for field in DynamicField.objects.all():
        if not DynamicTable.objects.filter(id=field.table_id).exists():
            print(f"🗑️ Suppression champ orphelin: ID={field.id}, Name='{field.name}', Table_ID={field.table_id}")
            field.delete()
            orphan_count += 1
    
    if orphan_count > 0:
        print(f"✅ {orphan_count} champs orphelins supprimés automatiquement")
    else:
        print("✅ Aucun champ orphelin trouvé")

def cleanup_orphan_fields_reverse(apps, schema_editor):
    """Migration inverse - ne fait rien (impossible de recréer les champs)"""
    pass

class Migration(migrations.Migration):
    
    dependencies = [
        ('database', '0003_projectpdffile'),
    ]
    
    operations = [
        migrations.RunPython(
            cleanup_orphan_fields_forward,
            cleanup_orphan_fields_reverse,
        ),
    ]
