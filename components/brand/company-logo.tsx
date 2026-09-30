import Image from 'next/image';

export const companyName = 'PT. Arsko Sukses Bersama';

export function CompanyLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`relative block shrink-0 ${className}`}>
      <Image
        src="/brand/arsko-asb-transparent.png"
        alt={`Logo ASB — ${companyName}`}
        width={1254}
        height={1254}
        unoptimized
        className="h-full w-full object-contain"
      />
    </span>
  );
}
