import type { PortalIconType, PortalPresetIcon } from 'librechat-data-provider';
import type { Document, Types } from 'mongoose';

export interface IPortalGroup extends Document {
  _id: Types.ObjectId;
  name: string;
  nameKey: string;
  iconRef: PortalPresetIcon;
  sortOrder: number;
  enabled: boolean;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPortalApp extends Document {
  _id: Types.ObjectId;
  groupId: Types.ObjectId;
  name: string;
  nameKey: string;
  description: string;
  url: string;
  iconType: PortalIconType;
  iconRef: string;
  sortOrder: number;
  enabled: boolean;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPortalFavorite extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  appId: Types.ObjectId;
  createdAt: Date;
}
