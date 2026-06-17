import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fechaHoraGeneracionBo, formatearFechaBo } from './fechaBolivia'

export interface FilaPdfAcceso {
  fechaHora: string
  nombre: string
  tipo: string
  movimiento: string
  metodo: string
  sede: string
  facultad: string
  porton: string
  guardia: string
  resultado: string
}

export interface BloqueResumenPdf {
  titulo: string
  filas: [string, string | number][]
}

export interface OpcionesPdfAccesos {
  tituloDocumento: string
  tipoInforme: 'consulta' | 'informe'
  fechaInicio: string
  fechaFin: string
  filtrosAplicados: string[]
  resumen: { label: string; value: string | number }[]
  bloquesResumen?: BloqueResumenPdf[]
  filas: FilaPdfAcceso[]
  nombreArchivo: string
  notaPie?: string
}

const COLOR_PRIMARIO: [number, number, number] = [26, 58, 107]

function truncar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto
}

export function exportarAccesosPdf(opciones: OpcionesPdfAccesos): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 16

  doc.setFillColor(...COLOR_PRIMARIO)
  doc.rect(0, 0, pageWidth, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('UAGRM — Sistema de Control Peatonal', margin, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(opciones.tituloDocumento, margin, 16)

  doc.setTextColor(40, 40, 40)
  y = 30
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(
    opciones.tipoInforme === 'informe' ? 'Informe institucional de accesos' : 'Bitácora de accesos',
    margin,
    y,
  )
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Periodo: ${formatearFechaBo(opciones.fechaInicio)} — ${formatearFechaBo(opciones.fechaFin)}`,
    margin,
    y,
  )
  y += 5

  if (opciones.filtrosAplicados.length > 0) {
    doc.setTextColor(90, 90, 90)
    doc.text(`Filtros: ${opciones.filtrosAplicados.join(' · ')}`, margin, y)
    y += 6
  }

  doc.setTextColor(40, 40, 40)
  const resumenTexto = opciones.resumen
    .map(r => `${r.label}: ${r.value}`)
    .join('   |   ')
  doc.setFont('helvetica', 'bold')
  doc.text('Resumen', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const lineasResumen = doc.splitTextToSize(resumenTexto, pageWidth - margin * 2)
  doc.text(lineasResumen, margin, y)
  y += lineasResumen.length * 4 + 4

  if (opciones.bloquesResumen?.length) {
    for (const bloque of opciones.bloquesResumen) {
      if (y > 170) {
        doc.addPage()
        y = 20
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(bloque.titulo, margin, y)
      y += 2
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Concepto', 'Cantidad']],
        body: bloque.filas.map(([k, v]) => [k, String(v)]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: COLOR_PRIMARIO, textColor: 255 },
        columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'center', cellWidth: 30 } },
      })
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    }
  }

  if (y > 160) {
    doc.addPage()
    y = 20
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Detalle de registros', margin, y)
  y += 3

  const maxFilasPdf = 400
  const filasMostrar = opciones.filas.slice(0, maxFilasPdf)
  const hayMas = opciones.filas.length > maxFilasPdf

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [[
      'Fecha/Hora', 'Nombre', 'Tipo', 'Mov.', 'Método', 'Sede', 'Facultad', 'Portón', 'Resultado',
    ]],
    body: filasMostrar.map(f => [
      f.fechaHora,
      truncar(f.nombre, 28),
      truncar(f.tipo, 14),
      f.movimiento,
      f.metodo,
      truncar(f.sede, 18),
      truncar(f.facultad, 22),
      truncar(f.porton, 18),
      f.resultado,
    ]),
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: COLOR_PRIMARIO, textColor: 255, fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 38 },
      8: { cellWidth: 18 },
    },
  })

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(
      `Generado: ${fechaHoraGeneracionBo()}  ·  Página ${i} de ${totalPages}`,
      margin,
      pageHeight - 8,
    )
    if (hayMas && i === totalPages) {
      doc.text(
        `Nota: se muestran ${maxFilasPdf} de ${opciones.filas.length} registros.`,
        margin,
        pageHeight - 4,
      )
    } else if (opciones.notaPie) {
      doc.text(opciones.notaPie, margin, pageHeight - 4)
    }
  }

  doc.save(opciones.nombreArchivo)
}
