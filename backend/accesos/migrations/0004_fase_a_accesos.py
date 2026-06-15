"""
Fase A — Migración base de datos para sistema de entradas/salidas por sede.

Cambios:
1. Ingreso: agrega FK a Sede (portón perimetral), facultad pasa a opcional.
2. QrToken: agrega tipo_movimiento (entrada|salida), mejora índices.
3. RegistroIngreso: renombra conceptualmente a RegistroAcceso agregando
   tipo_movimiento, metodo, sede_acceso, campos logísticos y haciendo token nullable.

Data migrations:
- Populate ingreso.sede desde ingreso.facultad.sede para registros existentes.
- Populate registroingreso.sede_acceso desde registroingreso.ingreso.facultad.sede.
- Set tipo_movimiento='entrada' en todos los registros existentes (históricamente son entradas).
"""
from django.db import migrations, models
import django.db.models.deletion


def poblar_sede_en_ingresos(apps, schema_editor):
    """Copia la sede de la facultad a cada portón existente."""
    Ingreso = apps.get_model("accesos", "Ingreso")
    for ingreso in Ingreso.objects.select_related("facultad__sede").all():
        if ingreso.facultad_id and ingreso.sede_id is None:
            ingreso.sede_id = ingreso.facultad.sede_id
            ingreso.save(update_fields=["sede_id"])


def poblar_sede_en_registros(apps, schema_editor):
    """Copia la sede del portón a cada registro existente."""
    RegistroIngreso = apps.get_model("accesos", "RegistroIngreso")
    for reg in RegistroIngreso.objects.select_related(
        "ingreso__sede", "ingreso__facultad__sede"
    ).all():
        sede_id = None
        if reg.ingreso.sede_id:
            sede_id = reg.ingreso.sede_id
        elif reg.ingreso.facultad_id:
            sede_id = reg.ingreso.facultad.sede_id
        if sede_id:
            reg.sede_acceso_id = sede_id
            reg.save(update_fields=["sede_acceso_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("accesos", "0003_personafacultad_modalidad_periodo"),
        ("usuarios", "0004_administrativo_nivel_direccion"),
    ]

    operations = [
        # ── 1. Ingreso: agregar sede (FK a Sede), hacer facultad opcional ──
        migrations.AddField(
            model_name="ingreso",
            name="sede",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="ingresos",
                to="usuarios.sede",
            ),
        ),
        migrations.AlterField(
            model_name="ingreso",
            name="facultad",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                to="usuarios.facultad",
            ),
        ),
        migrations.AlterModelOptions(
            name="ingreso",
            options={
                "verbose_name": "Portón / Punto de acceso",
                "verbose_name_plural": "Portones / Puntos de acceso",
            },
        ),

        # ── Data migration: copiar sede de facultad a ingresos ──
        migrations.RunPython(poblar_sede_en_ingresos, migrations.RunPython.noop),

        # ── 2. QrToken: agregar tipo_movimiento, nuevos índices ──
        migrations.AddField(
            model_name="qrtoken",
            name="tipo_movimiento",
            field=models.CharField(
                choices=[("entrada", "Entrada"), ("salida", "Salida")],
                default="entrada",
                max_length=10,
            ),
        ),
        # El index_together de QrToken incluye ("token_hash",) que convive con el
        # UNIQUE constraint del mismo campo. AlterIndexTogether falla en ese caso
        # porque encuentra 2 constraints para token_hash.
        # Solución: eliminar manualmente el índice non-unique antes de llamar
        # a AlterIndexTogether.
        migrations.RunSQL(
            sql='DROP INDEX IF EXISTS "accesos_qrtoken_token_hash_7e3886ae_idx";',
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.AlterIndexTogether(
            name="qrtoken",
            index_together=set(),
        ),
        migrations.AddIndex(
            model_name="qrtoken",
            index=models.Index(fields=["expira_en", "usado"], name="qrt_expira_usado_idx"),
        ),
        migrations.AddIndex(
            model_name="qrtoken",
            index=models.Index(
                fields=["usuario", "tipo_movimiento", "generado_en"],
                name="qrt_usuario_mov_gen_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="qrtoken",
            index=models.Index(
                fields=["invitado", "tipo_movimiento"],
                name="qrt_invitado_mov_idx",
            ),
        ),

        # ── 3. RegistroIngreso: nuevos campos ──
        migrations.AddField(
            model_name="registroingreso",
            name="tipo_movimiento",
            field=models.CharField(
                choices=[("entrada", "Entrada"), ("salida", "Salida")],
                default="entrada",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="registroingreso",
            name="metodo",
            field=models.CharField(
                choices=[
                    ("qr", "Código QR"),
                    ("manual", "Manual (registro universitario)"),
                    ("logistico", "Logístico / Entrega rápida"),
                ],
                default="qr",
                max_length=15,
            ),
        ),
        migrations.AddField(
            model_name="registroingreso",
            name="sede_acceso",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="registros_acceso",
                to="usuarios.sede",
            ),
        ),
        migrations.AddField(
            model_name="registroingreso",
            name="ci_logistico",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="registroingreso",
            name="motivo_logistico",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        # token pasa a ser nullable (manual/logístico no tienen QR)
        migrations.AlterField(
            model_name="registroingreso",
            name="token",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                to="accesos.qrtoken",
            ),
        ),
        # tipo_persona agrega logistico
        migrations.AlterField(
            model_name="registroingreso",
            name="tipo_persona",
            field=models.CharField(
                choices=[
                    ("estudiante", "Estudiante"),
                    ("docente", "Docente"),
                    ("administrativo", "Administrativo"),
                    ("personal_externo", "Personal Externo"),
                    ("invitado", "Invitado"),
                    ("logistico", "Logístico / Entrega"),
                ],
                max_length=30,
            ),
        ),

        # ── Data migration: poblar sede_acceso en registros históricos ──
        migrations.RunPython(poblar_sede_en_registros, migrations.RunPython.noop),

        # ── Nuevos índices en RegistroIngreso ──
        migrations.AlterIndexTogether(
            name="registroingreso",
            index_together=set(),
        ),
        migrations.AddIndex(
            model_name="registroingreso",
            index=models.Index(fields=["fecha_hora"], name="reg_fecha_hora_idx"),
        ),
        migrations.AddIndex(
            model_name="registroingreso",
            index=models.Index(fields=["usuario", "fecha_hora"], name="reg_usuario_fecha_idx"),
        ),
        migrations.AddIndex(
            model_name="registroingreso",
            index=models.Index(fields=["ingreso", "fecha_hora"], name="reg_ingreso_fecha_idx"),
        ),
        migrations.AddIndex(
            model_name="registroingreso",
            index=models.Index(
                fields=["sede_acceso", "fecha_hora"], name="reg_sede_fecha_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="registroingreso",
            index=models.Index(
                fields=["usuario", "sede_acceso", "acceso_permitido", "fecha_hora"],
                name="reg_adentro_usuario_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="registroingreso",
            index=models.Index(
                fields=["invitado", "sede_acceso", "acceso_permitido", "fecha_hora"],
                name="reg_adentro_invitado_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="registroingreso",
            index=models.Index(
                fields=["tipo_movimiento", "metodo", "fecha_hora"],
                name="reg_mov_metodo_fecha_idx",
            ),
        ),
    ]
