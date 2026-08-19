import Image from 'next/image';

interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 34, className }: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="GolfForGood Logo"
      width={size}
      height={size}
      priority
      className={className}
      style={{
        borderRadius: `${Math.round(size * 0.25)}px`,
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  );
}
