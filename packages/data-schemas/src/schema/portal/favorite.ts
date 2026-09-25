import { Schema } from 'mongoose';
import type { IPortalFavorite } from '~/types';

const portalFavoriteSchema: Schema<IPortalFavorite> = new Schema<IPortalFavorite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    appId: { type: Schema.Types.ObjectId, ref: 'PortalApp', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

portalFavoriteSchema.index({ userId: 1, appId: 1 }, { unique: true });
portalFavoriteSchema.index({ appId: 1 });

export default portalFavoriteSchema;
