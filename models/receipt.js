import mongoose from 'mongoose';

const receiptItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  lineNumber: {
    type: Number,
    required: true
  }
}, { _id: false });

const receiptSchema = new mongoose.Schema({
  // User who uploaded the receipt
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Store information
  storeName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  storeAddress: {
    type: String,
    trim: true,
    maxlength: 200
  },
  
  // Receipt details
  receiptDate: {
    type: Date,
    default: null,
    index: true
  },
  receiptTime: {
    type: String,
    trim: true
  },
  receiptNumber: {
    type: String,
    trim: true,
    maxlength: 50
  },
  
  // Financial data
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  
  // Currency field
  currency: {
    type: String,
    enum: ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'KRW'],
    default: 'IDR',
    required: true
  },
  
  // Items purchased
  items: [receiptItemSchema],
  
  // OCR data
  ocrText: {
    type: String,
    required: true
  },
  ocrConfidence: {
    type: Number,
    min: 0,
    max: 100
  },
  ocrConfidenceLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  
  // Processing information
  processingTime: {
    type: Number, // in milliseconds
    min: 0
  },
  originalFilename: {
    type: String,
    trim: true
  },
  fileSize: {
    type: Number,
    min: 0
  },
  
  // Categories and tags
  category: {
    type: String,
    enum: ['groceries', 'restaurant', 'shopping', 'pharmacy', 'gas', 'other'],
    default: 'other',
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 30
  }],
  
  // Status and verification
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'archived'],
    default: 'pending',
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  
  // Notes and corrections
  notes: {
    type: String,
    maxlength: 500
  },
  corrections: [{
    field: String,
    originalValue: String,
    correctedValue: String,
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    correctedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
receiptSchema.index({ userId: 1, createdAt: -1 });
receiptSchema.index({ userId: 1, receiptDate: -1 });
receiptSchema.index({ userId: 1, category: 1 });
receiptSchema.index({ userId: 1, total: -1 });
receiptSchema.index({ storeName: 1, userId: 1 });
receiptSchema.index({ userId: 1, currency: 1 });

// Virtual for total items count
receiptSchema.virtual('itemCount').get(function() {
  return this.items.length;
});

// Virtual for items total (sum of all item prices)
receiptSchema.virtual('itemsTotal').get(function() {
  return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
});

// Virtual for formatted total with proper currency
receiptSchema.virtual('formattedTotal').get(function() {
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
  }).format(this.total);
});

// Virtual for formatted subtotal
receiptSchema.virtual('formattedSubtotal').get(function() {
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
  }).format(this.subtotal);
});

// Instance methods
receiptSchema.methods.addCorrection = function(field, originalValue, correctedValue, userId) {
  this.corrections.push({
    field,
    originalValue,
    correctedValue,
    correctedBy: userId
  });
  return this.save();
};

receiptSchema.methods.verify = function(userId) {
  this.isVerified = true;
  this.status = 'verified';
  this.verifiedBy = userId;
  this.verifiedAt = new Date();
  return this.save();
};

receiptSchema.methods.categorize = function() {
  const storeName = this.storeName?.toLowerCase() || '';
  
  if (storeName.includes('indomaret') || storeName.includes('alfamart') || 
      storeName.includes('hypermart') || storeName.includes('carrefour')) {
    this.category = 'groceries';
  } else if (storeName.includes('mcdonald') || storeName.includes('kfc') || 
             storeName.includes('pizza') || storeName.includes('resto')) {
    this.category = 'restaurant';
  } else if (storeName.includes('pharmacy') || storeName.includes('apotek') || 
             storeName.includes('guardian') || storeName.includes('watson')) {
    this.category = 'pharmacy';
  } else if (storeName.includes('pertamina') || storeName.includes('shell') || 
             storeName.includes('spbu')) {
    this.category = 'gas';
  }
  
  return this.category;
};

// Method to detect currency from OCR text
receiptSchema.methods.detectCurrency = function() {
  const ocrLower = this.ocrText?.toLowerCase() || '';
  
  // Indonesian stores/text patterns
  if (ocrLower.includes('rp') || ocrLower.includes('rupiah') || 
      ocrLower.includes('indomaret') || ocrLower.includes('alfamart')) {
    this.currency = 'IDR';
  }
  // Korean stores/text patterns
  else if (ocrLower.includes('₩') || ocrLower.includes('won') || 
           ocrLower.includes('원') || ocrLower.includes('krw')) {
    this.currency = 'KRW';
  }
  // US dollar patterns
  else if (ocrLower.includes('$') || ocrLower.includes('usd') || 
           ocrLower.includes('dollar')) {
    this.currency = 'USD';
  }
  // Euro patterns
  else if (ocrLower.includes('€') || ocrLower.includes('eur') || 
           ocrLower.includes('euro')) {
    this.currency = 'EUR';
  }
  // Japanese Yen patterns
  else if (ocrLower.includes('¥') || ocrLower.includes('yen') || 
           ocrLower.includes('jpy')) {
    this.currency = 'JPY';
  }
  // Singapore Dollar patterns
  else if (ocrLower.includes('s$') || ocrLower.includes('sgd')) {
    this.currency = 'SGD';
  }
  // Malaysian Ringgit patterns
  else if (ocrLower.includes('rm') || ocrLower.includes('myr')) {
    this.currency = 'MYR';
  }
  
  return this.currency;
};

