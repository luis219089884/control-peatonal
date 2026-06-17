from django.db import migrations


def normalizar_nombres_portones(apps, schema_editor):
    Ingreso = apps.get_model("accesos", "Ingreso")
    from accesos.utils import normalizar_nombre_porton

    for ingreso in Ingreso.objects.all():
        nuevo = normalizar_nombre_porton(ingreso.nombre)
        if nuevo != ingreso.nombre:
            ingreso.nombre = nuevo
            ingreso.save(update_fields=["nombre"])


class Migration(migrations.Migration):

    dependencies = [
        ("accesos", "0004_fase_a_accesos"),
    ]

    operations = [
        migrations.RunPython(normalizar_nombres_portones, migrations.RunPython.noop),
    ]
