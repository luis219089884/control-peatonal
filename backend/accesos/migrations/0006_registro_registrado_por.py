from django.db import migrations, models
import django.db.models.deletion


def backfill_registrado_por(apps, schema_editor):
    RegistroIngreso = apps.get_model("accesos", "RegistroIngreso")
    for reg in RegistroIngreso.objects.select_related("guardia").filter(registrado_por__isnull=True):
        if reg.guardia_id:
            reg.registrado_por_id = reg.guardia.usuario_id
            reg.save(update_fields=["registrado_por_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("accesos", "0005_normalizar_nombres_portones"),
    ]

    operations = [
        migrations.AddField(
            model_name="registroingreso",
            name="registrado_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="registros_operados",
                to="usuarios.usuario",
            ),
        ),
        migrations.AlterField(
            model_name="registroingreso",
            name="guardia",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                to="accesos.guardia",
            ),
        ),
        migrations.RunPython(backfill_registrado_por, migrations.RunPython.noop),
    ]
