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
