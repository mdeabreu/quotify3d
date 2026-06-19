export const MODEL_UPLOAD_EXTENSIONS = ['.stl', '.3mf', '.obj', '.step', '.stp', '.amf', '.ply']

export const MODEL_UPLOAD_MIME_TYPES = [
  'model/stl',
  'model/3mf',
  'model/obj',
  'model/step',
  'model/vnd.usdz+zip',
  'application/octet-stream',
  'application/sla',
  'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  'application/step',
  'application/x-step',
]

export const MODEL_UPLOAD_ACCEPT = [...MODEL_UPLOAD_EXTENSIONS, ...MODEL_UPLOAD_MIME_TYPES].join(
  ',',
)

export const MODEL_UPLOAD_FORMAT_LABEL = MODEL_UPLOAD_EXTENSIONS.map((extension) =>
  extension.slice(1).toUpperCase(),
).join(', ')

export const isSupportedModelFilename = (filename: string): boolean => {
  const normalizedFilename = filename.trim().toLowerCase()

  return MODEL_UPLOAD_EXTENSIONS.some((extension) => normalizedFilename.endsWith(extension))
}

export const getUnsupportedModelFilenames = (files: Iterable<{ name: string }>): string[] =>
  Array.from(files)
    .map((file) => file.name)
    .filter((filename) => !isSupportedModelFilename(filename))

export const getUnsupportedModelFilesMessage = (filenames: string[]): string =>
  `Unsupported file format${filenames.length === 1 ? '' : 's'}: ${filenames.join(', ')}. Accepted formats: ${MODEL_UPLOAD_FORMAT_LABEL}.`
