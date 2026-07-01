from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accesos", "0006_registro_registrado_por"),
    ]

    operations = [
        migrations.AlterField(
            model_name="registroingreso",
            name="metodo",
            field=models.CharField(
                choices=[
                    ("qr", "Código QR"),
                    ("manual", "Manual (registro universitario)"),
                    ("logistico", "Logístico / Entrega rápida"),
                    ("rostro", "Reconocimiento facial"),
                ],
                default="qr",
                max_length=15,
            ),
        ),
    ]
