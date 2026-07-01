const MAX_BYTES = 2 * 1024 * 1024
const TIPOS_VALIDOS = ['image/jpeg', 'image/jpg', 'image/png']

export function validarArchivoImagen(file: File): string | null {
  if (!TIPOS_VALIDOS.includes(file.type)) {
    return 'Solo se permiten imágenes JPG o PNG.'
  }
  if (file.size > MAX_BYTES) {
    return 'La imagen no puede superar 2 MB.'
  }
  return null
}

export function leerImagenComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(file)
  })
}
