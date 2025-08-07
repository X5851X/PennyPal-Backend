import mongoose from 'mongoose';

const userBudgetSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    originalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    originalCurrency: {
        type: String,
        required: true,
        enum: ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'AUD', 'GBP', 'CHF', 'CAD', 'KRW', 'CNY', 'HKD', 'THB', 'PHP', 'VND', 'INR', 'BRL']
    },
    convertedAmount: {
        type: Number,
        required: true,
        min: 0
    },
    convertedCurrency: {
        type: String,
        required: true,
        enum: ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'AUD', 'GBP', 'CHF', 'CAD', 'KRW', 'CNY', 'HKD', 'THB', 'PHP', 'VND', 'INR', 'BRL']
    },
    exchangeRate: {
        type: Number,
        required: true,
        min: 0
    },
    requestedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    purpose: {
        type: String,
        enum: ['budget_conversion', 'expense_tracking', 'bill_payment', 'savings_goal', 'other'],
        default: 'other'
    }
}, { _id: false });

const currencySchema = new mongoose.Schema({
    base: {
        type: String,
        required: true,
        enum: ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'AUD', 'GBP', 'CHF', 'CAD', 'KRW', 'CNY', 'HKD', 'THB', 'PHP', 'VND', 'INR', 'BRL'],
        default: 'USD'
    },
    rates: {
        type: Object,
        required: true,
        validate: {
            validator: function(rates) {
                // Ensure rates is an object with numeric values
                return rates && typeof rates === 'object' && 
                       Object.values(rates).every(rate => typeof rate === 'number' && rate > 0);
            },
            message: 'Rates must be an object with positive numeric values'
        }
    },
    fetchedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    source: {
        type: String,
        enum: ['openexchangerates', 'exchangerate-api', 'fixer', 'currencylayer', 'manual'],
        default: 'openexchangerates'
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    userBudgets: [userBudgetSchema],
    // Cache expiry time in minutes
    cacheExpiry: {
        type: Number,
        default: 60, // 1 hour
        min: 5,
        max: 1440 // 24 hours
    }
}, { timestamps: true });

// Indexes for better performance
currencySchema.index({ base: 1, fetchedAt: -1 });
currencySchema.index({ isActive: 1, fetchedAt: -1 });
currencySchema.index({ 'userBudgets.userId': 1 });

// Virtual for checking if rates are expired
currencySchema.virtual('isExpired').get(function() {
    const now = new Date();
    const expiryTime = new Date(this.fetchedAt.getTime() + (this.cacheExpiry * 60 * 1000));
    return now > expiryTime;
});

// Virtual for supported currencies
currencySchema.virtual('supportedCurrencies').get(function() {
    return Object.keys(this.rates || {}).concat([this.base]);
});

// Instance methods
currencySchema.methods.convertAmount = function(amount, fromCurrency, toCurrency) {
    if (!amount || amount <= 0) {
        throw new Error('Amount must be a positive number');
    }
    
    if (fromCurrency === toCurrency) {
        return amount;
    }
    
    let convertedAmount;
    
    if (fromCurrency === this.base) {
        // Convert from base currency
        const rate = this.rates[toCurrency];
        if (!rate) {
            throw new Error(`Rate not available for ${toCurrency}`);
        }
        convertedAmount = amount * rate;
    } else if (toCurrency === this.base) {
        // Convert to base currency
        const rate = this.rates[fromCurrency];
        if (!rate) {
            throw new Error(`Rate not available for ${fromCurrency}`);
        }
        convertedAmount = amount / rate;
    } else {
        // Convert between two non-base currencies
        const fromRate = this.rates[fromCurrency];
        const toRate = this.rates[toCurrency];
        
        if (!fromRate || !toRate) {
            throw new Error(`Rates not available for ${fromCurrency} or ${toCurrency}`);
        }
        
        // Convert to base currency first, then to target currency
        const baseAmount = amount / fromRate;
        convertedAmount = baseAmount * toRate;
    }
    
    return Math.round(convertedAmount * 100) / 100; // Round to 2 decimal places
};

