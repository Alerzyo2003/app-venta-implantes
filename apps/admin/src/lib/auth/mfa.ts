/**
 * Supabase entrega el QR del factor TOTP como SVG (a veces ya con prefijo «data:»). Se vuelve a
 * codificar para que caracteres como «#» no corten la URL de la imagen.
 */
export function qrImageSrc(qrCode: string): string {
  if (/^data:image\/svg\+xml;base64,/i.test(qrCode)) return qrCode;
  const svg = qrCode.replace(/^data:image\/svg\+xml(;[^,]*)?,/i, '');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Código TOTP de 6 dígitos (se aceptan espacios al copiarlo). */
export function normalizeTotpCode(value: string): string | null {
  const code = value.replace(/\s+/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}
