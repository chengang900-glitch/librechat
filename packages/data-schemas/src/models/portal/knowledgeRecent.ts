import type { Model } from 'mongoose';
import type { IPortalKnowledgeRecent } from '~/types';
import portalKnowledgeRecentSchema from '~/schema/portal/knowledgeRecent';

export function createPortalKnowledgeRecentModel(
  mongoose: typeof import('mongoose'),
): Model<IPortalKnowledgeRecent> {
  return (
    mongoose.models.PortalKnowledgeRecent ||
    mongoose.model<IPortalKnowledgeRecent>('PortalKnowledgeRecent', portalKnowledgeRecentSchema)
  );
}
