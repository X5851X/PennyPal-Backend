import mongoose from "mongoose";

const savingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    targetAmt: {
        type: Number,
        required: true,
        min: 0
    },
    currAmt: {
        type: Number,
        default: 0,
        min: 0
    },
    currency: {
        type: String,
        enum: ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'KRW'],
        default: 'IDR',
        required: true
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
    targetDate: {
        type: Date,
        index: true
    },
    category: {
        type: String,
        enum: ['emergency', 'vacation', 'education', 'investment', 'gadget', 'other'],
        default: 'other'
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'paused', 'cancelled'],
        default: 'active',
        index: true
    }
}, { timestamps: true });

// Indexes for better query performance
savingSchema.index({ userId: 1, status: 1 });
savingSchema.index({ userId: 1, targetDate: 1 });
savingSchema.index({ userId: 1, category: 1 });

// Virtual for progress percentage
savingSchema.virtual('progressPercentage').get(function() {
    if (this.targetAmt <= 0) return 0;
    return Math.min(Math.round((this.currAmt / this.targetAmt) * 100), 100);
});

// Virtual for remaining amount
savingSchema.virtual('remainingAmt').get(function() {
    return Math.max(this.targetAmt - this.currAmt, 0);
});

// Virtual for formatted amounts
savingSchema.virtual('formattedTargetAmt').get(function() {
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
    }).format(this.targetAmt);
});

savingSchema.virtual('formattedCurrAmt').get(function() {
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
    }).format(this.currAmt);
});

// Virtual for days until target
savingSchema.virtual('daysUntilTarget').get(function() {
    if (!this.targetDate) return null;
    const today = new Date();
    const diffTime = this.targetDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance methods
savingSchema.methods.addAmount = function(amount) {
    if (amount <= 0) {
        throw new Error('Amount must be positive');
    }
    
    this.currAmt += amount;
    
    // Check if goal is completed
    if (this.currAmt >= this.targetAmt && this.status === 'active') {
        this.status = 'completed';
    }
    
    return this.save();
};

savingSchema.methods.withdrawAmount = function(amount) {
    if (amount <= 0) {
        throw new Error('Amount must be positive');
    }
    
    if (amount > this.currAmt) {
        throw new Error('Insufficient funds');
    }
    
    this.currAmt -= amount;
    
    // If was completed but now under target, set back to active
    if (this.currAmt < this.targetAmt && this.status === 'completed') {
        this.status = 'active';
    }
    
    return this.save();
};

savingSchema.methods.updateTarget = function(newTargetAmount, newTargetDate = null) {
    if (newTargetAmount <= 0) {
        throw new Error('Target amount must be positive');
    }
    
    this.targetAmt = newTargetAmount;
    
    if (newTargetDate) {
        this.targetDate = newTargetDate;
    }
    
    // Update status based on new target
    if (this.currAmt >= this.targetAmt && this.status === 'active') {
        this.status = 'completed';
    } else if (this.currAmt < this.targetAmt && this.status === 'completed') {
        this.status = 'active';
    }
    
    return this.save();
};

// Static methods
savingSchema.statics.getActiveGoals = function(userId) {
    return this.find({
        userId,
        status: 'active'
    }).sort({ targetDate: 1, createdAt: -1 });
};

savingSchema.statics.getCompletedGoals = function(userId) {
    return this.find({
        userId,
        status: 'completed'
    }).sort({ updatedAt: -1 });
};

savingSchema.statics.getTotalSavings = function(userId) {
    return this.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group: {
                _id: '$currency',
                totalSaved: { $sum: '$currAmt' },
                totalTarget: { $sum: '$targetAmt' },
                goalCount: { $sum: 1 },
                activeGoals: {
                    $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                },
                completedGoals: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                }
            }
        }
    ]);
};

savingSchema.statics.getSavingsByCategory = function(userId) {
    return this.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group: {
                _id: '$category',
                totalSaved: { $sum: '$currAmt' },
                totalTarget: { $sum: '$targetAmt' },
                goalCount: { $sum: 1 },
                avgProgress: { 
                    $avg: { 
                        $cond: [
                            { $gt: ['$targetAmt', 0] },
                            { $divide: ['$currAmt', '$targetAmt'] },
                            0
                        ]
                    }
                }
            }
        },
        {
            $sort: { totalSaved: -1 }
        }
    ]);
};

// Pre-save middleware
savingSchema.pre('save', function(next) {
    // Auto-update status based on progress
    if (this.currAmt >= this.targetAmt && this.status === 'active') {
        this.status = 'completed';
    }
    
    // Ensure currAmt doesn't exceed targetAmt by too much (optional business rule)
    // Uncomment if you want to enforce this
    // if (this.currAmt > this.targetAmt * 1.1) { // Allow 10% over-saving
    //     this.currAmt = this.targetAmt;
    // }
    
    next();
});

export default mongoose.model("Saving", savingSchema);