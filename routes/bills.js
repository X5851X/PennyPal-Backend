import express from "express";
import Bill from '../models/bills.js';
import { authenticate } from '../middlewares/auth.js';
import mongoose from 'mongoose';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// POST: Add new bill
router.post("/addBill", async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      amount,
      currency = 'IDR',
      toWhom,
      recurring = 'none',
      dueDate,
      category = 'other',
      notes,
      reminders = [7, 3, 1]
    } = req.body;

    // Validation
    if (!title || !amount || !toWhom || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Title, amount, toWhom, and dueDate are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be positive'
      });
    }

    // Check if due date is valid
    const dueDateObj = new Date(dueDate);
    if (isNaN(dueDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid due date format'
      });
    }

    const bill = new Bill({
      userId,
      title: title.trim(),
      amount,
      currency,
      toWhom: toWhom.trim(),
      recurring,
      dueDate: dueDateObj,
      category,
      notes: notes?.trim(),
      reminders
    });

    const savedBill = await bill.save();

    res.status(201).json({
      success: true,
      message: 'Bill added successfully',
      data: savedBill
    });

  } catch (error) {
    console.error('❌ Error adding bill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add bill',
      error: error.message
    });
  }
});

// PUT: Edit existing bill
router.put("/editBill/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const billId = req.params.id;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates.userId;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Validate amount if provided
    if (updates.amount !== undefined && updates.amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be positive'
      });
    }

    // Validate due date if provided
    if (updates.dueDate) {
      const dueDateObj = new Date(updates.dueDate);
      if (isNaN(dueDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid due date format'
        });
      }
      updates.dueDate = dueDateObj;
    }

    // Trim string fields
    if (updates.title) updates.title = updates.title.trim();
    if (updates.toWhom) updates.toWhom = updates.toWhom.trim();
    if (updates.notes) updates.notes = updates.notes.trim();

    const bill = await Bill.findOneAndUpdate(
      { _id: billId, userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.json({
      success: true,
      message: 'Bill updated successfully',
      data: bill
    });

  } catch (error) {
    console.error('❌ Error editing bill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to edit bill',
      error: error.message
    });
  }
});

// DELETE: Delete bill
router.delete("/deleteBill/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const billId = req.params.id;

    const bill = await Bill.findOneAndDelete({ _id: billId, userId });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.json({
      success: true,
      message: 'Bill deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting bill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bill',
      error: error.message
    });
  }
});

// GET: Get all bills for user with filtering options
router.get("/getBills/:userId", async (req, res) => {
  try {
    const requestUserId = req.params.userId;
    const authUserId = req.user.id;

    // Ensure user can only access their own bills
    if (requestUserId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view your own bills'
      });
    }

    const {
      status,
      category,
      recurring,
      currency,
      page = 1,
      limit = 20,
      sortBy = 'dueDate',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    const query = { userId: requestUserId };
    
    if (status) query.status = status;
    if (category) query.category = category;
    if (recurring) query.recurring = recurring;
    if (currency) query.currency = currency;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const bills = await Bill.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bill.countDocuments(query);

    // Get additional statistics
    const stats = await Bill.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(requestUserId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        bills,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: bills.length,
          totalRecords: total
        },
        stats
      }
    });

  } catch (error) {
    console.error('❌ Error fetching bills:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bills',
      error: error.message
    });
  }
});

// GET: Get upcoming bills (next 30 days)
router.get("/getUpcoming/:userId", async (req, res) => {
  try {
    const requestUserId = req.params.userId;
    const authUserId = req.user.id;

    if (requestUserId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { days = 30 } = req.query;
    const upcomingBills = await Bill.getUpcoming(requestUserId, parseInt(days));

    res.json({
      success: true,
      data: upcomingBills
    });

  } catch (error) {
    console.error('❌ Error fetching upcoming bills:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming bills',
      error: error.message
    });
  }
});

// GET: Get overdue bills
router.get("/getOverdue/:userId", async (req, res) => {
  try {
    const requestUserId = req.params.userId;
    const authUserId = req.user.id;

    if (requestUserId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const overdueBills = await Bill.getOverdue(requestUserId);

    res.json({
      success: true,
      data: overdueBills
    });

  } catch (error) {
    console.error('❌ Error fetching overdue bills:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overdue bills',
      error: error.message
    });
  }
});

// PUT: Mark bill as paid
router.put("/markPaid/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const billId = req.params.id;
    const { paidAmount } = req.body;

    const bill = await Bill.findOne({ _id: billId, userId });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    if (bill.isPaid) {
      return res.status(400).json({
        success: false,
        message: 'Bill is already marked as paid'
      });
    }

    await bill.markAsPaid(paidAmount);

    res.json({
      success: true,
      message: 'Bill marked as paid successfully',
      data: bill
    });

  } catch (error) {
    console.error('❌ Error marking bill as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark bill as paid',
      error: error.message
    });
  }
});

// GET: Get bills summary by category
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

    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const summary = await Bill.getTotalByCategory(requestUserId, start, end);

    res.json({
      success: true,
      data: {
        summary,
        period: { startDate: start, endDate: end }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching bills summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bills summary',
      error: error.message
    });
  }
});

export default router;