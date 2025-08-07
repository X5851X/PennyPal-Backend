import axios from 'axios';
import Currency from '../models/currency.js';

const fetchAndSaveExchangeRates = async () => {
  try {
    // Use Open Exchange Rates API
    const appId = process.env.OPEN_EXCHANGE_APP_ID;
    if (!appId) {
      throw new Error('OPEN_EXCHANGE_APP_ID not configured');
    }
    
    const response = await axios.get(`https://openexchangerates.org/api/latest.json?app_id=${appId}`);
    
    const { base, rates } = response.data;

    // Check if we already have recent rates for this base currency
    const existingRates = await Currency.getValidRates(base);
    
    if (existingRates && !existingRates.isExpired) {
      console.log('Using cached exchange rates');
      return existingRates;
    }

    // Create new rates entry
    const newRates = new Currency({
      base,
      rates,
      source: 'openexchangerates',
      fetchedAt: new Date(),
      isActive: true
    });

    const saved = await newRates.save();
    console.log('Exchange rates saved:', saved._id);
    
    // Cleanup old inactive rates
    await Currency.cleanupExpiredRates(24);
    
    return saved;
  } catch (error) {
    console.error('Error fetching exchange rates:', error.message);
    
    // Try to get the latest cached rates as fallback
    try {
      const fallbackRates = await Currency.getLatestRates('USD');
      if (fallbackRates) {
        console.log('Using fallback cached rates');
        return fallbackRates;
      }
    } catch (fallbackError) {
      console.error('No fallback rates available:', fallbackError.message);
    }
    
    throw error;
  }
};

// Function to convert currency using current rates
export const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  try {
    const rates = await Currency.getValidRates('USD');
    
    if (!rates) {
      throw new Error('No exchange rates available');
    }
    
    return rates.convertAmount(amount, fromCurrency, toCurrency);
  } catch (error) {
    console.error('Error converting currency:', error.message);
    throw error;
  }
};

// Function to get current exchange rate between two currencies
export const getExchangeRate = async (fromCurrency, toCurrency) => {
  try {
    const rates = await Currency.getValidRates('USD');
    
    if (!rates) {
      throw new Error('No exchange rates available');
    }
    
    return rates.getExchangeRate(fromCurrency, toCurrency);
  } catch (error) {
    console.error('Error getting exchange rate:', error.message);
    throw error;
  }
};

// Controller function to manually trigger rate fetch
export const fetchRatesController = async (req, res) => {
  try {
    const rates = await fetchAndSaveExchangeRates();
    
    res.status(200).json({
      success: true,
      message: 'Exchange rates fetched successfully',
      data: {
        base: rates.base,
        fetchedAt: rates.fetchedAt,
        rateCount: Object.keys(rates.rates).length
      }
    });
  } catch (error) {
    console.error('Error in fetchRatesController:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exchange rates',
      error: error.message
    });
  }
};

// Controller to get current rates
export const getCurrentRates = async (req, res) => {
  try {
    const { base = 'USD' } = req.query;
    const rates = await Currency.getValidRates(base);
    
    if (!rates) {
      return res.status(404).json({
        success: false,
        message: 'No exchange rates available'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        base: rates.base,
        rates: rates.rates,
        fetchedAt: rates.fetchedAt,
        isExpired: rates.isExpired,
        supportedCurrencies: rates.supportedCurrencies
      }
    });
  } catch (error) {
    console.error('Error getting current rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get exchange rates',
      error: error.message
    });
  }
};

// Controller for currency conversion
export const convertCurrencyController = async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency, userId, purpose } = req.body;
    
    if (!amount || !fromCurrency || !toCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Amount, fromCurrency, and toCurrency are required'
      });
    }
    
    const convertedAmount = await convertCurrency(amount, fromCurrency, toCurrency);
    
    // If userId provided, save the conversion to user budget history
    if (userId) {
      const rates = await Currency.getValidRates('USD');
      await rates.addUserBudget(userId, amount, fromCurrency, toCurrency, purpose || 'other');
    }
    
    res.status(200).json({
      success: true,
      data: {
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount,
        convertedCurrency: toCurrency,
        exchangeRate: await getExchangeRate(fromCurrency, toCurrency)
      }
    });
  } catch (error) {
    console.error('Error converting currency:', error);
    res.status(500).json({
      success: false,
      message: 'Currency conversion failed',
      error: error.message
    });
  }
};

// Controller to get user's conversion history
export const getUserConversionHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    const history = await Currency.getUserBudgetHistory(userId, parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting conversion history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversion history',
      error: error.message
    });
  }
};

export default fetchAndSaveExchangeRates;