import type { Model } from 'mongoose';
import type { IPortalFavorite } from '~/types';
import portalFavoriteSchema from '~/schema/portal/favorite';

export function createPortalFavoriteModel(
  mongoose: typeof import('mongoose'),
): Model<IPortalFavorite> {
  return (
    mongoose.models.PortalFavorite ||
    mongoose.model<IPortalFavorite>('PortalFavorite', portalFavoriteSchema)
  );
}
