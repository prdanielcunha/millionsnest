import React from 'react';
import { Music, Calendar, Users, QrCode, Wallet, LayoutGrid } from 'lucide-react';
import { EcosystemApp } from '../../lib/apps.js';

interface EcosystemAppIconProps {
  app: EcosystemApp;
  iconClassName?: string;
  assetClassName?: string;
}

export function EcosystemAppIcon({ app, iconClassName = '', assetClassName = '' }: EcosystemAppIconProps) {
  if (app.iconAsset) {
    return (
      <img
        src={app.iconAsset}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`object-contain aspect-square ${assetClassName}`}
      />
    );
  }

  const IconComponent =
    app.icon === 'Music' ? Music :
    app.icon === 'Calendar' ? Calendar :
    app.icon === 'Users' ? Users :
    app.icon === 'QrCode' ? QrCode :
    app.icon === 'Wallet' ? Wallet :
    LayoutGrid;

  return <IconComponent className={iconClassName} />;
}
