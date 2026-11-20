import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** "Text her twin" card with a QR code that opens an SMS to the twin's number. */
export function TextTwinQr({ number }: { number: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const href = `sms:${number.replace(/[^\d+]/g, "")}`;
  useEffect(() => { QRCode.toDataURL(href, { margin: 1, width: 240 }).then(setSrc).catch(() => setSrc(null)); }, [href]);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3">
      {src && <img src={src} alt={`QR code to text ${number}`} width={88} height={88} className="h-22 w-22 rounded-lg" />}
      <p className="text-sm">Text her twin: <a href={href} className="block font-semibold underline">{number}</a></p>
    </div>
  );
}
