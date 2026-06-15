"""
Utilidad para generar imágenes QR y enviar email de invitación UAGRM.
Usa la API REST de Brevo (HTTPS) para evitar bloqueos de puertos SMTP.

Cada invitado recibe DOS códigos QR en el mismo email:
  - QR de ENTRADA  (verde) — un solo uso al ingresar
  - QR de SALIDA   (naranja) — un solo uso al salir
"""
import base64
import io
from datetime import datetime


def _generar_qr_bytes(token_hash: str, size: int = 10) -> bytes:
    """Genera imagen QR del token y la devuelve como bytes PNG."""
    import qrcode
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=size,
        border=3,
    )
    qr.add_data(token_hash)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1a2e5e", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _formatear_fecha(dt: datetime) -> str:
    meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ]
    from zoneinfo import ZoneInfo
    dt_local = dt.astimezone(ZoneInfo("America/La_Paz"))
    return f"{dt_local.day} de {meses[dt_local.month-1]} de {dt_local.year}, {dt_local.strftime('%H:%M')} hrs"


def enviar_email_invitado(
    *,
    email_destino: str,
    nombre_invitado: str,
    registrado_por: str,
    facultad_destino: str,
    motivo_visita: str,
    fecha_visita: str,
    token_entrada: str,
    token_salida: str,
    expira_en: datetime,
    # alias de compatibilidad
    token_hash: str = "",
) -> bool:
    """
    Genera los dos QR (entrada + salida) y envía el email oficial UAGRM via Brevo REST.

    Parámetros:
        token_entrada  — hash del QR de entrada (verde)
        token_salida   — hash del QR de salida  (naranja)
        token_hash     — alias legacy, se ignora si se pasan los tokens separados
    """
    import requests
    from django.conf import settings

    # compatibilidad con llamadas antiguas que solo pasan token_hash
    if token_hash and not token_entrada:
        token_entrada = token_hash
    if not token_salida:
        token_salida = token_entrada

    try:
        api_key = settings.BREVO_API_KEY
        if not api_key:
            print("[EMAIL ERROR] BREVO_API_KEY no configurada.")
            return False

        qr_entrada_b64 = base64.b64encode(_generar_qr_bytes(token_entrada)).decode()
        qr_salida_b64  = base64.b64encode(_generar_qr_bytes(token_salida)).decode()
        expira_str     = _formatear_fecha(expira_en)
        asunto         = f"Invitación de acceso UAGRM — {fecha_visita}"

        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Invitación UAGRM</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="max-width:600px;width:100%;background:#fff;border-radius:16px;
                  overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#0d2149 0%,#1a3a6b 60%,#1e4d8c 100%);
                   padding:36px 40px 28px;text-align:center;">
          <div style="font-size:11px;font-weight:700;letter-spacing:3px;
                      color:rgba(255,255,255,.55);text-transform:uppercase;margin-bottom:6px;">
            Universidad Autónoma Gabriel René Moreno
          </div>
          <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:1px;margin-bottom:4px;">UAGRM</div>
          <div style="font-size:12px;color:rgba(255,255,255,.65);letter-spacing:2px;text-transform:uppercase;margin-top:4px;">
            Sistema de Control Peatonal
          </div>
          <div style="height:3px;background:linear-gradient(90deg,#c8a84b,#f0d060,#c8a84b);
                      border-radius:2px;margin-top:20px;"></div>
        </td>
      </tr>

      <!-- TÍTULO -->
      <tr>
        <td style="background:#f7f9fc;padding:24px 40px 16px;text-align:center;border-bottom:1px solid #e8ecf0;">
          <div style="font-size:20px;font-weight:700;color:#1a3a6b;">Invitación de Acceso</div>
          <div style="font-size:13px;color:#6b7a8d;margin-top:4px;">Dos códigos QR de un solo uso</div>
        </td>
      </tr>

      <!-- SALUDO -->
      <tr>
        <td style="padding:28px 40px 12px;">
          <p style="font-size:15px;color:#2d3a4a;margin:0 0 10px;">
            Estimado/a <strong style="color:#1a3a6b;">{nombre_invitado}</strong>,
          </p>
          <p style="font-size:14px;color:#4a5568;margin:0;line-height:1.7;">
            Tienes una invitación de acceso a las instalaciones de la
            <strong>Universidad Autónoma Gabriel René Moreno (UAGRM)</strong>.
            Se te asignan <strong>dos códigos QR</strong>: uno para ingresar y otro para salir.
            Muestra el código correspondiente al guardia en cada momento.
          </p>
        </td>
      </tr>

      <!-- DETALLES -->
      <tr>
        <td style="padding:12px 40px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f0f4fb;border-radius:12px;border:1px solid #d8e4f0;">
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #d8e4f0;">
                <span style="font-size:10px;font-weight:700;color:#8a9bb0;text-transform:uppercase;letter-spacing:1px;">Registrado por</span><br/>
                <span style="font-size:14px;color:#1a3a6b;font-weight:600;">{registrado_por}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #d8e4f0;">
                <span style="font-size:10px;font-weight:700;color:#8a9bb0;text-transform:uppercase;letter-spacing:1px;">Facultad destino</span><br/>
                <span style="font-size:14px;color:#1a3a6b;font-weight:600;">{facultad_destino}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #d8e4f0;">
                <span style="font-size:10px;font-weight:700;color:#8a9bb0;text-transform:uppercase;letter-spacing:1px;">Motivo de visita</span><br/>
                <span style="font-size:14px;color:#333;">{motivo_visita}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;">
                <span style="font-size:10px;font-weight:700;color:#8a9bb0;text-transform:uppercase;letter-spacing:1px;">Fecha de visita</span><br/>
                <span style="font-size:14px;color:#333;font-weight:600;">{fecha_visita}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- QR ENTRADA -->
      <tr>
        <td style="padding:8px 40px 4px;text-align:center;">
          <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:16px;
                      padding:20px;display:inline-block;max-width:280px;width:100%;">
            <div style="font-size:16px;font-weight:800;color:#15803d;letter-spacing:1px;
                        text-transform:uppercase;margin-bottom:12px;">
              🚪 QR para ENTRAR
            </div>
            <img src="cid:qr_entrada"
                 alt="QR Entrada UAGRM" width="200" height="200"
                 style="display:block;margin:0 auto;border-radius:8px;" />
            <p style="font-size:12px;color:#166534;margin:12px 0 0;font-weight:600;">
              Usa este QR al <strong>ingresar</strong> a la universidad
            </p>
            <p style="font-size:11px;color:#4ade80;margin:4px 0 0;">Un solo uso · Válido el {fecha_visita}</p>
          </div>
        </td>
      </tr>

      <!-- DIVISOR -->
      <tr>
        <td style="padding:16px 40px;text-align:center;">
          <div style="font-size:12px;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;">
            ─── y cuando termines tu visita ───
          </div>
        </td>
      </tr>

      <!-- QR SALIDA -->
      <tr>
        <td style="padding:4px 40px 24px;text-align:center;">
          <div style="background:#fff7ed;border:2px solid #ea580c;border-radius:16px;
                      padding:20px;display:inline-block;max-width:280px;width:100%;">
            <div style="font-size:16px;font-weight:800;color:#c2410c;letter-spacing:1px;
                        text-transform:uppercase;margin-bottom:12px;">
              🏃 QR para SALIR
            </div>
            <img src="cid:qr_salida"
                 alt="QR Salida UAGRM" width="200" height="200"
                 style="display:block;margin:0 auto;border-radius:8px;" />
            <p style="font-size:12px;color:#9a3412;margin:12px 0 0;font-weight:600;">
              Usa este QR al <strong>salir</strong> de la universidad
            </p>
            <p style="font-size:11px;color:#fb923c;margin:4px 0 0;">Un solo uso · Válido el {fecha_visita}</p>
          </div>
        </td>
      </tr>

      <!-- VENCIMIENTO -->
      <tr>
        <td style="padding:0 40px 20px;text-align:center;">
          <p style="font-size:12px;color:#8a9bb0;margin:0;">
            Ambos códigos vencen el: <strong style="color:#c0392b;">{expira_str}</strong>
          </p>
        </td>
      </tr>

      <!-- INSTRUCCIONES -->
      <tr>
        <td style="padding:0 40px 24px;">
          <div style="background:#fff8e1;border-left:4px solid #f0b429;border-radius:8px;padding:16px 18px;">
            <p style="font-size:13px;color:#7a5c00;margin:0;line-height:1.6;">
              <strong>Instrucciones:</strong><br/>
              1. Muestra el <strong>QR verde</strong> al guardia al <strong>ingresar</strong>.<br/>
              2. Muestra el <strong>QR naranja</strong> al guardia al <strong>salir</strong>.<br/>
              3. Cada código es de un solo uso. Guarda bien este email.
            </p>
          </div>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#0d2149;padding:24px 40px;text-align:center;">
          <p style="font-size:12px;color:rgba(255,255,255,.5);margin:0;line-height:1.7;">
            Email generado automáticamente por el<br/>
            <strong style="color:rgba(255,255,255,.75);">Sistema de Control Peatonal UAGRM</strong>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""

        texto_plano = (
            f"Invitación de acceso UAGRM\n"
            f"Invitado: {nombre_invitado}\n"
            f"Registrado por: {registrado_por}\n"
            f"Facultad: {facultad_destino}\n"
            f"Motivo: {motivo_visita}\n"
            f"Fecha: {fecha_visita}\n"
            f"Válido hasta: {expira_str}\n\n"
            f"Usa el QR VERDE para entrar y el QR NARANJA para salir.\n"
            f"Los QR también están adjuntos como imágenes en este email."
        )

        payload = {
            "sender": {
                "name": settings.BREVO_SENDER_NAME,
                "email": settings.BREVO_SENDER_EMAIL,
            },
            "to": [{"email": email_destino}],
            "subject": asunto,
            "htmlContent": html,
            "textContent": texto_plano,
            "attachment": [
                {
                    "content": qr_entrada_b64,
                    "name": "QR_Entrada_UAGRM.png",
                    "contentId": "qr_entrada",
                },
                {
                    "content": qr_salida_b64,
                    "name": "QR_Salida_UAGRM.png",
                    "contentId": "qr_salida",
                },
            ],
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
        else:
            print(f"[EMAIL ERROR] Brevo API respondió {response.status_code}: {response.text}")
            return False

    except Exception as e:
        import traceback
        print(f"[EMAIL ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        return False
