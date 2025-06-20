#!/usr/bin/env python3

import os
import sys
import django

# Configuration Django
sys.path.append('/Users/ronanjacques/Documents/GitHub/cochin-project-manager/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from backup_manager.models import RestoreHistory, BackupHistory

def main():
    print('💾 ÉTAT BASE DE DONNÉES:')
    print(f'   📂 BackupHistory: {BackupHistory.objects.count()} entrées')
    print(f'   🔄 RestoreHistory: {RestoreHistory.objects.count()} entrées')
    
    # Restaurations en cours
    rh = RestoreHistory.objects.filter(status='in_progress')
    print(f'   ⏳ Restaurations en cours: {rh.count()}')
    if rh.exists():
        for r in rh:
            print(f'      - ID {r.id}: {r.operation_type} ({r.created_at})')
    
    # Sauvegardes en cours
    bh = BackupHistory.objects.filter(status='in_progress')
    print(f'   ⏳ Sauvegardes en cours: {bh.count()}')
    if bh.exists():
        for b in bh:
            print(f'      - ID {b.id}: {b.backup_type} ({b.created_at})')

    # Dernières opérations
    print('\n📋 DERNIÈRES OPÉRATIONS:')
    print('   Sauvegardes récentes:')
    for b in BackupHistory.objects.order_by('-created_at')[:5]:
        print(f'      - ID {b.id}: {b.status} - {b.backup_type} - {b.backup_name} ({b.created_at})')
    
    print('   Restaurations récentes:')
    for r in RestoreHistory.objects.order_by('-created_at')[:3]:
        try:
            operation_type = r.operation_type if hasattr(r, 'operation_type') else r.restore_type
            print(f'      - ID {r.id}: {r.status} - {operation_type} ({r.created_at})')
        except Exception:
            print(f'      - ID {r.id}: {r.status} - unknown ({r.created_at})')

if __name__ == '__main__':
    main() 