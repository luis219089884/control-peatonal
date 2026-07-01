from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0007_foto_rostro"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="rostro_descriptor",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
