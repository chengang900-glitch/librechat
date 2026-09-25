import type { Model } from 'mongoose';
import type { IPortalGroup } from '~/types';
import portalGroupSchema from '~/schema/portal/group';

export function createPortalGroupModel(mongoose: typeof import('mongoose')): Model<IPortalGroup> {
  return (
    mongoose.models.PortalGroup || mongoose.model<IPortalGroup>('PortalGroup', portalGroupSchema)
  );
}
