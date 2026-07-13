import type Konva from 'konva';
import type { Region } from '../../types';
import { RegionRect } from './RegionRect';
import { RegionPoly } from './RegionPoly';

interface RegionLayerItemProps {
  region: Region;
  isSelected: boolean;
  isMultiSelected?: boolean;
  showLabelOverlay: boolean;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
}

export function RegionLayerItem(props: RegionLayerItemProps) {
  if (props.region.polygon && props.region.polygon.length >= 3) {
    return <RegionPoly {...props} />;
  }
  return <RegionRect {...props} />;
}
