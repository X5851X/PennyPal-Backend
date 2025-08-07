import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import sendEmail from '../utils/sendEmails.js';
import passport from '../passport/index.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Register (signup)
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = new User({
      username,
      email,
      password: hashed,
      isVerified: false
    });

    await user.save();

    const token = signToken({ id: user._id });

    const backendUrl = process.env.BACKEND || 'http://localhost:3000';
    const verificationUrl = `${backendUrl}/auth/verify/${token}`;

    console.log('🔗 Verification URL:', verificationUrl);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Welcome to PennyPal! 🎉</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Thank you for registering! Please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            ✅ Verify Email Address
          </a>
        </div>    
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          If you didn't create this account, please ignore this email.
        </p>
      </div>
    `;

    try {
      console.log('📧 Attempting to send verification email to:', email);
      await sendEmail(email, 'Verify your PennyPal account', html);
      console.log('✅ Verification email sent successfully!');
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError.message);
      // Tetap return success karena user sudah terdaftar, hanya email yang gagal
      return res.status(201).json({
        success: true,
        message: 'User registered successfully, but verification email failed to send. Please contact support.',
        token,
        emailError: true
      });
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      token
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({ success: false, message: 'Signup failed: ' + error.message });
  }
});

// Email Verification
router.get('/verify/:token', async (req, res) => {
  try {
    console.log('🔍 Verifying token:', req.params.token);
    const decoded = verifyToken(req.params.token);
    console.log('✅ Token decoded successfully:', decoded);

    const user = await User.findByIdAndUpdate(decoded.id, { isVerified: true }, { new: true });

    if (!user) {
      console.log('❌ User not found for ID:', decoded.id);
      return res.redirect(`${process.env.FRONTEND || 'http://localhost:5173'}/?verified=false&error=user_not_found`);
    }

    console.log('✅ User verified successfully:', user.email);
    res.redirect(`${process.env.FRONTEND || 'http://localhost:5173'}/?verified=true`);
  } catch (error) {
    console.error('❌ [VERIFY] Error:', error.message);
    res.redirect(`${process.env.FRONTEND || 'http://localhost:5173'}/?verified=false&error=invalid_token`);
  }
});

// Login (signin)
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Please verify your email before logging in',
        needsVerification: true 
      });
    }

    const token = signToken({ id: user._id });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isVerified: user.isVerified,
        role: user.role,
        image: user.image,
        createdAt: user.createdAt,
        friends: user.friends,
        groups: user.groups,
        badges: user.badges
      }
    });
  } catch (error) {
    console.error('❌ Signin error:', error);
    res.status(500).json({ success: false, message: 'Signin failed: ' + error.message });
  }
});

// Logout (signout)
router.post('/signout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user info
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user data' });
  }
});

// UPDATE PROFILE - NEW ENDPOINT
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { username, email, image } = req.body;
    
    console.log('📝 Profile update request:', { username, email, hasImage: !!image });
    
    // Validation
    if (!username || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and email are required' 
      });
    }

    // Check if email is already taken by another user
    if (email !== req.user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email is already taken by another user' 
        });
      }
    }

    // Check if username is already taken by another user
    if (username !== req.user.username) {
      const existingUsername = await User.findOne({ username, _id: { $ne: req.user._id } });
      if (existingUsername) {
        return res.status(400).json({ 
          success: false, 
          message: 'Username is already taken' 
        });
      }
    }

    // Update user data
    const updateData = { username, email };
    if (image) {
      updateData.image = image;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    console.log('✅ Profile updated successfully for user:', updatedUser.email);

    // Return updated user data (excluding sensitive info)
    const userResponse = {
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      isVerified: updatedUser.isVerified,
      role: updatedUser.role,
      image: updatedUser.image,
      createdAt: updatedUser.createdAt,
      friends: updatedUser.friends,
      groups: updatedUser.groups,
      badges: updatedUser.badges
    };

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('❌ Profile update error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: `Validation error: ${messages.join(', ')}` 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Profile update failed: ' + error.message 
    });
  }
});

// CHANGE PASSWORD - NEW ENDPOINT
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    console.log('🔒 Password change request for user:', req.user.email);
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password and new password are required' 
      });
    }

    // Verify current password
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // For Google OAuth users who don't have a password
    if (!user.password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot change password for Google OAuth accounts' 
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await User.findByIdAndUpdate(req.user._id, { password: hashedNewPassword });
    
    console.log('✅ Password changed successfully for user:', req.user.email);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Password change failed: ' + error.message 
    });
  }
});

// DELETE ACCOUNT - NEW ENDPOINT
router.delete('/account', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    
    console.log('🗑️ Account deletion request for user:', req.user.email);
    
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required to delete account' 
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // For Google OAuth users who don't have a password, skip password verification
    if (user.password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ 
          success: false, 
          message: 'Incorrect password' 
        });
      }
    }

    // Delete the user
    await User.findByIdAndDelete(req.user._id);
    
    console.log('✅ Account deleted successfully for user:', req.user.email);
    
    // Clear cookies
    res.clearCookie('token');
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('❌ Account deletion error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Account deletion failed: ' + error.message 
    });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    const token = signToken({ id: user._id });
    const backendUrl = process.env.BACKEND || 'http://localhost:3000';
    const verificationUrl = `${backendUrl}/auth/verify/${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Verify Your PennyPal Account 🎉</h2>
        <p>Hi <strong>${user.username}</strong>,</p>
        <p>Please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            ✅ Verify Email Address
          </a>
        </div>
        
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
          ${verificationUrl}
        </p>
      </div>
    `;

    await sendEmail(email, 'Verify your PennyPal account', html);

    res.json({ success: true, message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend verification email' });
  }
});

// Google OAuth (initiate) - WITH DEBUGGING
router.get('/google', (req, res, next) => {
  console.log('🔍 OAUTH DEBUG INFO:');
  console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
  console.log('- GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL);
  console.log('- Request URL:', req.url);
  console.log('- Base URL:', req.baseUrl);
  console.log('- Full URL that will be used:', `${req.protocol}://${req.get('host')}${req.baseUrl}${req.url}`);
  
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth (callback)
router.get('/google/callback', (req, res, next) => {
  console.log('🔍 CALLBACK DEBUG INFO:');
  console.log('- Callback URL accessed:', `${req.protocol}://${req.get('host')}${req.originalUrl}`);
  console.log('- Query params:', req.query);
  next();
}, passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND || 'http://localhost:5173'}/login?error=google_auth_failed`
  }),
  (req, res) => {
    try {
      if (!req.user || !req.user.token) {
        console.error('❌ No user or token in callback');
        return res.redirect(`${process.env.FRONTEND || 'http://localhost:5173'}/login?error=no_token`);
      }

      const token = req.user.token;
      
      // Set the authentication cookie (same as regular login)
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      console.log('✅ Google OAuth successful, redirecting with token');
      res.redirect(`${process.env.FRONTEND || 'http://localhost:5173'}/oauth-redirect?token=${token}`);
    } catch (error) {
      console.error('❌ [Google Callback] Error:', error);
      res.redirect(`${process.env.FRONTEND || 'http://localhost:5173'}/login?error=callback_error`);
    }
  }
);

export default router;