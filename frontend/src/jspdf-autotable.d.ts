declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf'

  interface UserOptions {
    startY?: number
    margin?: { top?: number; right?: number; bottom?: number; left?: number }
    head?: string[][]
    body?: (string | number)[][]
    theme?: 'striped' | 'grid' | 'plain'
    styles?: Record<string, unknown>
    headStyles?: Record<string, unknown>
    columnStyles?: Record<number, Record<string, unknown>>
  }

  export default function autoTable(doc: jsPDF, options: UserOptions): void
}
