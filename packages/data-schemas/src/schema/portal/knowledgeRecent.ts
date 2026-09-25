import { Schema } from 'mongoose';
import type { IPortalKnowledgeRecent } from '~/types';

const portalKnowledgeRecentSchema: Schema<IPortalKnowledgeRecent> =
  new Schema<IPortalKnowledgeRecent>(
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      targetType: { type: String, enum: ['knowledge_base', 'document'], required: true },
      targetId: { type: String, required: true, trim: true, maxlength: 200 },
      knowledgeBaseId: { type: String, required: true, trim: true, maxlength: 200 },
      titleSnapshot: { type: String, default: '', maxlength: 512 },
      lastUsedAt: { type: Date, required: true, default: Date.now },
    },
    { timestamps: true },
  );

portalKnowledgeRecentSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
portalKnowledgeRecentSchema.index({ userId: 1, knowledgeBaseId: 1, lastUsedAt: -1 });

export default portalKnowledgeRecentSchema;
