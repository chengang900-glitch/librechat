import { Schema } from 'mongoose';
import type { IPortalGroup } from '~/types';

const portalGroupSchema: Schema<IPortalGroup> = new Schema<IPortalGroup>(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    nameKey: { type: String, required: true, trim: true },
    iconRef: { type: String, required: true, default: 'app' },
    sortOrder: { type: Number, required: true, default: 0, min: 0, max: 999999 },
    enabled: { type: Boolean, required: true, default: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

portalGroupSchema.index({ nameKey: 1 }, { unique: true });
portalGroupSchema.index({ enabled: 1, sortOrder: 1, nameKey: 1 });

export default portalGroupSchema;
