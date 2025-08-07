import express from "express";
import Saving from '../models/savings.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// POST: Add new saving goal
router.post("/addSaving", async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      targetAmt,
      currAmt = 0,
      currency = 'IDR',
      title,
      description,
      targetDate,
      category = 'other'
    } = req.body;

    // Validation
    if (!targetAmt || !title) {
      return res.status(400).json({
        success: false,
        message: 'Target amount and title are required'
      });
    }

    if (targetAmt <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Target amount must be positive'
      });
    }

    if (currAmt < 0) {
      return res.status(400).json({
        success: false,
        message: 'Current amount cannot be negative'
      });
    }

    // Validate target date if provided
    let targetDateObj = null;
    if (targetDate) {
      targetDateObj = new Date(targetDate);
      if (isNaN(targetDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid target date format'
        });
      }
      
      // Check if target date is in the future
      if (targetDateObj <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Target date must be in the future'
        });
      }
    }

    const saving = new Saving({
      userId,
      targetAmt,
      currAmt,
      currency,
      title: title.trim(),
      description: description?.trim(),
      targetDate: targetDateObj,
      category
    });

    const savedSaving = await saving.save();

    res.status(201).json({
      success: true,
      message: 'Saving goal created successfully',
      data: savedSaving
    });

  } catch (error) {
    console.error('❌ Error adding saving:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add saving goal',
      error: error.message
    });
  }
});

// PUT: Edit existing saving goal
router.put("/editSaving/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const savingId = req.params.id;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.userId;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Validate amounts if provided
    if (updates.targetAmt !== undefined && updates.targetAmt <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Target amount must be positive'
      });
    }

    if (updates.currAmt !== undefined && updates.currAmt < 0) {
      return res.status(400).json({
        success: false,
        message: 'Current amount cannot be negative'
      });
    }

    // Validate target date if provided
    if (updates.targetDate) {
      const targetDateObj = new Date(updates.targetDate);
      if (isNaN(targetDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid target date format'
        });
      }
      updates.targetDate = targetDateObj;
    }

    // Trim string fields
    if (updates.title) updates.title = updates.title.trim();
    if (updates.description) updates.description = updates.description.trim();

    const saving = await Saving.findOneAndUpdate(
      { _id: savingId, userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!saving) {
      return res.status(404).json({
        success: false,
        message: 'Saving goal not found'
      });
    }

    res.json({
      success: true,
      message: 'Saving goal updated successfully',
      data: saving
    });

  } catch (error) {
    console.error('❌ Error editing saving:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to edit saving goal',
      error: error.message
    });
  }
});

// DELETE: Delete saving goal
router.delete("/deleteSaving/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const savingId = req.params.id;

    const saving = await Saving.findOneAndDelete({ _id: savingId, userId });

    if (!saving) {
      return res.status(404).json({
        success: false,
        message: 'Saving goal not found'
      });
    }

    res.json({
      success: true,
      message: 'Saving goal deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting saving:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete saving goal',
      error: error.message
    });
  }
});

// GET: Get all savings for user with filtering
router.get("/getSavings/:userId", async (req, res) => {
  try {
    const requestUserId = req.params.userId;
    const authUserId = req.user.id;

    // Ensure user can only access their own savings
    if (requestUserId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view your own savings'
      });
    }

    const {
      status,
      category,
      currency,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { userId: requestUserId };
    
    if (status) query.status = status;
    if (category) query.category = category;
    if (currency) query.currency = currency;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const savings = await Saving.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Saving.countDocuments(query);

    // Get summary statistics
    const totalSavings = await Saving.getTotalSavings(requestUserId);

    res.json({
      success: true,
      data: {
        savings,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: savings.length,
          totalRecords: total
        },
        summary: totalSavings
      }
    });

  } catch (error) {
    console.error('❌ Error fetching savings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch savings',
      error: error.message
    });
  }
});

// GET: Get active saving goals
router.get("/getActive/:userId", async (req, res) => {
  try {
    const requestUserId = req.params.userId;
    const authUserId = req.user.id;

    if (requestUserId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const activeGoals = await Saving.getActiveGoals(requestUserId);

    res.json({
      success: true,
      data: activeGoals
    });

  } catch (error) {
    console.error('❌ Error fetching active savings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active savings',
      error: error.message
    });
  }
});

// GET: Get completed saving goals
router.get("/getCompleted/:userId", async (req, res) => {
  try {
    const requestUserId = req.params.userId;
    const authUserId = req.user.id;

    if (requestUserId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const completedGoals = await Saving.getCompletedGoals(requestUserId);

    res.json({
      success: true,
      data: completedGoals
    });

  } catch (error) {
    console.error('❌ Error fetching completed savings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch completed savings',
      error: error.message
    });
  }
});

// PUT: Add money to saving goal
router.put("/addAmount/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const savingId = req.params.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    const saving = await Saving.findOne({ _id: savingId, userId });

    if (!saving) {
      return res.status(404).json({
        success: false,
        message: 'Saving goal not found'
      });
    }

    if (saving.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot add money to inactive saving goal'
      });
    }

    await saving.addAmount(amount);

    res.json({
      success: true,
      message: `Successfully added ${saving.formattedCurrAmt.split(' ')[0]} ${amount} to your saving goal`,
      data: saving
    });

  } catch (error) {
    console.error('❌ Error adding amount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add amount to saving goal',
      error: error.message
    });
  }
});

// PUT: Withdraw money from saving goal
router.put("/withdrawAmount/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const savingId = req.params.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    const saving = await Saving.findOne({ _id: savingId, userId });

    if (!saving) {
      return res.status(404).json({
        success: false,
        message: 'Saving goal not found'
      });
    }

    if (amount > saving.currAmt) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient funds in saving goal'
      });
    }

    await saving.withdrawAmount(amount);

    res.json({
      success: true,
      message: `Successfully withdrew ${saving.formattedCurrAmt.split(' ')[0]} ${amount} from your saving goal`,
      data: saving
    });

  } catch (error) {
    console.error('❌ Error withdrawing amount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw amount from saving goal',
      error: error.message
    });
  }
});

// PUT: Update saving goal target
router.put("/updateTarget/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const savingId = req.params.id;
    const { targetAmount, targetDate } = req.body;

    if (!targetAmount || targetAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Target amount must be a positive number'
      });
    }

    let targetDateObj = null;
    if (targetDate) {
      targetDateObj = new Date(targetDate);
      if (isNaN(targetDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid target date format'
        });
      }
    }

    const saving = await Saving.findOne({ _id: savingId, userId });

    if (!saving) {
      return res.status(404).json({
        success: false,
        message: 'Saving goal not found'
      });
    }

    await saving.updateTarget(targetAmount, targetDateObj);

    res.json({
      success: true,
      message: 'Saving goal target updated successfully',
      data: saving
    });

  } catch (error) {
    console.error('❌ Error updating target:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update saving goal target',
      error: error.message
    });
  }
});

// GET: Get savings by category summary
router.get("/summary/:userId/category", async (req, res) => {
  try {
    const requestUserId = req.params.userId;
    const authUserId = req.user.id;

    if (requestUserId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const summary = await Saving.getSavingsByCategory(requestUserId);

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('❌ Error fetching savings summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch savings summary',
      error: error.message
    });
  }
});

export default router;