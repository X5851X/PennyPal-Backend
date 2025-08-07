import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    trim: true
  },
  googleId: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  stocks: {
    type: [Object],
    default: []
  },
  files: {
    type: [Object],
    default: []
  },
  groups: {
    type: [String],
    default: []
  },
  friends: {
    type: [String],
    default: []
  },
  sentRequests: {
    type: [String],
    default: []
  },
  receivedRequests: {
    type: [String],
    default: []
  },
  inbox: {
    type: [String],
    default: []
  },
  image: {
    type: String,
    default: null
  },
  badges: {
    type: [String],
    default: []
  },
  token: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, {
  timestamps: true
});

export default mongoose.model("User", userSchema);
