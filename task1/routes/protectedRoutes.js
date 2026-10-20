const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(authenticateToken);

/**
 * @route   GET /api/protected/dashboard
 * @desc    Get dashboard metrics, security audit, and activity logs
 * @access  Protected
 */
router.get('/dashboard', (req, res) => {
  const activities = db.getUserActivities(req.user.id, 5);
  
  return res.json({
    success: true,
    data: {
      user: req.user,
      metrics: {
        securityScore: '98%',
        authMethod: 'Bcrypt + JWT (256-bit)',
        sessionStatus: 'Active & Verified',
        mfaStatus: 'Hardware-Ready'
      },
      activityLogs: activities,
      systemNotice: {
        title: 'Protected Access Confirmed',
        message: 'You have accessed the secure perimeter. Cryptographic signatures verified.',
        verifiedAt: new Date().toISOString()
      }
    }
  });
});

/**
 * @route   GET /api/protected/vault
 * @desc    Retrieve sensitive enterprise vault data (demonstrating protected route isolation)
 * @access  Protected
 */
router.get('/vault', (req, res) => {
  return res.json({
    success: true,
    vault: {
      clearanceLevel: 'Level 3 - Confidential',
      secrets: [
        {
          id: 'sec-01',
          name: 'Quantum Core API Endpoint',
          key: 'qc_live_99f8d10b77e24a5198bc',
          environment: 'Production',
          lastRotated: '2026-08-15'
        },
        {
          id: 'sec-02',
          name: 'Database Cluster Certificate',
          key: 'SHA256:7e2b19cf62901a884f0e9',
          environment: 'Staging',
          lastRotated: '2026-09-01'
        },
        {
          id: 'sec-03',
          name: 'Webhook HMAC Signing Secret',
          key: 'whsec_77a90f1bc430e87d6',
          environment: 'Global Webhook',
          lastRotated: '2026-09-03'
        }
      ],
      userPermissions: [
        'READ_PROTECTED_DATA',
        'EXPORT_METRICS',
        'UPDATE_SECURITY_PREFERENCES'
      ]
    }
  });
});

/**
 * @route   PUT /api/protected/profile
 * @desc    Update user profile name
 * @access  Protected
 */
router.put('/profile', (req, res) => {
  const { name } = req.body;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Name must be at least 2 characters long.'
    });
  }

  const updatedUser = db.updateUser(req.user.id, { name: name.trim() });
  db.logActivity(req.user.id, 'PROFILE_UPDATED', `User changed name to: ${name.trim()}`);

  return res.json({
    success: true,
    message: 'Profile updated successfully!',
    user: updatedUser
  });
});

/**
 * @route   PUT /api/protected/change-password
 * @desc    Secure password change
 * @access  Protected
 */
router.put('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both current and new passwords.'
      });
    }

    const fullUser = db.findUserById(req.user.id);
    if (!fullUser) {
      return res.status(404).json({
        success: false,
        error: 'User account not found.'
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, fullUser.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect.'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long.'
      });
    }

    const newHash = await bcrypt.hash(newPassword, config.SALT_ROUNDS);
    db.updateUser(req.user.id, { passwordHash: newHash });
    db.logActivity(req.user.id, 'PASSWORD_CHANGED', 'User successfully changed account password');

    return res.json({
      success: true,
      message: 'Password updated successfully!'
    });
  } catch (err) {
    console.error('Password change error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update password.'
    });
  }
});

module.exports = router;
