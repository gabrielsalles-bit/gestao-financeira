import {
  Utensils, Car, Fuel, Sparkles, GraduationCap, Shirt, Gift, Plane,
  ShoppingBag, HelpCircle, Tag, LucideIcon,
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  Car,
  Fuel,
  Sparkles,
  GraduationCap,
  Shirt,
  Gift,
  Plane,
  ShoppingBag,
  HelpCircle,
  Tag,
};

export function resolveCategoryIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Tag;
}
