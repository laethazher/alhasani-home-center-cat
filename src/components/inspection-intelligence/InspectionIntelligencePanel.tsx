import React from 'react';
import InspectionIntelligenceDrawer, {
  type InspectionIntelligenceDrawerProps,
} from './InspectionIntelligenceDrawer';

export type InspectionIntelligencePanelProps = Omit<
  InspectionIntelligenceDrawerProps,
  'open' | 'onClose' | 'variant'
>;

/**
 * غلاف مخصص لعرض مركز الذكاء كصفحة كاملة (بدون overlay/animation الدرج).
 * يُعيد استخدام InspectionIntelligenceDrawer في وضع variant='page' لتفادي
 * تكرار المنطق (نفس الحالة، الطلبات، والتبويبات).
 */
export default function InspectionIntelligencePanel(props: InspectionIntelligencePanelProps) {
  return (
    <InspectionIntelligenceDrawer
      {...props}
      open
      onClose={() => {}}
      variant="page"
    />
  );
}
