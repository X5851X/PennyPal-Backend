import Currency from '../models/currency.js';
import Transaction from '../models/transaction.js';

// Get all user transactions with conversion to target currency
export const getUserTransactionsConverted = async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetCurrency, page = 1, limit = 50, type, category, startDate, endDate } = req.query;
    
    if (!targetCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Target currency is required'
      });
    }
    
    // Build query
    const query = { userId };
    if (type) query.type = type;
    if (category) query.category = category;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    // Get transactions with pagination
    const skip = (page - 1) * limit;
    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Transaction.countDocuments(query);
    
    // Get latest exchange rates
    const latest = await Currency.getValidRates();
    if (!latest) {
      return res.status(404).json({
        success: false,
        message: 'No valid exchange rates available. Please refresh rates first.',
        needsRefresh: true
      });
    }
    
    // Convert all transactions
    const convertedTransactions = transactions.map(transaction => {
      try {
        const convertedAmount = latest.convertAmount(
          transaction.amount,
          transaction.currency,
          targetCurrency
        );
        
        return {
          ...transaction.toObject(),
          originalAmount: transaction.amount,
          originalCurrency: transaction.currency,
          convertedAmount,
          convertedCurrency: targetCurrency,
          exchangeRate: latest.getExchangeRate(transaction.currency, targetCurrency)
        };
      } catch (error) {
        return {
          ...transaction.toObject(),
          conversionError: error.message
        };
      }
    });
    
    // Calculate summary
    const summary = convertedTransactions.reduce((acc, transaction) => {
      if (!transaction.conversionError) {
        if (transaction.type === 'income') {
          acc.totalIncome += transaction.convertedAmount;
          acc.incomeCount++;
        } else {
          acc.totalExpense += transaction.convertedAmount;
          acc.expenseCount++;
        }
      }
      return acc;
    }, {
      totalIncome: 0,
      totalExpense: 0,
      incomeCount: 0,
      expenseCount: 0
    });
    
    summary.netAmount = summary.totalIncome - summary.totalExpense;
    
    res.json({
      success: true,
      data: {
        transactions: convertedTransactions,
        summary,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        },
        targetCurrency,
        ratesTimestamp: latest.fetchedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting converted transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get converted transactions',
      error: error.message
    });
  }
};

// Convert specific transactions and return formatted data
export const convertTransactionsBatch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionIds, targetCurrency } = req.body;
    
    if (!transactionIds || !Array.isArray(transactionIds) || !targetCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Transaction IDs array and target currency are required'
      });
    }
    
    // Get user's transactions
    const transactions = await Transaction.find({
      _id: { $in: transactionIds },
      userId
    });
    
    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No transactions found'
      });
    }
    
    // Get latest exchange rates
    const latest = await Currency.getValidRates();
    if (!latest) {
      return res.status(404).json({
        success: false,
        message: 'No valid exchange rates available. Please refresh rates first.',
        needsRefresh: true
      });
    }
    
    // Convert transactions
    const convertedTransactions = transactions.map(transaction => {
      try {
        const convertedAmount = latest.convertAmount(
          transaction.amount,
          transaction.currency,
          targetCurrency
        );
        
        return {
          id: transaction._id,
          title: transaction.title,
          description: transaction.description,
          category: transaction.category,
          type: transaction.type,
          timestamp: transaction.timestamp,
          source: transaction.source,
          tags: transaction.tags,
          originalAmount: transaction.amount,
          originalCurrency: transaction.currency,
          convertedAmount,
          convertedCurrency: targetCurrency,
          exchangeRate: latest.getExchangeRate(transaction.currency, targetCurrency),
          formattedOriginal: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: transaction.currency
          }).format(transaction.amount),
          formattedConverted: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: targetCurrency
          }).format(convertedAmount)
        };
      } catch (error) {
        return {
          id: transaction._id,
          title: transaction.title,
          error: error.message
        };
      }
    });
    
    res.json({
      success: true,
      data: {
        convertedTransactions,
        targetCurrency,
        ratesTimestamp: latest.fetchedAt,
        totalConverted: convertedTransactions.filter(t => !t.error).length,
        totalErrors: convertedTransactions.filter(t => t.error).length
      }
    });
    
  } catch (error) {
    console.error('❌ Error converting transactions batch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert transactions',
      error: error.message
    });
  }
};

// Get currency conversion rates for supported currencies
export const getCurrencyRates = async (req, res) => {
  try {
    const { baseCurrency = 'USD' } = req.query;
    
    const latest = await Currency.getValidRates(baseCurrency);
    if (!latest) {
      return res.status(404).json({
        success: false,
        message: 'No valid exchange rates available. Please refresh rates first.',
        needsRefresh: true
      });
    }
    
    // Format rates with currency names
    const currencyNames = {
      'USD': 'US Dollar',
      'EUR': 'Euro',
      'GBP': 'British Pound',
      'JPY': 'Japanese Yen',
      'AUD': 'Australian Dollar',
      'CAD': 'Canadian Dollar',
      'CHF': 'Swiss Franc',
      'CNY': 'Chinese Yuan',
      'SEK': 'Swedish Krona',
      'NZD': 'New Zealand Dollar',
      'MXN': 'Mexican Peso',
      'SGD': 'Singapore Dollar',
      'HKD': 'Hong Kong Dollar',
      'NOK': 'Norwegian Krone',
      'KRW': 'South Korean Won',
      'TRY': 'Turkish Lira',
      'RUB': 'Russian Ruble',
      'INR': 'Indian Rupee',
      'BRL': 'Brazilian Real',
      'ZAR': 'South African Rand',
      'IDR': 'Indonesian Rupiah',
      'MYR': 'Malaysian Ringgit',
      'THB': 'Thai Baht',
      'PHP': 'Philippine Peso',
      'VND': 'Vietnamese Dong'
    };
    
    const formattedRates = Object.entries(latest.rates).map(([currency, rate]) => ({
      code: currency,
      name: currencyNames[currency] || currency,
      rate,
      symbol: getCurrencySymbol(currency)
    }));
    
    res.json({
      success: true,
      data: {
        baseCurrency,
        rates: formattedRates,
        fetchedAt: latest.fetchedAt,
        isExpired: latest.isExpired
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting currency rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get currency rates',
      error: error.message
    });
  }
};

// Helper function to get currency symbol
function getCurrencySymbol(currencyCode) {
  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'AUD': 'A$',
    'CAD': 'C$',
    'CHF': 'CHF',
    'CNY': '¥',
    'SEK': 'kr',
    'NZD': 'NZ$',
    'MXN': '$',
    'SGD': 'S$',
    'HKD': 'HK$',
    'NOK': 'kr',
    'KRW': '₩',
    'TRY': '₺',
    'RUB': '₽',
    'INR': '₹',
    'BRL': 'R$',
    'ZAR': 'R',
    'IDR': 'Rp',
    'MYR': 'RM',
    'THB': '฿',
    'PHP': '₱',
    'VND': '₫'
  };
  
  return symbols[currencyCode] || currencyCode;
}