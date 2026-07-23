/** Parses ExifTool's default DMS string (e.g. `40 deg 26' 46.00" N`) into signed decimal degrees. */
export function dmsToDecimal(dms: string): number | null {
  const m = /(-?\d+(?:\.\d+)?)\s*deg\s*(\d+(?:\.\d+)?)?'?\s*(\d+(?:\.\d+)?)?"?\s*([NSEW])?/i.exec(dms);
  if (!m) return null;
  const deg = Number.parseFloat(m[1]);
  const min = Number.parseFloat(m[2] ?? "0");
  const sec = Number.parseFloat(m[3] ?? "0");
  let value = Math.abs(deg) + min / 60 + sec / 3600;
  const hemi = m[4]?.toUpperCase();
  if (hemi === "S" || hemi === "W") value = -value;
  else if (deg < 0 && !hemi) value = -value;
  return Number.isFinite(value) ? value : null;
}
