import express from 'express';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

// GET: Dashboard summary
router.get('/summary', async (req, res) => {
  try {
    const { period = 'thisMonth' } = req.query;
    const userId = req.user.id;

    // Mock data for now - replace with actual database queries
    const summaryData = {
      totalBalance: 15750000,
      thisMonthIncome: 8500000,
      thisMonthExpense: 6250000,
      netFlow: 2250000,
      balanceChange: '+12.5%',
      incomeChange: '+8.2%',
      expenseChange: '+15.3%',
      expenseCategories: [
        { name: 'Food', value: 1500000, percentage: 24 },
        { name: 'Transport', value: 1200000, percentage: 19.2 },
        { name: 'Shopping', value: 900000, percentage: 14.4 },
        { name: 'Bills', value: 800000, percentage: 12.8 },
        { name: 'Entertainment', value: 650000, percentage: 10.4 },
        { name: 'Other', value: 1200000, percentage: 19.2 }
      ],
      monthlyTrend: [
        { month: 'Jan', income: 7500000, expense: 5200000 },
        { month: 'Feb', income: 8200000, expense: 5800000 },
        { month: 'Mar', income: 7800000, expense: 6100000 },
        { month: 'Apr', income: 8500000, expense: 6250000 }
      ],
      goals: {
        savingsGoal: 5000000,
        currentSavings: 3250000,
        monthlyBudget: 7000000,
        monthlySpent: 6250000
      }
    };

    res.json({
      success: true,
      data: summaryData
    });

  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
      error: error.message
    });
  }
});

export default router;