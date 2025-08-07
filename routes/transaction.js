import express from 'express';
import Transaction from '../models/transaction.js';
import { authenticate } from '../middlewares/auth.js';
import mongoose from 'mongoose';

const router = express.Router();

// Middleware to authenticate all transaction routes
router.use(authenticate);

// GET: Transaction analytics with yearly/monthly modes
router.get('/analytics', async (req, res) => {
  try {
    const { month, year } = req.query;
    const userId = req.user.id;

    if (!year) {
      return res.status(400).json({ 
        success: false, 
        message: 'Year is required' 
      });
    }

    const yearNum = parseInt(year);

    // ========== YEARLY MODE ==========
    if (!month) {
      const raw = await Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: {
              $gte: new Date(yearNum, 0, 1),
              $lt: new Date(yearNum + 1, 0, 1),
            },
            status: 'completed'
          },
        },
        {
          $group: {
            _id: {
              month: { $month: "$timestamp" },
              type: "$type",
            },
            total: { $sum: "$amount" },
          },
        },
        {
          $group: {
            _id: "$_id.month",
            income: {
              $sum: {
                $cond: [{ $eq: ["$_id.type", "income"] }, "$total", 0],
              },
            },
            expense: {
              $sum: {
                $cond: [{ $eq: ["$_id.type", "expense"] }, "$total", 0],
              },
            },
          },
        },
        {
          $addFields: {
            netflowPercent: {
              $cond: [
                { $eq: ["$income", 0] },
                0,
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: [{ $subtract: ["$income", "$expense"] }, "$income"] },
                        100
                      ]
                    },
                    0
                  ]
                }
              ]
            }
          }
        },
        {
          $project: {
            _id: 0,
            month: "$_id",
            income: 1,
            expense: 1,
            netflowPercent: 1
          }
        },
        { $sort: { month: 1 } }
      ]);

      // Initialize arrays for 12 months
      const income = Array(12).fill(0);
      const expense = Array(12).fill(0);
      const netflowPercent = Array(12).fill(0);

      raw.forEach(item => {
        const i = item.month - 1;
        income[i] = item.income;
        expense[i] = item.expense;
        netflowPercent[i] = item.netflowPercent;
      });

      return res.json({
        success: true,
        data: {
          type: 'yearly',
          year: yearNum,
          income,
          expense,
          netflowPercent
        }
      });
    }

    // ========== MONTHLY MODE ==========
    const monthNum = parseInt(month);
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 1);

    // Get weekly data
    const weeklyData = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: startDate, $lt: endDate },
          status: 'completed'
        }
      },
      {
        $addFields: {
          week: {
            $ceil: {
              $divide: [{ $dayOfMonth: "$timestamp" }, 7]
            }
          }
        }
      },
      {
        $group: {
          _id: "$week",
          income: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          expense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const weeklyIncome = [0, 0, 0, 0];
    const weeklyExpense = [0, 0, 0, 0];
    const netFlowPercent = [0, 0, 0, 0];
    let totalIncome = 0;
    let totalExpense = 0;

    weeklyData.forEach((item) => {
      const i = Math.min(parseInt(item._id) - 1, 3); // Ensure max index is 3
      const income = item.income || 0;
      const expense = item.expense || 0;
      weeklyIncome[i] = income;
      weeklyExpense[i] = expense;
      totalIncome += income;
      totalExpense += expense;
      netFlowPercent[i] = income === 0 ? 0 : Math.round(((income - expense) / income) * 100);
    });

    // Get category breakdown for expenses
    const categoryData = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: startDate, $lt: endDate },
          type: "expense",
          status: 'completed'
        }
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    const expensePerCategory = {};
    categoryData.forEach((c) => {
      expensePerCategory[c._id] = {
        total: c.total,
        count: c.count
      };
    });

    return res.json({
      success: true,
      data: {
        type: 'monthly',
        year: yearNum,
        month: monthNum,
        totals: {
          income: totalIncome,
          expense: totalExpense,
          netflow: totalIncome - totalExpense
        },
        weekly: {
          income: weeklyIncome,
          expense: weeklyExpense,
          netFlowPercent
        },
        expensePerCategory
      }
    });

  } catch (error) {
    console.error('❌ Transaction analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction analytics',
      error: error.message
    });
  }
});

// GET: Get transactions with filters
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      type,
      category,
      startDate,
      endDate,
      currency,
      status = 'completed'
    } = req.query;

    const query = { userId, status };
    
    if (type) query.type = type;
    if (category) query.category = category;
    if (currency) query.currency = currency;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('receiptId', 'storeName total')
      .populate('billId', 'title amount');

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: transactions.length,
          totalRecords: total
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

// POST: Create new transaction
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      type,
      category,
      amount,
      currency = 'IDR',
      title,
      description,
      source,
      tags = [],
      timestamp,
      recurring = 'none',
      receiptId,
      billId
    } = req.body;

    if (!type || !category || !amount || !title || !source) {
      return res.status(400).json({
        success: false,
        message: 'Type, category, amount, title, and source are required'
      });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "income" or "expense"'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be positive'
      });
    }

    const transaction = new Transaction({
      userId,
      type,
      category,
      amount,
      currency,
      title,
      description,
      source,
      tags,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      recurring,
      receiptId,
      billId
    });

    const savedTransaction = await transaction.save();

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: savedTransaction
    });

  } catch (error) {
    console.error('❌ Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error.message
    });
  }
});

// GET: Get specific transaction
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const transaction = await Transaction.findOne({ 
      _id: req.params.id, 
      userId 
    })
    .populate('receiptId')
    .populate('billId');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error('❌ Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction',
      error: error.message
    });
  }
});

// PUT: Update transaction
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates.userId;
    delete updates.createdAt;
    delete updates.updatedAt;

    if (updates.amount && updates.amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be positive'
      });
    }

    if (updates.type && !['income', 'expense'].includes(updates.type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "income" or "expense"'
      });
    }

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: transaction
    });

  } catch (error) {
    console.error('❌ Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction',
      error: error.message
    });
  }
});

// DELETE: Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const transaction = await Transaction.findOneAndDelete({ 
      _id: req.params.id, 
      userId 
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete transaction',
      error: error.message
    });
  }
});

// GET: Transaction summary by category
router.get('/summary/category', async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, type } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    const summary = type === 'income' 
      ? await Transaction.getIncomeBySource(userId, start, end)
      : await Transaction.getSpendingByCategory(userId, start, end);

    res.json({
      success: true,
      data: {
        summary,
        period: { startDate: start, endDate: end },
        type: type || 'expense'
      }
    });

  } catch (error) {
    console.error('❌ Error fetching category summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category summary',
      error: error.message
    });
  }
});

export default router;