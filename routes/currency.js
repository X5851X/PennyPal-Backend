import express from 'express';
import axios from 'axios';
import Currency from '../models/currency.js';
import { authenticate } from '../middlewares/auth.js';
import { 
  getUserTransactionsConverted, 
  convertTransactionsBatch, 
  getCurrencyRates 
} from '../controllers/currencyConverter.js';

const router = express.Router();

// GET latest exchange rate
router.get('/', async (req, res) => {
  try {
    const latest = await Currency.getLatestRates();
    if (!latest) {
      return res.status(404).json({ 
        success: false, 
        message: 'No exchange rates found' 
      });
    }
    
    res.json({
      success: true,
      data: latest
    });
  } catch (error) {
    console.error('❌ Error fetching exchange rates:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch exchange rates',
      error: error.message 
    });
  }
});

// GET valid (non-expired) rates
router.get('/valid', async (req, res) => {
  try {
    const { base = 'USD' } = req.query;
    const validRates = await Currency.getValidRates(base);
    
    if (!validRates || validRates.isExpired) {
      return res.status(404).json({
        success: false,
        message: 'No valid exchange rates found. Please refresh rates.',
        expired: true
      });
    }
    
    res.json({
      success: true,
      data: validRates
    });
  } catch (error) {
    console.error('❌ Error fetching valid rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch valid exchange rates',
      error: error.message
    });
  }
});

// POST: Fetch from Exchange Rate API and save
router.post('/refresh', async (req, res) => {
  try {
    const { base = 'USD' } = req.body;
    
    // Using Open Exchange Rates API
    const appId = process.env.OPEN_EXCHANGE_APP_ID;
    if (!appId) {
      throw new Error('OPEN_EXCHANGE_APP_ID not configured');
    }
    
    const response = await axios.get(`https://openexchangerates.org/api/latest.json?app_id=${appId}`);
    
    if (!response.data || !response.data.rates) {
      throw new Error('Invalid response from Open Exchange Rates API');
    }

    const { rates } = response.data;

    // Filter supported currencies from your model
    const supportedCurrencies = ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'AUD', 'GBP', 'CHF', 'CAD', 'KRW', 'CNY', 'HKD', 'THB', 'PHP', 'VND', 'INR', 'BRL'];
    const filteredRates = {};
    
    supportedCurrencies.forEach(currency => {
      if (rates[currency]) {
        filteredRates[currency] = rates[currency];
      }
    });

    // Ensure base currency has rate of 1
    filteredRates[base] = 1;

    const currencyDoc = new Currency({
      base,
      rates: filteredRates,
      source: 'openexchangerates',
      fetchedAt: new Date(),
      isActive: true
    });

    const saved = await currencyDoc.save();
    
    res.status(201).json({
      success: true,
      message: 'Exchange rates refreshed successfully',
      data: saved
    });
  } catch (error) {
    console.error('❌ Error refreshing exchange rates:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch and save exchange rates',
      error: error.message 
    });
  }
});

// POST: Convert currency amount
router.post('/convert', async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency, base = 'USD' } = req.body;

    if (!amount || !fromCurrency || !toCurrency) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount, fromCurrency, and toCurrency are required' 
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Get latest valid rates
    const latest = await Currency.getValidRates(base);
    if (!latest) {
      return res.status(404).json({
        success: false,
        message: 'No valid exchange rates available. Please refresh rates first.',
        needsRefresh: true
      });
    }

    // Perform conversion
    const convertedAmount = latest.convertAmount(amount, fromCurrency, toCurrency);
    const exchangeRate = latest.getExchangeRate(fromCurrency, toCurrency);

    res.json({
      success: true,
      data: {
        original: { amount, currency: fromCurrency },
        converted: { amount: convertedAmount, currency: toCurrency },
        exchangeRate,
        timestamp: latest.fetchedAt
      }
    });

  } catch (error) {
    console.error('❌ Currency conversion error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Currency conversion failed',
      error: error.message 
    });
  }
});

