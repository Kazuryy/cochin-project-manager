from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('database', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='dynamicrecord',
            name='discord_start_notified',
            field=models.BooleanField(default=False, verbose_name='notification début envoyée'),
        ),
        migrations.AddField(
            model_name='dynamicrecord',
            name='discord_end_notified',
            field=models.BooleanField(default=False, verbose_name='notification fin envoyée'),
        ),
    ] 