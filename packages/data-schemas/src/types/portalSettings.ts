import type { TPortalDataCenterEmbed } from 'librechat-data-provider';
import type { Document } from 'mongoose';

export interface IPortalSettings extends Document {
  key: 'default';
  brand: {
    portalLogoUrl?: string;
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
