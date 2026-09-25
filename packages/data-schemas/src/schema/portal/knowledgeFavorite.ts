import { Schema } from 'mongoose';
import type { IPortalKnowledgeFavorite } from '~/types';

const portalKnowledgeFavoriteSchema: Schema<IPortalKnowledgeFavorite> =
  new Schema<IPortalKnowledgeFavorite>(
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      targetType: { type: String, enum: ['knowledge_base', 'document'], required: true },
      targetId: { type: String, required: true, trim: true, maxlength: 200 },
      knowledgeBaseId: { type: String, required: true, trim: true, maxlength: 200 },
      titleSnapshot: { type: String, default: '', maxlength: 512 },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  );

portalKnowledgeFavoriteSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
portalKnowledgeFavoriteSchema.index({ userId: 1, knowledgeBaseId: 1, createdAt: -1 });

export default portalKnowledgeFavoriteSchema;
