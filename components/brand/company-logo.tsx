import Image from 'next/image';

export const companyName = 'PT. Arsko Sukses Bersama';

export function CompanyLogo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-sm bg-white ${className}`}
    >
      {/* Frame the logo within the supplied image's transparent margins.
          Keep the original uploaded artwork unchanged. */}
      <Image
        src="/brand/arsko-asb.png"
        alt={`Logo ASB — ${companyName}`}
        width={428}
        height={206}
        unoptimized
        className="absolute top-0 h-auto max-w-none"
        style={{
          width: `${(428 / 159) * 100}%`,
          left: `${(-117 / 159) * 100}%`,
        }}
      />
    </span>
  );
}
