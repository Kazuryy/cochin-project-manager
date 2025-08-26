# Generated migration to handle existing table conflict
from django.db import migrations, connection

def check_table_exists_forward(apps, schema_editor):
    """Vérifie si les tables existent déjà et ajuste en conséquence"""
    with connection.cursor() as cursor:
        # Vérifier si la table existe déjà
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='conditional_fields_conditionalfieldrule'
        """)
        table_exists = cursor.fetchone()
        
        if table_exists:
            print("✅ Table conditional_fields_conditionalfieldrule existe déjà - migration skippée")
        else:
            print("ℹ️ Table conditional_fields_conditionalfieldrule n'existe pas - création normale")

def check_table_exists_reverse(apps, schema_editor):
    """Migration inverse - ne fait rien"""
    pass

class Migration(migrations.Migration):
    
    dependencies = [
        ('conditional_fields', '0001_initial'),
    ]
    
    operations = [
        migrations.RunPython(
            check_table_exists_forward,
            check_table_exists_reverse,
        ),
    ]
