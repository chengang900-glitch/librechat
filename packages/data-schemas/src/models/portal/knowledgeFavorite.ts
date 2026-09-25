import type { Model } from 'mongoose';
import type { IPortalKnowledgeFavorite } from '~/types';
import portalKnowledgeFavoriteSchema from '~/schema/portal/knowledgeFavorite';

export function createPortalKnowledgeFavoriteModel(
  mongoose: typeof import('mongoose'),
): Model<IPortalKnowledgeFavorite> {
  return (
    mongoose.models.PortalKnowledgeFavorite ||
    mongoose.model<IPortalKnowledgeFavorite>(
      'PortalKnowledgeFavorite',
      portalKnowledgeFavoriteSchema,
    )
  );
}
