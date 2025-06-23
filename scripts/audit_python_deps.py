#!/usr/bin/env python3
import subprocess
import sys
import json

def audit_dependencies():
    """Audit des dépendances Python avec safety et pip-audit"""
    
    print("🔍 Audit de sécurité des dépendances Python...")
    
    # Installer les outils d'audit
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "safety", "pip-audit"], 
                  capture_output=True)
    
    # Audit avec safety
    print("📊 Analyse avec Safety...")
    try:
        result = subprocess.run(["safety", "check", "--json"], 
                              capture_output=True, text=True, cwd="backend")
        if result.returncode != 0:
            print("⚠️ Vulnérabilités détectées avec Safety:")
            print(result.stdout)
    except:
        print("⚠️ Safety non disponible")
    
    # Audit avec pip-audit  
    print("📊 Analyse avec pip-audit...")
    try:
        result = subprocess.run(["pip-audit", "--format=json"], 
                              capture_output=True, text=True, cwd="backend")
        if result.returncode != 0:
            print("⚠️ Vulnérabilités détectées avec pip-audit:")
            print(result.stdout)
    except:
        print("⚠️ pip-audit non disponible")

if __name__ == "__main__":
    audit_dependencies()
