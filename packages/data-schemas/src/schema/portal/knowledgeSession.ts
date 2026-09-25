import { Schema } from 'mongoose';
import type { IPortalKnowledgeSession } from '~/types';

const portalKnowledgeSessionSchema: Schema<IPortalKnowledgeSession> =
  new Schema<IPortalKnowledgeSession>(
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      portalSessionId: { type: String, required: true, trim: true, maxlength: 200 },
      providerSessionId: { type: String, required: true, trim: true, maxlength: 200 },
      knowledgeBaseId: { type: String, required: true, trim: true, maxlength: 200 },
      lastUsedAt: { type: Date, required: true, default: Date.now },
    },
    { timestamps: true },
  );

portalKnowledgeSessionSchema.index({ portalSessionId: 1 }, { unique: true });
portalKnowledgeSessionSchema.index({ userId: 1, knowledgeBaseId: 1, lastUsedAt: -1 });

export default portalKnowledgeSessionSchema;
