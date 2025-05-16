from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinLengthValidator
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

class User(AbstractUser):
    """
    Custom user model to meet ANSSI security requirements.
    """
    # Additional fields
    last_password_change = models.DateTimeField(
        _('date of last password change'),
        default=timezone.now
    )
    failed_login_attempts = models.PositiveIntegerField(
        _('failed login attempts'),
        default=0
    )
    account_locked_until = models.DateTimeField(
        _('account locked until'),
        null=True,
        blank=True
    )
    is_password_expired = models.BooleanField(
        _('password expired'),
        default=False
    )
    require_password_change = models.BooleanField(
        _('password change required'),
        default=True
    )
    
    # Model settings
    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        
    def __str__(self):
        return self.username
    
    def lock_account(self, duration_minutes=15):
        """
        Lock the user account for a specified duration
        """
        from django.utils import timezone
        import datetime
        
        self.account_locked_until = timezone.now() + datetime.timedelta(minutes=duration_minutes)
        self.save(update_fields=['account_locked_until'])
        
    def is_account_locked(self):
        """
        Check if the account is locked
        """
        from django.utils import timezone
        
        if self.account_locked_until and self.account_locked_until > timezone.now():
            return True
        
        # If the lock has expired, reset the login attempts
        if self.account_locked_until and self.account_locked_until <= timezone.now():
            self.failed_login_attempts = 0
            self.account_locked_until = None
            self.save(update_fields=['failed_login_attempts', 'account_locked_until'])
            
        return False
    
    def increment_failed_login(self):
        """
        Increment the failed login attempts counter
        and lock the account if necessary
        """
        self.failed_login_attempts += 1
        
        # Lock the account after 5 failed attempts
        if self.failed_login_attempts >= 5:
            self.lock_account()
        
        self.save(update_fields=['failed_login_attempts'])
        
    def reset_failed_login(self):
        """
        Reset the failed login attempts counter
        """
        self.failed_login_attempts = 0
        self.save(update_fields=['failed_login_attempts'])
    
    def check_password_expiry(self):
        """
        Check if the password has expired (90 days according to ANSSI recommendations)
        """
        from django.utils import timezone
        import datetime
        from django.conf import settings
        
        password_expiry_days = getattr(settings, 'PASSWORD_EXPIRY_DAYS', 90)
        password_max_age = datetime.timedelta(days=password_expiry_days)
        
        if self.last_password_change + password_max_age < timezone.now():
            self.is_password_expired = True
            self.require_password_change = True
            self.save(update_fields=['is_password_expired', 'require_password_change'])
            
        return self.is_password_expired
        
    def set_password(self, raw_password):
        """
        Override the set_password method to update the password change date
        """
        from django.utils import timezone
        
        # Call the parent class method
        super().set_password(raw_password)
        
        # Update the password change date
        self.last_password_change = timezone.now()
        
        # Reset the password flags
        self.is_password_expired = False
        self.require_password_change = False


class PasswordHistory(models.Model):
    """
    Model to store the password history of users
    to prevent the reuse of recent passwords.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_history',
        verbose_name=_('user')
    )
    password = models.CharField(
        _('password'),
        max_length=128
    )
    created_at = models.DateTimeField(
        _('creation date'),
        auto_now_add=True
    )
    
    class Meta:
        verbose_name = _('password history')
        verbose_name_plural = _('password histories')
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.user.username} - {self.created_at}"
    
    def check_password(self, raw_password):
        """
        Check if the provided password matches this historical password
        """
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password)          