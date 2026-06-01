from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accesos', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='personafacultad',
            name='paralelo',
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
    ]
