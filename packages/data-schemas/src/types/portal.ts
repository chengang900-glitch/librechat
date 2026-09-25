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

export type PortalKnowledgeTargetType = 'knowledge_base' | 'document';

export interface IPortalKnowledgeFavorite extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  targetType: PortalKnowledgeTargetType;
  targetId: string;
  knowledgeBaseId: string;
  titleSnapshot: string;
  createdAt: Date;
}

export interface IPortalKnowledgeRecent extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  targetType: PortalKnowledgeTargetType;
  targetId: string;
  knowledgeBaseId: string;
  titleSnapshot: string;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPortalKnowledgeSession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  portalSessionId: string;
  providerSessionId: string;
  knowledgeBaseId: string;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