currencySchema.methods.addUserBudget = function(userId, originalAmount, originalCurrency, convertedCurrency, purpose = 'other') {
    try {
        const convertedAmount = this.convertAmount(originalAmount, originalCurrency, convertedCurrency);
        const exchangeRate = this.getExchangeRate(originalCurrency, convertedCurrency);
        
        const budget = {
            userId,
            originalAmount,
            originalCurrency,
            convertedAmount,
            convertedCurrency,
            exchangeRate,
            purpose,
            requestedAt: new Date()
        };
        
        this.userBudgets.push(budget);
        return this.save();
    } catch (error) {
        throw new Error(`Failed to add user budget: ${error.message}`);
    }
};

currencySchema.methods.getExchangeRate = function(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
        return 1;
    }
    
    if (fromCurrency === this.base) {
        return this.rates[toCurrency] || null;
    } else if (toCurrency === this.base) {
        const rate = this.rates[fromCurrency];
        return rate ? (1 / rate) : null;
    } else {
        const fromRate = this.rates[fromCurrency];
        const toRate = this.rates[toCurrency];
        return (fromRate && toRate) ? (toRate / fromRate) : null;
    }
};

// Static methods
currencySchema.statics.getLatestRates = function(baseCurrency = 'USD') {
    return this.findOne({
        base: baseCurrency,
        isActive: true
    }).sort({ fetchedAt: -1 });
};

currencySchema.statics.getValidRates = function(baseCurrency = 'USD') {
    const expiredThreshold = new Date(Date.now() - (60 * 60 * 1000)); // 1 hour ago
    
    return this.findOne({
        base: baseCurrency,
        isActive: true,
        fetchedAt: { $gte: expiredThreshold }
    }).sort({ fetchedAt: -1 });
};

currencySchema.statics.getUserBudgetHistory = function(userId, limit = 50) {
    return this.aggregate([
        { $unwind: '$userBudgets' },
        { $match: { 'userBudgets.userId': new mongoose.Types.ObjectId(userId) } },
        { $sort: { 'userBudgets.requestedAt': -1 } },
        { $limit: limit },
        {
            $project: {
                originalAmount: '$userBudgets.originalAmount',
                originalCurrency: '$userBudgets.originalCurrency',
                convertedAmount: '$userBudgets.convertedAmount',
                convertedCurrency: '$userBudgets.convertedCurrency',
                exchangeRate: '$userBudgets.exchangeRate',
                purpose: '$userBudgets.purpose',
                requestedAt: '$userBudgets.requestedAt',
                base: '$base',
                fetchedAt: '$fetchedAt'
            }
        }
    ]);
};

currencySchema.statics.cleanupExpiredRates = function(olderThanHours = 24) {
    const threshold = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    return this.updateMany(
        { fetchedAt: { $lt: threshold } },
        { $set: { isActive: false } }
    );
};

// Pre-save middleware
currencySchema.pre('save', function(next) {
    // Ensure base currency is included in rates with value 1
    if (this.rates && !this.rates[this.base]) {
        this.rates[this.base] = 1;
    }
    
    // Update fetchedAt if rates are modified
    if (this.isModified('rates')) {
        this.fetchedAt = new Date();
    }
    
    next();
});

// Post-save middleware to cleanup old rates
currencySchema.post('save', function() {
    // Clean up old rates (keep only last 10 entries per base currency)
    this.constructor.aggregate([
        { $group: { _id: '$base', docs: { $push: '$$ROOT' } } },
        { $project: { docs: { $slice: ['$docs', -10] } } },
        { $unwind: '$docs' },
        { $replaceRoot: { newRoot: '$docs' } }
    ]).then(validDocs => {
        const validIds = validDocs.map(doc => doc._id);
        this.constructor.deleteMany({ _id: { $nin: validIds } }).catch(console.error);
    }).catch(console.error);
});

export default mongoose.model('Currency', currencySchema);