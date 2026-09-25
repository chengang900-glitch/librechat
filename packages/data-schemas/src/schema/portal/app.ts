import { Schema } from 'mongoose';
import type { IPortalApp } from '~/types';

const portalAppSchema: Schema<IPortalApp> = new Schema<IPortalApp>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'PortalGroup', required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    nameKey: { type: String, required: true, trim: true },
    description: { type: String, default: '', maxlength: 200 },
    url: { type: String, required: true, maxlength: 2048 },
    iconType: { type: String, enum: ['preset', 'upload'], required: true },
    iconRef: { type: String, required: true, maxlength: 128 },
    sortOrder: { type: Number, required: true, default: 0, min: 0, max: 999999 },
    enabled: { type: Boolean, required: true, default: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

portalAppSchema.index({ groupId: 1, nameKey: 1 }, { unique: true });
portalAppSchema.index({ groupId: 1, enabled: 1, sortOrder: 1, nameKey: 1 });

export default portalAppSchema;
