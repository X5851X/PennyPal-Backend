import mongoose from "mongoose";

const billSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        enum: ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'KRW'],
        default: 'IDR',
        required: true
    },
    toWhom: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    recurring: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
        default: 'none'
    },
    dueDate: {
        type: Date,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'overdue', 'cancelled'],
        default: 'pending',
        index: true
    },
    category: {
        type: String,
        enum: ['utilities', 'rent', 'insurance', 'subscription', 'loan', 'other'],
        default: 'other'
    },
    notes: {
        type: String,
        maxlength: 500,
        trim: true
    },
    reminders: {
        type: [Number], // Days before due date to remind
        default: [7, 3, 1]
    },
    isPaid: {
        type: Boolean,
        default: false,
        index: true
    },
    paidAt: {
        type: Date
    },
    paidAmount: {
        type: Number,
        min: 0
    }
}, { timestamps: true });

// Indexes for better query performance
billSchema.index({ userId: 1, dueDate: 1 });
billSchema.index({ userId: 1, status: 1 });
billSchema.index({ userId: 1, recurring: 1 });
billSchema.index({ userId: 1, category: 1 });
billSchema.index({ dueDate: 1, status: 1 });

// Virtual for days until due
billSchema.virtual('daysUntilDue').get(function() {
    const today = new Date();
    const diffTime = this.dueDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for formatted amount
billSchema.virtual('formattedAmount').get(function() {
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

// Instance methods
billSchema.methods.markAsPaid = function(amount = null) {
    this.isPaid = true;
    this.status = 'paid';
    this.paidAt = new Date();
    this.paidAmount = amount || this.amount;
    return this.save();
};

billSchema.methods.updateStatus = function() {
    if (this.isPaid) {
        this.status = 'paid';
    } else if (new Date() > this.dueDate) {
        this.status = 'overdue';
    } else {
        this.status = 'pending';
    }
    return this;
};

// Static methods
billSchema.statics.getUpcoming = function(userId, days = 30) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    return this.find({
        userId,
        dueDate: { $gte: new Date(), $lte: endDate },
        status: { $in: ['pending'] }
    }).sort({ dueDate: 1 });
};

billSchema.statics.getOverdue = function(userId) {
    return this.find({
        userId,
        dueDate: { $lt: new Date() },
        status: { $in: ['pending', 'overdue'] }
    }).sort({ dueDate: 1 });
};

billSchema.statics.getTotalByCategory = function(userId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                dueDate: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$category',
                totalAmount: { $sum: '$amount' },
                billCount: { $sum: 1 }
            }
        },
        {
            $sort: { totalAmount: -1 }
        }
    ]);
};

// Pre-save middleware
billSchema.pre('save', function(next) {
    // Auto update status
    this.updateStatus();
    
    // Set next due date for recurring bills if paid
    if (this.isModified('isPaid') && this.isPaid && this.recurring !== 'none') {
        const nextDue = new Date(this.dueDate);
        
        switch (this.recurring) {
            case 'daily':
                nextDue.setDate(nextDue.getDate() + 1);
                break;
            case 'weekly':
                nextDue.setDate(nextDue.getDate() + 7);
                break;
            case 'monthly':
                nextDue.setMonth(nextDue.getMonth() + 1);
                break;
            case 'yearly':
                nextDue.setFullYear(nextDue.getFullYear() + 1);
                break;
        }
        
        // Create new bill for next period
        const nextBill = new this.constructor({
            userId: this.userId,
            title: this.title,
            amount: this.amount,
            currency: this.currency,
            toWhom: this.toWhom,
            recurring: this.recurring,
            dueDate: nextDue,
            category: this.category,
            notes: this.notes,
            reminders: this.reminders
        });
        
        // Save next bill (don't wait for it)
        nextBill.save().catch(err => console.error('Error creating recurring bill:', err));
    }
    
    next();
});

export default mongoose.model("Bill", billSchema);