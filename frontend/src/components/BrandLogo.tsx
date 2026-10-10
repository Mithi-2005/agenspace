import { brandConfig } from "../config/brand";
type BrandLogoProps = { showName?: boolean; size?: number };
export default function BrandLogo({ showName = true, size = 34 }: BrandLogoProps) {
  return <span className="brand-lockup">
    <img className="brand-image" src={brandConfig.logoUrl} alt="" width={size} height={size} aria-hidden="true" />
    {showName && <span className="brand-name">{brandConfig.appName}</span>}
  </span>;
}
