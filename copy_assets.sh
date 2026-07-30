#!/bin/bash
set -e
SOURCE="NestFinance_Nest_Flow_Signature_Kit_Completo_v1"
DEST="public/brand/nestfinance/nest-flow-signature/v1"

# logos
cp "$SOURCE/01_Logos_SVG/nestfinance-logo-horizontal-transparent-dark-ui.svg" "$DEST/logos/"
cp "$SOURCE/01_Logos_SVG/nestfinance-logo-horizontal-transparent-light-ui.svg" "$DEST/logos/"
cp "$SOURCE/01_Logos_SVG/nestfinance-logo-horizontal-no-tagline-dark.svg" "$DEST/logos/"
cp "$SOURCE/01_Logos_SVG/nestfinance-logo-horizontal-no-tagline-light.svg" "$DEST/logos/"
cp "$SOURCE/01_Logos_SVG/nestfinance-logo-vertical-dark.svg" "$DEST/logos/"
cp "$SOURCE/01_Logos_SVG/nestfinance-logo-vertical-light.svg" "$DEST/logos/"
cp "$SOURCE/01_Logos_SVG/nestfinance-logo-monochrome-white.svg" "$DEST/logos/"
cp "$SOURCE/01_Logos_SVG/nestfinance-logo-monochrome-black.svg" "$DEST/logos/"

# symbols
cp "$SOURCE/01_Logos_SVG/nestfinance-symbol-vector-gradient.svg" "$DEST/symbols/"
# Fallback flat
if [ -f "$SOURCE/01_Logos_SVG/nestfinance-symbol-vector-flat.svg" ]; then
    cp "$SOURCE/01_Logos_SVG/nestfinance-symbol-vector-flat.svg" "$DEST/symbols/"
else 
    echo "Warning: nestfinance-symbol-vector-flat.svg not found, but it was requested. We will see."
fi
cp "$SOURCE/01_Logos_SVG/nestfinance-symbol-white.svg" "$DEST/symbols/"
cp "$SOURCE/01_Logos_SVG/nestfinance-symbol-black.svg" "$DEST/symbols/"
cp "$SOURCE/01_Logos_SVG/nestfinance-symbol-gold.svg" "$DEST/symbols/"
cp "$SOURCE/01_Logos_SVG/nestfinance-symbol-dark-app.svg" "$DEST/symbols/"
cp "$SOURCE/01_Logos_SVG/nestfinance-symbol-light-app.svg" "$DEST/symbols/"
cp "$SOURCE/02_Logos_PNG/nestfinance-symbol-gradient-transparent-2048.png" "$DEST/symbols/"

# icons
cp "$SOURCE/03_Icones_App_PWA/favicon.svg" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/favicon.ico" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/apple-touch-icon.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-app-icon-16.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-app-icon-32.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-app-icon-48.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-app-icon-64.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-app-icon-128.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-app-icon-180.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-app-icon-192.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-app-icon-256.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-app-icon-384.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-app-icon-512.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-app-icon-1024.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-maskable-192.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-maskable-512.png" "$DEST/icons/"
cp "$SOURCE/03_Icones_App_PWA/nestfinance-maskable-1024.png" "$DEST/icons/"

# social
cp "$SOURCE/04_Redes_Web/nestfinance-og-1200x630.jpg" "$DEST/social/"
cp "$SOURCE/04_Redes_Web/nestfinance-profile-1080.jpg" "$DEST/social/"
cp "$SOURCE/04_Redes_Web/nestfinance-story-1080x1920.jpg" "$DEST/social/"
cp "$SOURCE/04_Redes_Web/nestfinance-linkedin-1584x396.jpg" "$DEST/social/"
cp "$SOURCE/04_Redes_Web/nestfinance-x-cover-1500x500.jpg" "$DEST/social/"
cp "$SOURCE/04_Redes_Web/nestfinance-youtube-2560x1440.jpg" "$DEST/social/"

# manifest (copying site.webmanifest from 03)
cp "$SOURCE/03_Icones_App_PWA/site.webmanifest" "$DEST/manifest/"

# documentation
cp -r "$SOURCE/00_Referencia_Aprovada" "docs/brand/nestfinance/nest-flow-signature/v1/"
cp -r "$SOURCE/05_Manual_Marca" "docs/brand/nestfinance/nest-flow-signature/v1/"
cp -r "$SOURCE/06_Desenvolvimento" "docs/brand/nestfinance/nest-flow-signature/v1/"

echo "All copied!"
