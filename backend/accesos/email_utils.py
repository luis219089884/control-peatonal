"""
Utilidad para generar imagen QR y enviar email de invitación UAGRM.
Usa CID (Content-ID) para incrustar la imagen QR directamente en el email,
compatible con Gmail, Outlook y la mayoría de clientes de correo.
"""
import io
from datetime import datetime
from email.mime.image import MIMEImage

import qrcode
from django.conf import settings
from django.core.mail import EmailMultiAlternatives


def _generar_qr_bytes(token_hash: str, size: int = 12) -> bytes:
    """Genera imagen QR del token y la devuelve como bytes PNG."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=size,
        border=3,
    )
    qr.add_data(token_hash)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1a2e5e", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def _formatear_fecha(dt: datetime) -> str:
    meses = [
        "enero","febrero","marzo","abril","mayo","junio",
        "julio","agosto","septiembre","octubre","noviembre","diciembre"
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
    token_hash: str,
    expira_en: datetime,
) -> bool:
    """
    Genera QR y envía email de invitación oficial UAGRM.
    La imagen QR se adjunta como CID (inline) y también como archivo descargable.
    Devuelve True si el envío fue exitoso.
    """
    try:
        qr_bytes = _generar_qr_bytes(token_hash)
        expira_str = _formatear_fecha(expira_en)
        asunto = f"Invitación de acceso UAGRM – {fecha_visita}"

        # CID que referenciará la imagen en el HTML
        cid = "qr_uagrm_acceso"

        html = f"""
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitación UAGRM</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;
                    overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d2149 0%,#1a3a6b 60%,#1e4d8c 100%);
                     padding:36px 40px 28px;text-align:center;">
            <div style="font-size:11px;font-weight:700;letter-spacing:3px;
                        color:rgba(255,255,255,0.55);text-transform:uppercase;margin-bottom:6px;">
              Universidad Autónoma Gabriel René Moreno
            </div>
            <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:1px;margin-bottom:4px;">
              🎓 UAGRM
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,0.65);letter-spacing:2px;
                        text-transform:uppercase;margin-top:4px;">
              Sistema de Control Peatonal
            </div>
            <div style="height:3px;background:linear-gradient(90deg,#c8a84b,#f0d060,#c8a84b);
                        border-radius:2px;margin-top:20px;"></div>
          </td>
        </tr>

        <!-- TÍTULO -->
        <tr>
          <td style="background:#f7f9fc;padding:24px 40px 16px;text-align:center;
                     border-bottom:1px solid #e8ecf0;">
            <div style="font-size:20px;font-weight:700;color:#1a3a6b;">Invitación de Acceso</div>
            <div style="font-size:13px;color:#6b7a8d;margin-top:4px;">Código QR de un solo uso</div>
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
              Presenta el código QR al guardia de seguridad al momento de ingresar.
            </p>
          </td>
        </tr>

        <!-- DETALLES -->
        <tr>
          <td style="padding:12px 40px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f0f4fb;border-radius:12px;border:1px solid #d8e4f0;overflow:hidden;">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #d8e4f0;">
                  <span style="font-size:10px;font-weight:700;color:#8a9bb0;text-transform:uppercase;
                               letter-spacing:1px;">Registrado por</span><br/>
                  <span style="font-size:14px;color:#1a3a6b;font-weight:600;">{registrado_por}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #d8e4f0;">
                  <span style="font-size:10px;font-weight:700;color:#8a9bb0;text-transform:uppercase;
                               letter-spacing:1px;">Facultad destino</span><br/>
                  <span style="font-size:14px;color:#1a3a6b;font-weight:600;">{facultad_destino}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #d8e4f0;">
                  <span style="font-size:10px;font-weight:700;color:#8a9bb0;text-transform:uppercase;
                               letter-spacing:1px;">Motivo de visita</span><br/>
                  <span style="font-size:14px;color:#333;">{motivo_visita}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;">
                  <span style="font-size:10px;font-weight:700;color:#8a9bb0;text-transform:uppercase;
                               letter-spacing:1px;">Fecha de visita</span><br/>
                  <span style="font-size:14px;color:#333;font-weight:600;">{fecha_visita}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- QR IMAGE (CID inline) -->
        <tr>
          <td style="padding:8px 40px 8px;text-align:center;">
            <div style="display:inline-block;background:#ffffff;border-radius:16px;
                        border:2px solid #1a3a6b;padding:18px;
                        box-shadow:0 4px 20px rgba(26,58,107,0.15);">
              <img src="cid:{cid}"
                   alt="Código QR de acceso UAGRM"
                   width="220" height="220"
                   style="display:block;border-radius:8px;" />
            </div>
            <p style="font-size:12px;color:#8a9bb0;margin:14px 0 4px;">
              ⏰ Válido hasta: <strong style="color:#c0392b;">{expira_str}</strong>
            </p>
            <p style="font-size:11px;color:#aab4bf;margin:0 0 16px;">
              Este código es de <strong>un solo uso</strong> — no lo compartas con nadie más.
            </p>
          </td>
        </tr>

        <!-- DESCARGAR -->
        <tr>
          <td style="padding:0 40px 24px;text-align:center;">
            <p style="font-size:12px;color:#6b7a8d;margin:0 0 8px;">
              📎 El QR también está adjunto como imagen en este email para que puedas guardarlo fácilmente.
            </p>
          </td>
        </tr>

        <!-- INSTRUCCIONES -->
        <tr>
          <td style="padding:0 40px 24px;">
            <div style="background:#fff8e1;border-left:4px solid #f0b429;
                        border-radius:8px;padding:16px 18px;">
              <p style="font-size:13px;color:#7a5c00;margin:0;line-height:1.6;">
                <strong>📌 Instrucciones:</strong><br/>
                Muestra este QR al guardia de seguridad en la puerta de ingreso.
                El código se validará una sola vez. Si tienes problemas, contacta a quien te invitó.
              </p>
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#0d2149;padding:24px 40px;text-align:center;">
            <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0;line-height:1.7;">
              Este email fue generado automáticamente por el<br/>
              <strong style="color:rgba(255,255,255,0.75);">Sistema de Control Peatonal UAGRM</strong><br/>
              No responder a este correo.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""

        texto_plano = (
            f"Invitación de acceso UAGRM\n"
            f"Invitado: {nombre_invitado}\n"
            f"Registrado por: {registrado_por}\n"
            f"Facultad: {facultad_destino}\n"
            f"Motivo: {motivo_visita}\n"
            f"Fecha: {fecha_visita}\n"
            f"Válido hasta: {expira_str}\n"
        )

        # Construir mensaje multipart/related para CID
        msg = EmailMultiAlternatives(
            subject=asunto,
            body=texto_plano,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email_destino],
        )
        # Cambiar a mixed para poder adjuntar la imagen también como descarga
        msg.mixed_subtype = "related"
        msg.attach_alternative(html, "text/html")

        # Imagen inline (CID) — se muestra en el cuerpo del email
        img_inline = MIMEImage(qr_bytes, _subtype="png")
        img_inline.add_header("Content-ID", f"<{cid}>")
        img_inline.add_header("Content-Disposition", "inline", filename="QR_Acceso_UAGRM.png")
        msg.attach(img_inline)

        # Imagen adjunta — permite descargarla desde el email
        img_adjunta = MIMEImage(qr_bytes, _subtype="png")
        img_adjunta.add_header("Content-Disposition", "attachment", filename="QR_Acceso_UAGRM.png")
        msg.attach(img_adjunta)

        msg.send(fail_silently=False)
        return True

    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False
