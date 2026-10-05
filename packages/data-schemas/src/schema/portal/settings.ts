import { Schema } from 'mongoose';
import type { IPortalSettings } from '~/types/portalSettings';

const portalSettingsSchema: Schema<IPortalSettings> = new Schema<IPortalSettings>(
  {
    key: { type: String, enum: ['default'], unique: true, default: 'default' },
    brand: {
      companyLogoUrl: { type: String },
      portalLogoUrl: { type: String },
      // Keep the old field readable while existing singleton documents migrate.
      loginLogoUrl: { type: String },
    },
    dataCenter: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: '数据中心' },
      url: { type: String, required: true },
      embed: {
        search: { type: Boolean, default: false },
        newButton: { type: Boolean, default: false },
        appSwitcher: { type: Boolean, default: false },
      },
    },
    knowledgeCenter: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: '知识中心' },
      url: { type: String, required: true },
    },
    updatedBy: { type: String, required: true, default: 'system' },
  },
  { timestamps: true },
);

export default portalSettingsSchema;
