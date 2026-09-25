import type { Model } from 'mongoose';
import type { IPortalKnowledgeSession } from '~/types';
import portalKnowledgeSessionSchema from '~/schema/portal/knowledgeSession';

export function createPortalKnowledgeSessionModel(
  mongoose: typeof import('mongoose'),
): Model<IPortalKnowledgeSession> {
  return (
    mongoose.models.PortalKnowledgeSession ||
    mongoose.model<IPortalKnowledgeSession>('PortalKnowledgeSession', portalKnowledgeSessionSchema)
  );
}
