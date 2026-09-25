import type { Model } from 'mongoose';
import type { IPortalApp } from '~/types';
import portalAppSchema from '~/schema/portal/app';

export function createPortalAppModel(mongoose: typeof import('mongoose')): Model<IPortalApp> {
  return mongoose.models.PortalApp || mongoose.model<IPortalApp>('PortalApp', portalAppSchema);
}
