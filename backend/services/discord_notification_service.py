import json
import requests
import logging
from django.conf import settings
from datetime import datetime

logger = logging.getLogger(__name__)

class DiscordNotificationService:
    """Service pour envoyer des notifications à Discord via webhook"""
    
    def __init__(self):
        self.webhook_url = settings.DISCORD_WEBHOOK_URL
        
    def send_notification(self, title, message, color=0x5865F2, fields=None, thumbnail=None, footer=None, author=None):
        """
        Envoie une notification à Discord
        
        Args:
            title (str): Titre de la notification
            message (str): Message principal
            color (int): Couleur de l'embed (format hexadécimal)
            fields (list): Liste de champs supplémentaires (dict avec name, value, inline)
            thumbnail (str): URL de la miniature à afficher
            footer (dict): Pied de page avec text et éventuellement icon_url
            author (dict): Auteur avec name et éventuellement icon_url et url
            
        Returns:
            bool: True si envoyé avec succès, False sinon
        """
        if not self.webhook_url:
            logger.warning("Pas d'URL de webhook Discord configurée. Notification non envoyée.")
            return False
            
        # Préparer l'embed
        embed = {
            "title": title,
            "description": message,
            "color": color,
            "timestamp": datetime.now().isoformat(),
        }
        
        # Ajouter les champs si fournis
        if fields:
            embed["fields"] = fields
        
        # Ajouter la miniature si fournie
        if thumbnail:
            embed["thumbnail"] = {"url": thumbnail}
            
        # Ajouter le pied de page si fourni
        if footer:
            embed["footer"] = footer
            
        # Ajouter l'auteur si fourni
        if author:
            embed["author"] = author
            
        # Préparer la payload
        payload = {
            "embeds": [embed]
        }
        
        # Envoyer la requête
        try:
            response = requests.post(
                self.webhook_url,
                data=json.dumps(payload),
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            logger.info(f"Notification Discord envoyée avec succès: {title}")
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Erreur lors de l'envoi de la notification Discord: {e}")
            return False
            
    def send_devis_start_notification(self, devis):
        """
        Envoie une notification pour le début de la période de paiement d'un devis
        
        Args:
            devis: Objet devis avec les informations nécessaires
        """
        # Extraire les informations du devis
        numero = devis.get("numero_devis", "N/A")
        montant = devis.get("montant", 0)
        date_debut = devis.get("date_debut", "N/A")
        date_rendu = devis.get("date_rendu", "N/A")
        agent = devis.get("agent_plateforme", "N/A")
        
        # Formater montant
        try:
            montant_format = f"{float(montant):,.2f}€".replace(",", " ").replace(".", ",")
        except (ValueError, TypeError):
            montant_format = f"{montant}€"
        
        # Calcul des jours délai de paiement
        try:
            from datetime import datetime, date
            date_debut_obj = datetime.strptime(date_debut, '%Y-%m-%d').date()
            date_rendu_obj = datetime.strptime(date_rendu, '%Y-%m-%d').date()
            jours_total = (date_rendu_obj - date_debut_obj).days
            duree = f"{jours_total} jours"
        except (ValueError, TypeError):
            duree = "Non défini"
        
        # Préparer les champs principaux (plus visibles)
        fields = [
            {"name": "💰 Montant à recevoir", "value": montant_format, "inline": True},
            {"name": "⏱️ Délai de paiement", "value": duree, "inline": True},
            {"name": "👤 Agent responsable", "value": agent, "inline": False},
            {"name": "📅 Période de paiement", "value": f"Du **{date_debut}** au **{date_rendu}**", "inline": False},
        ]
        
        # Envoyer la notification avec une présentation améliorée
        return self.send_notification(
            title=f"💸 DÉBUT DÉLAI PAIEMENT: {numero}",
            message="📢 **La période de paiement d'un devis commence aujourd'hui**\n\nMettez en place les suivis nécessaires pour assurer le règlement dans les délais impartis.",
            color=0x3BA55D,  # Vert
            fields=fields,
            footer={"text": "Système de suivi des paiements | Cochin Project Manager"}
        )
        
    def send_devis_end_notification(self, devis):
        """
        Envoie une notification pour la fin du délai de paiement d'un devis
        
        Args:
            devis: Objet devis avec les informations nécessaires
        """
        # Extraire les informations du devis
        numero = devis.get("numero_devis", "N/A")
        montant = devis.get("montant", 0)
        date_debut = devis.get("date_debut", "N/A")
        date_rendu = devis.get("date_rendu", "N/A")
        agent = devis.get("agent_plateforme", "N/A")
        
        # Formater montant
        try:
            montant_format = f"{float(montant):,.2f}€".replace(",", " ").replace(".", ",")
        except (ValueError, TypeError):
            montant_format = f"{montant}€"
            
        # Calcul de la durée totale
        try:
            from datetime import datetime, date
            date_debut_obj = datetime.strptime(date_debut, '%Y-%m-%d').date()
            date_rendu_obj = datetime.strptime(date_rendu, '%Y-%m-%d').date()
            jours_total = (date_rendu_obj - date_debut_obj).days
            duree = f"{jours_total} jours"
        except (ValueError, TypeError):
            duree = "Non défini"
        
        # Préparer les champs principaux avec icônes (plus visibles)
        fields = [
            {"name": "💰 Montant à vérifier", "value": montant_format, "inline": True},
            {"name": "⚠️ Statut", "value": "**ÉCHÉANCE ATTEINTE**", "inline": True},
            {"name": "👤 Agent responsable", "value": agent, "inline": False},
            {"name": "📅 Période de paiement terminée", "value": f"Du **{date_debut}** au **{date_rendu}**", "inline": False},
            {"name": "🔍 Action requise", "value": "Vérifier que le paiement a bien été effectué et relancer si nécessaire", "inline": False},
        ]
        
        # Envoyer la notification avec une présentation améliorée
        return self.send_notification(
            title=f"🚨 FIN DÉLAI PAIEMENT: {numero}",
            message="⏰ **La date limite de paiement est atteinte aujourd'hui**\n\nVérifiez si le paiement a été reçu. Une action peut être nécessaire en cas de non-paiement.",
            color=0xED4245,  # Rouge
            fields=fields,
            footer={"text": "Système de suivi des paiements | Cochin Project Manager"}
        ) 