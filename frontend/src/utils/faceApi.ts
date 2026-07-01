import * as faceapi from '@vladmandic/face-api'

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

let modelsPromise: Promise<void> | null = null

export function ensureFaceModels(): Promise<void> {
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).then(() => undefined)
  }
  return modelsPromise
}

export async function computeFaceDescriptor(dataUrl: string): Promise<number[] | null> {
  await ensureFaceModels()
  const img = await faceapi.fetchImage(dataUrl)
  const detection = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor()
  if (!detection) return null
  return Array.from(detection.descriptor)
}

export function averageDescriptors(descriptors: number[][]): number[] {
  if (descriptors.length === 0) return []
  const len = descriptors[0].length
  const sum = new Array<number>(len).fill(0)
  for (const d of descriptors) {
    for (let i = 0; i < len; i++) sum[i] += d[i]
  }
  return sum.map(v => v / descriptors.length)
}
