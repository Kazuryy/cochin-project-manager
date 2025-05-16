from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
import logging
from .models import PasswordHistory

User = get_user_model()
logger = logging.getLogger(__name__)

@receiver(post_save, sender=User)
def check_password_expiry(sender, instance, created, **kwargs):
    """
    Signal to check the password expiry after each user save
    """
    if not created and instance.last_password_change:
        import datetime
        
        # Calculate the password expiry date
        password_expiry_days = getattr(settings, 'PASSWORD_EXPIRY_DAYS', 90)
        expiry_date = instance.last_password_change + datetime.timedelta(days=password_expiry_days)
        
        # Mark the password as expired if necessary
        if expiry_date <= timezone.now() and not instance.is_password_expired:
            instance.is_password_expired = True
            instance.require_password_change = True
            instance.save(update_fields=['is_password_expired', 'require_password_change'])
            
            logger.info(f"Password expired for user {instance.username}")

@receiver(post_save, sender=User)
def save_password_history(sender, instance, **kwargs):
    """
    Signal to save the password history
    """
    # Check if the password has been modified and is not empty
    if instance.password and instance._password:
        # Save the hashed password in the history
        PasswordHistory.objects.create(
            user=instance,
            password=instance.password
        )
        
        # Limit the history to 5 passwords
        history_limit = getattr(settings, 'PASSWORD_HISTORY_LIMIT', 5)
        old_passwords = PasswordHistory.objects.filter(user=instance).order_by('-created_at')[history_limit:]
        
        if old_passwords.exists():
            old_passwords.delete()
            
        logger.info(f"Password history updated for user {instance.username}")