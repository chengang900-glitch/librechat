import { Model } from 'mongoose';
import type { IPortalSettings } from '~/types/portalSettings';
import portalSettingsSchema from '~/schema/portal/settings';

export function createPortalSettingsModel(
  mongoose: typeof import('mongoose'),
): Model<IPortalSettings> {
  return (
    mongoose.models.PortalSettings ||
    mongoose.model<IPortalSettings>('PortalSettings', portalSettingsSchema)
  );
}
