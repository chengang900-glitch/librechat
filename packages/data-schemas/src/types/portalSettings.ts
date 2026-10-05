import type { TPortalDataCenterEmbed } from 'librechat-data-provider';
import type { Document } from 'mongoose';

export interface IPortalSettings extends Document {
  key: 'default';
  brand: {
    companyLogoUrl?: string;
    portalLogoUrl?: string;
    /** Legacy field retained so existing settings can migrate safely. */
    loginLogoUrl?: string;
  };
  dataCenter: {
    enabled: boolean;
    label: string;
    url: string;
    embed?: TPortalDataCenterEmbed;
  };
  knowledgeCenter: {
    enabled: boolean;
    label: string;
    url: string;
  };
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
