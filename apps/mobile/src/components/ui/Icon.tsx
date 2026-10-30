import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useAppTheme } from '@/theme/theme';

type SymbolName = Exclude<ComponentProps<typeof SymbolView>['name'], string>;

/**
 * Íconos nativos de cada plataforma: SF Symbols en iOS y Material Symbols en Android/web.
 * Los nombres se validan con TypeScript.
 */
const ICONS = {
  home: { ios: 'house', android: 'home', web: 'home' },
  categories: { ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' },
  heart: { ios: 'heart', android: 'favorite_border', web: 'favorite_border' },
  heartFill: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  orders: { ios: 'doc.text', android: 'receipt_long', web: 'receipt_long' },
  account: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  cart: { ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  scan: { ios: 'barcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  minus: { ios: 'minus', android: 'remove', web: 'remove' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  checkCircle: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  error: { ios: 'xmark.octagon', android: 'error', web: 'error' },
  shipping: { ios: 'shippingbox', android: 'local_shipping', web: 'local_shipping' },
  store: { ios: 'building.2', android: 'storefront', web: 'storefront' },
  chat: { ios: 'bubble.left.and.bubble.right', android: 'chat', web: 'chat' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  verified: { ios: 'checkmark.seal', android: 'verified', web: 'verified' },
  location: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  document: { ios: 'doc', android: 'description', web: 'description' },
  filters: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
  sort: { ios: 'arrow.up.arrow.down', android: 'sort', web: 'sort' },
  offline: { ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' },
  link: { ios: 'link', android: 'link', web: 'link' },
  help: { ios: 'questionmark.circle', android: 'help', web: 'help' },
  history: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  external: { ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' },
  shield: { ios: 'lock.shield', android: 'shield', web: 'shield' },
  mail: { ios: 'envelope', android: 'mail', web: 'mail' },
  receipt: { ios: 'list.bullet.rectangle', android: 'receipt', web: 'receipt' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  image: { ios: 'photo', android: 'image', web: 'image' },
  package: { ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' },
  // Categorías del catálogo (ver features/catalog/category-icons.ts).
  implant: { ios: 'cylinder.split.1x2', android: 'dentistry', web: 'dentistry' },
  layers: { ios: 'square.stack.3d.up', android: 'layers', web: 'layers' },
  pillar: { ios: 'cylinder', android: 'view_agenda', web: 'view_agenda' },
  transfer: { ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' },
  screw: { ios: 'wrench.and.screwdriver', android: 'build', web: 'build' },
  cube: { ios: 'cube', android: 'deployed_code', web: 'deployed_code' },
  drop: { ios: 'drop', android: 'water_drop', web: 'water_drop' },
  scissors: { ios: 'scissors', android: 'content_cut', web: 'content_cut' },
  medicalKit: { ios: 'cross.case', android: 'medical_services', web: 'medical_services' },
  smile: { ios: 'face.smiling', android: 'sentiment_satisfied', web: 'sentiment_satisfied' },
  bag: { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  tag: { ios: 'tag', android: 'sell', web: 'sell' },
} as const satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  accessibilityLabel?: string;
}

export function Icon({ name, size = 22, color, accessibilityLabel }: IconProps) {
  const { colors } = useAppTheme();
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color ?? colors.text}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
