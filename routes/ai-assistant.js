import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import eliceService from '../services/elice.js';

const router = express.Router();
router.use(authenticate);

// GET: AI Assistant info
router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'PennyPal AI Assistant',
    version: '1.0.0',
    features: [
      'Financial advice and budgeting tips',
      'Expense categorization',
      'Spending pattern analysis',
      'Personalized recommendations'
    ],
    endpoints: {
      'POST /chat': 'Get financial advice',
      'POST /categorize': 'Auto-categorize expense',
      'POST /analyze': 'Analyze spending patterns'
    }
  });
});

// POST: Chat with financial advisor
router.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    console.log('💬 AI Chat request:', message.substring(0, 50) + '...');

    const response = await eliceService.getFinancialAdvice(message, context);
    
    res.json({
      success: true,
      data: {
        message: response.choices[0].message.content,
        usage: response.usage
      }
    });

  } catch (error) {
    console.error('❌ AI Chat error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get financial advice',
      error: error.message
    });
  }
});

// POST: Auto-categorize expense
router.post('/categorize', async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    console.log('🏷️ Categorizing expense:', description);

    const category = await eliceService.categorizeExpense(description);
    
    res.json({
      success: true,
      data: {
        description,
        category,
        confidence: category !== 'Other' ? 'high' : 'low'
      }
    });

  } catch (error) {
    console.error('❌ Categorization error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to categorize expense',
      error: error.message
    });
  }
});

// POST: Analyze spending patterns
router.post('/analyze', async (req, res) => {
  try {
    const { expenses } = req.body;

    if (!expenses || !Array.isArray(expenses)) {
      return res.status(400).json({
        success: false,
        message: 'Expenses array is required'
      });
    }

    console.log('📊 Analyzing spending patterns for', expenses.length, 'expenses');

    const analysis = await eliceService.analyzeSpending(expenses);
    
    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('❌ Analysis error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to analyze spending patterns',
      error: error.message
    });
  }
});

export default router;