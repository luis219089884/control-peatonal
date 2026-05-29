from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0002_add_totp_2fa"),
    ]

    operations = [
        migrations.AddField(
            model_name="empresaexterna",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("externa", "Empresa externa / contratista"),
                    ("seguridad", "Empresa de seguridad"),
                ],
                default="externa",
                max_length=20,
            ),
        ),
    ]
