import mongoose from 'mongoose';

const cmsSettingsSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      unique: true,
    },
    theme: {
      primaryColor: {
        type: String,
        default: '#3B82F6',
      },
      secondaryColor: {
        type: String,
        default: '#1F2937',
      },
      accentColor: {
        type: String,
        default: '#F59E0B',
      },
      backgroundColor: {
        type: String,
        default: '#FFFFFF',
      },
      textColor: {
        type: String,
        default: '#1F2937',
      },
      fontFamily: {
        type: String,
        default: 'Inter, system-ui, sans-serif',
      },
      headerStyle: {
        type: String,
        enum: ['minimal', 'classic', 'modern', 'bold'],
        default: 'modern',
      },
      layoutStyle: {
        type: String,
        enum: ['grid', 'list', 'cards', 'masonry'],
        default: 'grid',
      },
    },
    navigation: {
      enabled: {
        type: Boolean,
        default: true,
      },
      items: [
        {
          label: {
            type: String,
            required: true,
          },
          url: {
            type: String,
            required: true,
          },
          order: {
            type: Number,
            default: 0,
          },
          isExternal: {
            type: Boolean,
            default: false,
          },
        },
      ],
    },
    footer: {
      enabled: {
        type: Boolean,
        default: true,
      },
      content: {
        type: String,
        default: '',
      },
      socialLinks: [
        {
          platform: {
            type: String,
            enum: ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'github'],
          },
          url: String,
        },
      ],
    },
    seo: {
      siteName: String,
      defaultTitle: String,
      defaultDescription: String,
      defaultKeywords: [String],
      ogImage: String,
      favicon: String,
      googleAnalyticsId: String,
      googleTagManagerId: String,
    },
    customCss: {
      type: String,
      default: '',
    },
    customJs: {
      type: String,
      default: '',
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

const CmsSettings = mongoose.model('CmsSettings', cmsSettingsSchema);

export default CmsSettings;
