import mongoose, { Schema } from "mongoose";

// Clear cached models in development to apply schema modifications during hot-reload
if (process.env.NODE_ENV === "development") {
  delete (mongoose.models as any).User;
  delete (mongoose.models as any).Chat;
  delete (mongoose.models as any).Message;
  delete (mongoose.models as any).Otp;
  delete (mongoose.models as any).Typing;
  delete (mongoose.models as any).Story;
}

// User Schema: User ID is their unique developer handle (e.g. "sanjai_dev")
const UserSchema = new Schema(
  {
    _id: { type: String, required: true }, // unique developer handle
    username: { type: String, required: true }, // display name
    password: { type: String, required: true }, // hashed password
    avatar: { type: String, default: "" }, // SVG avatar name or base64
    status: { type: String, default: "Coding..." }, // custom status
    mobileNumber: { type: String, default: "" }, // optional mobile number
  },
  { timestamps: true, _id: false }
);

// One-time password verification schema
const OtpSchema = new Schema(
  {
    mobileNumber: { type: String, required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Chat Schema: can be a private chat or a group chat
const ChatSchema = new Schema(
  {
    type: { type: String, enum: ["private", "group"], required: true },
    name: { type: String, default: "" }, // Group name, empty for private chat
    avatar: { type: String, default: "" }, // Group avatar SVG or base64
    members: [{ type: String, ref: "User" }], // Array of User IDs (handles)
  },
  { timestamps: true }
);

// Message Schema: stores text, code snippets, or base64-compressed images
const MessageSchema = new Schema(
  {
    chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
    senderId: { type: String, ref: "User", required: true },
    senderName: { type: String, required: true },
    text: { type: String, default: "" },
    code: { type: String, default: "" }, // Optional code snippet
    codeLanguage: { type: String, default: "" }, // Optional language (js, py, etc.)
    image: { type: String, default: "" }, // Optional base64 compressed image (storage saver)
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
export const Chat = mongoose.models.Chat || mongoose.model("Chat", ChatSchema);
export const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);
export const Otp = mongoose.models.Otp || mongoose.model("Otp", OtpSchema);

// Typing Status Schema: tracks active typing states
const TypingSchema = new Schema(
  {
    chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
    userId: { type: String, ref: "User", required: true },
    username: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-delete typing records after they expire (TTL index)
TypingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Typing = mongoose.models.Typing || mongoose.model("Typing", TypingSchema);

// Story Schema for temporary status sharing
const StorySchema = new Schema(
  {
    userId: { type: String, ref: "User", required: true },
    username: { type: String, required: true },
    userAvatar: { type: String, default: "" },
    image: { type: String }, // base64 compressed data (optional for text-only stories)
    bgGradient: { type: String, default: "" }, // gradient styles for text-only statuses
    caption: { type: String, default: "" },
    musicTrack: {
      title: { type: String },
      artist: { type: String },
      previewUrl: { type: String },
      artworkUrl: { type: String }
    },
    expiresAt: { type: Date, required: true } // TTL target
  },
  { timestamps: true }
);

// TTL index to automatically purge expired stories after 24 hours
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Story = mongoose.models.Story || mongoose.model("Story", StorySchema);
