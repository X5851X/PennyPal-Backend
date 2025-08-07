import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    enum: ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'KRW', 'AUD', 'GBP', 'CHF', 'CAD', 'CNY', 'HKD', 'THB', 'PHP', 'VND', 'INR', 'BRL'],
    default: 'IDR',
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  source: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 30
  }],
  receiptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Receipt'
  },
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  },
  recurring: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
    default: 'none'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'completed',
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
transactionSchema.index({ userId: 1, timestamp: -1 });
transactionSchema.index({ userId: 1, type: 1, timestamp: -1 });
transactionSchema.index({ userId: 1, category: 1 });
transactionSchema.index({ userId: 1, currency: 1 });

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function() {
  const currencyMap = {
    'IDR': 'id-ID',
    'USD': 'en-US',
    'EUR': 'de-DE',
    'JPY': 'ja-JP',
    'SGD': 'en-SG',
    'MYR': 'ms-MY',
    'KRW': 'ko-KR'
  };
  
  return new Intl.NumberFormat(currencyMap[this.currency] || 'id-ID', {
    style: 'currency',
    currency: this.currency
  }).format(this.amount);
});

// Virtual for transaction age in days
transactionSchema.virtual('daysAgo').get(function() {
  const today = new Date();
  const diffTime = today - this.timestamp;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Instance methods
transactionSchema.methods.addTag = function(tag) {
  if (tag && typeof tag === 'string' && !this.tags.includes(tag.trim())) {
    this.tags.push(tag.trim());
    return this.save();
  }
  return Promise.resolve(this);
};

transactionSchema.methods.removeTag = function(tag) {
  const index = this.tags.indexOf(tag);
  if (index > -1) {
    this.tags.splice(index, 1);
    return this.save();
  }
  return Promise.resolve(this);
};

// Static methods
transactionSchema.statics.getByDateRange = function(userId, startDate, endDate, type = null) {
  const query = {
    userId,
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (type) {
    query.type = type;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

transactionSchema.statics.getByCategory = function(userId, category, type = null) {
  const query = { userId, category };
  
  if (type) {
    query.type = type;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

transactionSchema.statics.getTotalByType = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);
};

transactionSchema.statics.getSpendingByCategory = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: 'expense',
        timestamp: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$category',
        totalSpent: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
        avgSpent: { $avg: '$amount' }
      }
    },
    {
      $sort: { totalSpent: -1 }
    }
  ]);
};

transactionSchema.statics.getIncomeBySource = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: 'income',
        timestamp: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$source',
        totalIncome: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
        avgIncome: { $avg: '$amount' }
      }
    },
    {
      $sort: { totalIncome: -1 }
    }
  ]);
};

transactionSchema.statics.getMonthlySummary = function(userId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        categories: { $addToSet: '$category' }
      }
    }
  ]);
};

transactionSchema.statics.getRecurringTransactions = function(userId, recurringType = null) {
  const query = {
    userId,
    recurring: { $ne: 'none' }
  };
  
  if (recurringType) {
    query.recurring = recurringType;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

// Pre-save middleware
transactionSchema.pre('save', function(next) {
  // Ensure timestamp is set
  if (!this.timestamp) {
    this.timestamp = new Date();
  }
  
  // Clean up tags - remove empty strings and duplicates
  if (this.tags && this.tags.length > 0) {
    this.tags = [...new Set(this.tags.filter(tag => tag && tag.trim().length > 0))];
  }
  
  // Set default currency based on user location if not set
  // This could be enhanced with user preferences
  if (!this.currency) {
    this.currency = 'IDR';
  }
  
  next();
});

export default mongoose.model('Transaction', transactionSchema);