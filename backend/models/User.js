const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  companyId: {
    type: String,
    default: 'company_madhura',
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please add a name'],
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false,
  },
  role: {
    type: String,
    enum: ['Super Admin', 'Admin', 'Manager', 'Field Executive', 'Project Manager', 'Team Lead', 'HR', 'Managing Director MD'],
    default: 'Field Executive',
  },
  phone: {
    type: String,
  },
  employeeId: {
    type: String,
    default: '',
  },
  designation: {
    type: String,
  },
  address: {
    type: String,
    default: '',
  },
  profilePicture: {
    type: String,
    default: '',
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isTenantSuspended: {
    type: Boolean,
    default: false
  },
  earlyCheckoutLocked: {
    type: Boolean,
    default: false,
  },
  earlyCheckoutCount: {
    type: Number,
    default: 0,
  },
  joiningDate: {
    type: Date,
    default: Date.now,
  },
  panNumber: {
    type: String,
    default: '',
  },
  aadharNumber: {
    type: String,
    default: '',
  },
  pfNumber: {
    type: String,
    default: '',
  },
  experienceLevel: {
    type: String,
    enum: ['Fresher', 'Experienced'],
    default: 'Fresher',
  },
  documents: [
    {
      name: String,
      url: String,
      type: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  isLiveLocationShared: {
    type: Boolean,
    default: true,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  // Tracks the currently active sessions (max 3 devices)
  activeSessionTokens: {
    type: [String],
    default: [],
    select: false,
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  canReopenTickets: {
    type: Boolean,
    default: false,
  },
  permissions: {
    type: [String],
    default: [],
  },
},
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
