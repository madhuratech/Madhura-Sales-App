const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

// Protect routes - Verify Token
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token signature & expiry
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');

      // Get user and the stored session tokens array
      req.user = await User.findById(decoded.id).select('-password +activeSessionTokens');

      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      if (req.user.isTenantSuspended) {
        return res.status(403).json({
          success: false,
          code: 'TENANT_SUSPENDED',
          message: 'Your company CRM subscription has been suspended by the SaaS administrator.',
        });
      }

      // Attach standardized RBAC role flags
      const ADMIN_ROLES = ['Super Admin', 'Admin', 'Managing Director MD', 'SUPER_ADMIN', 'COMPANY_ADMIN'];
      const MANAGER_ROLES = ['Manager', 'Project Manager', 'Team Lead', 'HR', 'SUPPORT_MANAGER'];
      req.user.isAdmin = ADMIN_ROLES.includes(req.user.role);
      req.user.isManager = MANAGER_ROLES.includes(req.user.role) || req.user.isAdmin;
      req.user.isRegularUser = !req.user.isAdmin && !req.user.isManager;
      req.user.isStaff = true;
      req.user.isClient = false;

      // Multi-session check disabled temporarily for debugging
      // const incomingHash = crypto.createHash('sha256').update(token).digest('hex');
      // if (req.user.activeSessionTokens && !req.user.activeSessionTokens.includes(incomingHash)) {
      //   return res.status(401).json({
      //     success: false,
      //     code: 'SESSION_TAKEN',
      //     message: 'This session is no longer active. You may have logged in on too many devices.',
      //   });
      // }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

// Role authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    let allowedRoles = [...roles];
    if (allowedRoles.includes('Admin')) {
      allowedRoles.push('Super Admin', 'Project Manager', 'Team Lead', 'HR', 'Managing Director MD');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role (${req.user.role}) is not authorized to access this resource`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