// Static methods
receiptSchema.statics.getByDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId,
    receiptDate: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ receiptDate: -1 });
};

receiptSchema.statics.getByCategory = function(userId, category) {
  return this.find({ userId, category }).sort({ createdAt: -1 });
};

receiptSchema.statics.getByCurrency = function(userId, currency) {
  return this.find({ userId, currency }).sort({ createdAt: -1 });
};

receiptSchema.statics.getTotalSpent = function(userId, startDate, endDate, currency = null) {
  const matchQuery = {
    userId: new mongoose.Types.ObjectId(userId),
    receiptDate: { $gte: startDate, $lte: endDate },
    status: { $ne: 'rejected' }
  };
  
  if (currency) {
    matchQuery.currency = currency;
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: currency ? null : '$currency',
        totalSpent: { $sum: '$total' },
        receiptCount: { $sum: 1 },
        avgSpent: { $avg: '$total' }
      }
    }
  ]);
};

receiptSchema.statics.getSpendingByCategory = function(userId, startDate, endDate, currency = null) {
  const matchQuery = {
    userId: new mongoose.Types.ObjectId(userId),
    receiptDate: { $gte: startDate, $lte: endDate },
    status: { $ne: 'rejected' }
  };
  
  if (currency) {
    matchQuery.currency = currency;
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { category: '$category', currency: '$currency' },
        totalSpent: { $sum: '$total' },
        receiptCount: { $sum: 1 },
        avgSpent: { $avg: '$total' }
      }
    },
    { $sort: { totalSpent: -1 } }
  ]);
};

receiptSchema.statics.getOCRStats = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$ocrConfidenceLevel',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$ocrConfidence' },
        avgProcessingTime: { $avg: '$processingTime' }
      }
    }
  ]);
};

// Pre-save middleware
receiptSchema.pre('save', function(next) {
  // Auto-categorize if not set
  if (this.category === 'other' && this.storeName) {
    this.categorize();
  }
  
  // Auto-detect currency if not set and OCR text available
  if (this.currency === 'IDR' && this.ocrText) {
    this.detectCurrency();
  }
  
  // Parse date if it's a string
  if (typeof this.receiptDate === 'string') {
    const parsedDate = new Date(this.receiptDate);
    if (!isNaN(parsedDate.getTime())) {
      this.receiptDate = parsedDate;
    }
  }
  
  next();
});

const Receipt = mongoose.model('Receipt', receiptSchema);

// OCR Log Schema (updated)
const ocrLogSchema = new mongoose.Schema({
  // User who performed OCR
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Request information
  requestId: {
    type: String,
    unique: true,
    required: true
  },
  endpoint: {
    type: String,
    required: true,
    enum: ['/ocr/receipt', '/ocr/text', '/ocr/bill', '/ocr/document']
  },
  
  // File information
  originalFilename: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0
  },
  mimeType: {
    type: String,
    required: true
  },
  
  // Processing results
  success: {
    type: Boolean,
    required: true,
    index: true
  },
  processingTime: {
    type: Number,
    required: true,
    min: 0
  },
  
  // OCR results
  extractedText: {
    type: String,
    default: ''
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100
  },
  confidenceLevel: {
    type: String,
    enum: ['low', 'medium', 'high']
  },
  
  // Detected currency
  detectedCurrency: {
    type: String,
    enum: ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'KRW'],
    default: 'IDR'
  },
  
  // Error information
  errorMessage: {
    type: String
  },
  errorCode: {
    type: String
  },
  
  // Receipt-specific data (only for receipt endpoint)
  receiptData: {
    storeName: String,
    date: String,
    time: String,
    total: Number,
    currency: String,
    itemCount: Number
  },
  
  // Performance metrics
  imagePreprocessingTime: {
    type: Number,
    min: 0
  },
  ocrProcessingTime: {
    type: Number,
    min: 0
  },
  parsingTime: {
    type: Number,
    min: 0
  },
  
  // Client information
  userAgent: String,
  ipAddress: String,
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for OCR Log
ocrLogSchema.index({ userId: 1, createdAt: -1 });
ocrLogSchema.index({ success: 1, createdAt: -1 });
ocrLogSchema.index({ endpoint: 1, createdAt: -1 });
ocrLogSchema.index({ processingTime: -1 });
ocrLogSchema.index({ detectedCurrency: 1, userId: 1 });

// Static methods for analytics
ocrLogSchema.statics.getSuccessRate = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        successful: { $sum: { $cond: ['$success', 1, 0] } }
      }
    },
    {
      $project: {
        total: 1,
        successful: 1,
        successRate: { $divide: ['$successful', '$total'] }
      }
    }
  ]);
};

ocrLogSchema.statics.getAverageProcessingTime = function(endpoint, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        endpoint,
        success: true,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        avgProcessingTime: { $avg: '$processingTime' },
        minProcessingTime: { $min: '$processingTime' },
        maxProcessingTime: { $max: '$processingTime' },
        count: { $sum: 1 }
      }
    }
  ]);
};

ocrLogSchema.statics.getCurrencyDetectionStats = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        success: true,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$detectedCurrency',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidence' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

const OCRLog = mongoose.model('OCRLog', ocrLogSchema);

export { Receipt, OCRLog };