// POST: Convert and save user budget (requires authentication)
router.post('/convert-budget', authenticate, async (req, res) => {
  try {
    const { amount, originalCurrency, convertedCurrency, purpose = 'budget_conversion' } = req.body;
    const userId = req.user.id;

    if (!amount || !originalCurrency || !convertedCurrency) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount, originalCurrency, and convertedCurrency are required' 
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Get latest rates
    const latest = await Currency.getValidRates();
    if (!latest) {
      return res.status(404).json({
        success: false,
        message: 'No valid exchange rates available. Please refresh rates first.',
        needsRefresh: true
      });
    }

    // Add user budget and save
    await latest.addUserBudget(userId, amount, originalCurrency, convertedCurrency, purpose);

    res.json({
      success: true,
      message: 'Budget conversion saved successfully',
      data: {
        original: { amount, currency: originalCurrency },
        converted: { 
          amount: latest.convertAmount(amount, originalCurrency, convertedCurrency), 
          currency: convertedCurrency 
        },
        exchangeRate: latest.getExchangeRate(originalCurrency, convertedCurrency),
        purpose
      }
    });

  } catch (error) {
    console.error('❌ Budget conversion error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Budget conversion failed',
      error: error.message 
    });
  }
});

// GET user's budget conversion history (requires authentication)
router.get('/budget-history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50 } = req.query;

    const history = await Currency.getUserBudgetHistory(userId, parseInt(limit));

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('❌ Error fetching budget history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget history',
      error: error.message
    });
  }
});

// POST: Cleanup expired rates (admin only)
router.post('/cleanup', async (req, res) => {
  try {
    const { olderThanHours = 24 } = req.body;
    
    const result = await Currency.cleanupExpiredRates(olderThanHours);
    
    res.json({
      success: true,
      message: `Cleaned up expired rates older than ${olderThanHours} hours`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup expired rates',
      error: error.message
    });
  }
});

// GET supported currencies
router.get('/supported', async (req, res) => {
  try {
    const latest = await Currency.getLatestRates();
    const supportedCurrencies = latest ? latest.supportedCurrencies : 
      ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'AUD', 'GBP', 'CHF', 'CAD', 'KRW', 'CNY', 'HKD', 'THB', 'PHP', 'VND', 'INR', 'BRL'];
    
    res.json({
      success: true,
      data: {
        currencies: supportedCurrencies,
        base: latest?.base || 'USD'
      }
    });
  } catch (error) {
    console.error('❌ Error fetching supported currencies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supported currencies',
      error: error.message
    });
  }
});

// POST: Convert multiple transactions to target currency
router.post('/convert-transactions', authenticate, async (req, res) => {
  try {
    const { transactions, targetCurrency } = req.body;
    
    if (!transactions || !Array.isArray(transactions) || !targetCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Transactions array and targetCurrency are required'
      });
    }
    
    const latest = await Currency.getValidRates();
    if (!latest) {
      return res.status(404).json({
        success: false,
        message: 'No valid exchange rates available. Please refresh rates first.',
        needsRefresh: true
      });
    }
    
    const convertedTransactions = transactions.map(transaction => {
      try {
        const convertedAmount = latest.convertAmount(
          transaction.amount, 
          transaction.currency, 
          targetCurrency
        );
        
        return {
          ...transaction,
          originalAmount: transaction.amount,
          originalCurrency: transaction.currency,
          convertedAmount,
          convertedCurrency: targetCurrency,
          exchangeRate: latest.getExchangeRate(transaction.currency, targetCurrency)
        };
      } catch (error) {
        return {
          ...transaction,
          error: error.message
        };
      }
    });
    
    res.json({
      success: true,
      data: {
        convertedTransactions,
        targetCurrency,
        timestamp: latest.fetchedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Bulk conversion error:', error);
    res.status(500).json({
      success: false,
      message: 'Bulk currency conversion failed',
      error: error.message
    });
  }
});

// GET: User transactions converted to target currency
router.get('/transactions-converted', authenticate, getUserTransactionsConverted);

// POST: Convert specific transactions batch
router.post('/convert-batch', authenticate, convertTransactionsBatch);

// GET: Currency rates with formatting
router.get('/rates', getCurrencyRates);

export default router;