export const MODEL_UPLOAD_EXTENSIONS = ['.stl', '.3mf', '.obj', '.step', '.stp', '.amf', '.ply']

export const MODEL_UPLOAD_MIME_TYPES = [
  'model/stl',
  'model/3mf',
  'model/obj',
  'model/step',
  'model/vnd.usdz+zip',
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
