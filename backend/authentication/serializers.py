from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.contrib.auth.models import Group, Permission

User = get_user_model()


class GroupSerializer(serializers.ModelSerializer):
    """Serializer pour les groupes d'utilisateurs"""
    class Meta:
        model = Group
        fields = ['id', 'name']


class PermissionSerializer(serializers.ModelSerializer):
    """Serializer pour les permissions"""
    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename', 'content_type']


class UserListSerializer(serializers.ModelSerializer):
    """Serializer pour lister les utilisateurs (lecture seule)"""
    full_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    groups_display = serializers.SerializerMethodField()
    last_login_display = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'is_active', 'is_staff', 'is_superuser', 'date_joined', 'last_login',
            'last_login_display', 'failed_login_attempts', 'account_locked_until',
            'is_password_expired', 'require_password_change', 'last_password_change',
            'groups', 'groups_display', 'status'
        ]
        read_only_fields = [
            'id', 'date_joined', 'last_login', 'last_password_change',
            'failed_login_attempts', 'account_locked_until', 'is_password_expired'
        ]

    def get_full_name(self, obj):
        """Retourne le nom complet de l'utilisateur"""
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        return obj.username

    def get_status(self, obj):
        """Retourne le statut de l'utilisateur"""
        if obj.is_account_locked():
            return "verrouillé"
        elif not obj.is_active:
            return "inactif"
        elif obj.is_password_expired:
            return "mot_de_passe_expiré"
        elif obj.require_password_change:
            return "changement_requis"
        else:
            return "actif"

    def get_groups_display(self, obj):
        """Retourne les noms des groupes"""
        return [group.name for group in obj.groups.all()]

    def get_last_login_display(self, obj):
        """Retourne la dernière connexion formatée"""
        if obj.last_login:
            return obj.last_login.strftime('%d/%m/%Y %H:%M')
        return "Jamais connecté"


class UserDetailSerializer(serializers.ModelSerializer):
    """Serializer détaillé pour un utilisateur"""
    groups = GroupSerializer(many=True, read_only=True)
    user_permissions = PermissionSerializer(many=True, read_only=True)
    full_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    password_age_days = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'is_active', 'is_staff', 'is_superuser', 'date_joined', 'last_login',
            'failed_login_attempts', 'account_locked_until', 'is_password_expired',
            'require_password_change', 'last_password_change', 'password_age_days',
            'groups', 'user_permissions', 'status', 'is_locked'
        ]
        read_only_fields = [
            'id', 'date_joined', 'last_login', 'last_password_change',
            'failed_login_attempts', 'account_locked_until', 'is_password_expired',
            'password_age_days', 'is_locked'
        ]

    def get_full_name(self, obj):
        """Retourne le nom complet de l'utilisateur"""
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        return obj.username

    def get_status(self, obj):
        """Retourne le statut détaillé de l'utilisateur"""
        if obj.is_account_locked():
            return "verrouillé"
        elif not obj.is_active:
            return "inactif"
        elif obj.is_password_expired:
            return "mot_de_passe_expiré"
        elif obj.require_password_change:
            return "changement_requis"
        else:
            return "actif"

    def get_password_age_days(self, obj):
        """Retourne l'âge du mot de passe en jours"""
        if obj.last_password_change:
            delta = timezone.now() - obj.last_password_change
            return delta.days
        return None

    def get_is_locked(self, obj):
        """Retourne si le compte est verrouillé"""
        return obj.is_account_locked()


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer pour créer un utilisateur"""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    group_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name', 'password', 
            'password_confirm', 'is_active', 'is_staff', 'is_superuser',
            'require_password_change', 'group_ids'
        ]

    def validate(self, attrs):
        """Validation des données"""
        # Vérifier que les mots de passe correspondent
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError("Les mots de passe ne correspondent pas.")
        
        # Vérifier que l'email n'est pas déjà utilisé
        if User.objects.filter(email=attrs.get('email')).exists():
            raise serializers.ValidationError("Cette adresse email est déjà utilisée.")
        
        return attrs

    def create(self, validated_data):
        """Créer un nouvel utilisateur"""
        # Retirer les champs non-modèle
        validated_data.pop('password_confirm', None)
        group_ids = validated_data.pop('group_ids', [])
        password = validated_data.pop('password')
        
        # Créer l'utilisateur
        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        
        # Assigner les groupes
        if group_ids:
            groups = Group.objects.filter(id__in=group_ids)
            user.groups.set(groups)
        
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer pour mettre à jour un utilisateur"""
    group_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    reset_password = serializers.BooleanField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name', 'is_active', 
            'is_staff', 'is_superuser', 'require_password_change',
            'group_ids', 'reset_password', 'new_password'
        ]

    def validate(self, attrs):
        """Validation des données"""
        # Si un nouveau mot de passe est fourni, valider qu'il n'est pas vide
        if attrs.get('new_password') and not attrs.get('new_password').strip():
            raise serializers.ValidationError("Le nouveau mot de passe ne peut pas être vide.")
        
        return attrs

    def update(self, instance, validated_data):
        """Mettre à jour l'utilisateur"""
        # Traiter les champs spéciaux
        group_ids = validated_data.pop('group_ids', None)
        reset_password = validated_data.pop('reset_password', False)
        new_password = validated_data.pop('new_password', None)
        
        # Mettre à jour les champs standard
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Gérer le changement de mot de passe
        if new_password:
            instance.set_password(new_password)
        elif reset_password:
            instance.require_password_change = True
            instance.is_password_expired = True
        
        # Sauvegarder l'utilisateur
        instance.save()
        
        # Assigner les groupes
        if group_ids is not None:
            groups = Group.objects.filter(id__in=group_ids)
            instance.groups.set(groups)
        
        return instance


class UserActionSerializer(serializers.Serializer):
    """Serializer pour les actions sur les utilisateurs"""
    action = serializers.ChoiceField(choices=[
        'unlock', 'lock', 'reset_attempts', 'force_password_change',
        'activate', 'deactivate', 'make_staff', 'remove_staff'
    ])
    user_ids = serializers.ListField(child=serializers.IntegerField())
    duration_minutes = serializers.IntegerField(required=False, default=15) 