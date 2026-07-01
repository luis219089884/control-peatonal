"""Email de recuperación de contraseña vía Brevo API."""
from __future__ import annotations


def enviar_email_recuperacion_password(
    *,
    email_destino: str,
    nombre_usuario: str,
    enlace_recuperacion: str,
    minutos_validez: int,
) -> bool:
    import requests
    from django.conf import settings

    try:
        api_key = settings.BREVO_API_KEY
        if not api_key:
            print("[EMAIL ERROR] BREVO_API_KEY no configurada.")
            return False

        asunto = "Restablecer contraseña — UAGRM Control Peatonal"
        html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#1a3a6b,#2a5298);padding:28px 32px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">UAGRM Control Peatonal</h1>
    <p style="margin:8px 0 0;color:#b8d4f0;font-size:13px;">Recuperación de contraseña</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="margin:0 0 16px;color:#333;font-size:15px;">Hola, <strong>{nombre_usuario}</strong></p>
    <p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.6;">
      Recibimos una solicitud para restablecer la contraseña de tu cuenta.
      Haz clic en el botón para definir una nueva contraseña:
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="{enlace_recuperacion}" style="display:inline-block;background:#8B1A1A;color:#fff;text-decoration:none;
        padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
        Restablecer contraseña
      </a>
    </p>
    <p style="margin:0 0 12px;color:#888;font-size:12px;line-height:1.5;">
      Este enlace es válido por <strong>{minutos_validez} minutos</strong> y solo puede usarse una vez.
    </p>
    <p style="margin:0;color:#aaa;font-size:11px;word-break:break-all;">
      Si el botón no funciona, copia este enlace:<br/>{enlace_recuperacion}
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
    <p style="margin:0;color:#999;font-size:12px;">
      Si no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá siendo la misma.
    </p>
  </td></tr>
  <tr><td style="background:#f8f9fa;padding:16px 32px;text-align:center;">
    <p style="margin:0;color:#aaa;font-size:11px;">Universidad Autónoma Gabriel René Moreno</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""

        texto = (
            f"Hola {nombre_usuario},\n\n"
            f"Para restablecer tu contraseña visita:\n{enlace_recuperacion}\n\n"
            f"Válido por {minutos_validez} minutos.\n\n"
            "Si no solicitaste esto, ignora este mensaje.\n"
        )

        payload = {
            "sender": {
                "name": settings.BREVO_SENDER_NAME,
                "email": settings.BREVO_SENDER_EMAIL,
            },
            "to": [{"email": email_destino}],
            "subject": asunto,
            "htmlContent": html,
            "textContent": texto,
        }

        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            json=payload,
            headers={
                "api-key": api_key,
                "content-type": "application/json",
            },
            timeout=15,
        )
        if response.status_code in (200, 201):
            return True
        print(f"[EMAIL ERROR] Brevo API respondió {response.status_code}: {response.text}")
        return False
    except Exception as e:
        import traceback

        print(f"[EMAIL ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        return False
