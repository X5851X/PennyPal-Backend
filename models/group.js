import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    username: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    edited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date
    }
}, { _id: true });

const billSplitItemSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        enum: ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'KRW'],
        required: true
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    paidByUsername: {
        type: String,
        required: true
    },
    splitBetween: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        username: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    date: {
        type: Date,
        default: Date.now
    },
    category: {
        type: String,
        enum: ['food', 'transport', 'accommodation', 'entertainment', 'shopping', 'utilities', 'other'],
        default: 'other'
    },
    receiptUrl: {
        type: String
    },
    notes: {
        type: String,
        maxlength: 300
    }
}, { _id: true });

const debtSchema = new mongoose.Schema({
    from: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        username: {
            type: String,
            required: true
        }
    },
    to: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        username: {
            type: String,
            required: true
        }
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        enum: ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'KRW'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'settled', 'disputed'],
        default: 'pending'
    },
    settledAt: {
        type: Date
    },
    settledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { _id: true });

const groupSchema = new mongoose.Schema({
    groupCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        minlength: 6,
        maxlength: 8
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true // group creator
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
        maxlength: 300
    },
    members: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        username: {
            type: String,
            required: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        role: {
            type: String,
            enum: ['admin', 'member'],
            default: 'member'
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    comments: [commentSchema],
    billSplit: [billSplitItemSchema],
    simplifyDebt: [debtSchema],
    
    // Group settings
    defaultCurrency: {
        type: String,
        enum: ['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'KRW'],
        default: 'IDR'
    },
    allowMultipleCurrencies: {
        type: Boolean,
        default: true
    },
    autoSimplifyDebts: {
        type: Boolean,
        default: true
    },
    requireReceiptForExpenses: {
        type: Boolean,
        default: false
    },
    
    // Group status
    isActive: {
        type: Boolean,
        default: true
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date
    },
    
    // Invite settings
    inviteCode: {
        type: String,
        unique: true,
        sparse: true
    },
    inviteCodeExpiresAt: {
        type: Date
    },
    maxMembers: {
        type: Number,
        default: 50,
        min: 2,
        max: 100
    }
}, { timestamps: true });

// Indexes for better query performance
groupSchema.index({ groupCode: 1 });
groupSchema.index({ userId: 1 });
groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ isActive: 1, isArchived: 1 });
groupSchema.index({ inviteCode: 1 });

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
    return this.members.filter(member => member.isActive).length;
});

// Virtual for total expenses by currency
groupSchema.virtual('totalExpensesByCurrency').get(function() {
    const totals = {};
    this.billSplit.forEach(bill => {
        if (!totals[bill.currency]) {
            totals[bill.currency] = 0;
        }
        totals[bill.currency] += bill.amount;
    });
    return totals;
});

// Virtual for outstanding debts by currency
groupSchema.virtual('outstandingDebtsByCurrency').get(function() {
    const totals = {};
    this.simplifyDebt.filter(debt => debt.status === 'pending').forEach(debt => {
        if (!totals[debt.currency]) {
            totals[debt.currency] = 0;
        }
        totals[debt.currency] += debt.amount;
    });
    return totals;
});

// Instance methods
groupSchema.methods.addMember = function(userId, username, role = 'member') {
    // Check if user is already a member
    const existingMember = this.members.find(m => m.userId.toString() === userId.toString());
    if (existingMember) {
        if (!existingMember.isActive) {
            existingMember.isActive = true;
            existingMember.joinedAt = new Date();
            return this.save();
        }
        throw new Error('User is already a member');
    }
    
    // Check member limit
    if (this.memberCount >= this.maxMembers) {
        throw new Error('Group has reached maximum member limit');
    }
    
    this.members.push({
        userId,
        username,
        role,
        joinedAt: new Date(),
        isActive: true
    });
    
    return this.save();
};

groupSchema.methods.removeMember = function(userId) {
    const member = this.members.find(m => m.userId.toString() === userId.toString());
    if (!member) {
        throw new Error('User is not a member of this group');
    }
    
    // Check if user has outstanding debts
    const hasDebts = this.simplifyDebt.some(debt => 
        (debt.from.userId.toString() === userId.toString() || 
         debt.to.userId.toString() === userId.toString()) && 
        debt.status === 'pending'
    );
    
    if (hasDebts) {
        throw new Error('Cannot remove member with outstanding debts');
    }
    
    member.isActive = false;
    return this.save();
};

groupSchema.methods.addExpense = function(description, amount, currency, paidBy, paidByUsername, splitBetween, category = 'other', receiptUrl = null, notes = null) {
    // Validate currency is allowed
    if (!this.allowMultipleCurrencies && currency !== this.defaultCurrency) {
        throw new Error(`Only ${this.defaultCurrency} is allowed in this group`);
    }
    
    // Validate splitBetween users are group members
    const memberIds = this.members.filter(m => m.isActive).map(m => m.userId.toString());
    const invalidUsers = splitBetween.filter(split => !memberIds.includes(split.userId.toString()));
    if (invalidUsers.length > 0) {
        throw new Error('Some users in split are not group members');
    }
    
    // Validate split amounts add up to total
    const totalSplit = splitBetween.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(totalSplit - amount) > 0.01) { // Allow small floating point differences
        throw new Error('Split amounts must add up to total amount');
    }
    
    const expense = {
        description,
        amount,
        currency,
        paidBy,
        paidByUsername,
        splitBetween,
        category,
        receiptUrl,
        notes,
        date: new Date()
    };
    
    this.billSplit.push(expense);
    
    // Auto-calculate debts if enabled
    if (this.autoSimplifyDebts) {
        this.calculateDebts();
    }
    
    return this.save();
};

groupSchema.methods.calculateDebts = function() {
    // Clear existing debts
    this.simplifyDebt = [];
    
    // Group expenses by currency
    const debtsByCurrency = {};
    
    this.billSplit.forEach(expense => {
        const currency = expense.currency;
        if (!debtsByCurrency[currency]) {
            debtsByCurrency[currency] = {};
        }
        
        // Initialize member balances
        const memberIds = this.members.filter(m => m.isActive).map(m => m.userId.toString());
        memberIds.forEach(memberId => {
            if (!debtsByCurrency[currency][memberId]) {
                debtsByCurrency[currency][memberId] = 0;
            }
        });
        
        // Add what the payer paid
        debtsByCurrency[currency][expense.paidBy.toString()] += expense.amount;
        
        // Subtract what each person owes
        expense.splitBetween.forEach(split => {
            debtsByCurrency[currency][split.userId.toString()] -= split.amount;
        });
    });
    
    // Convert balances to debts
    Object.keys(debtsByCurrency).forEach(currency => {
        const balances = debtsByCurrency[currency];
        const memberIds = Object.keys(balances);
        
        // Separate creditors (positive balance) and debtors (negative balance)
        const creditors = memberIds.filter(id => balances[id] > 0.01).map(id => ({
            userId: id,
            amount: balances[id],
            username: this.members.find(m => m.userId.toString() === id).username
        }));
        
        const debtors = memberIds.filter(id => balances[id] < -0.01).map(id => ({
            userId: id,
            amount: Math.abs(balances[id]),
            username: this.members.find(m => m.userId.toString() === id).username
        }));
        
        // Simplify debts using greedy algorithm
        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);
        
        let i = 0, j = 0;
        while (i < creditors.length && j < debtors.length) {
            const creditor = creditors[i];
            const debtor = debtors[j];
            
            const settleAmount = Math.min(creditor.amount, debtor.amount);
            
            if (settleAmount > 0.01) { // Only create debt if significant
                this.simplifyDebt.push({
                    from: {
                        userId: new mongoose.Types.ObjectId(debtor.userId),
                        username: debtor.username
                    },
                    to: {
                        userId: new mongoose.Types.ObjectId(creditor.userId),
                        username: creditor.username
                    },
                    amount: Math.round(settleAmount * 100) / 100, // Round to 2 decimal places
                    currency,
                    status: 'pending'
                });
            }
            
            creditor.amount -= settleAmount;
            debtor.amount -= settleAmount;
            
            if (creditor.amount < 0.01) i++;
            if (debtor.amount < 0.01) j++;
        }
    });
    
    return this;
};

groupSchema.methods.settleDebt = function(debtId, settledBy) {
    const debt = this.simplifyDebt.id(debtId);
    if (!debt) {
        throw new Error('Debt not found');
    }
    
    if (debt.status !== 'pending') {
        throw new Error('Debt is already settled');
    }
    
    debt.status = 'settled';
    debt.settledAt = new Date();
    debt.settledBy = settledBy;
    
    return this.save();
};

groupSchema.methods.addComment = function(userId, username, message) {
    this.comments.push({
        userId,
        username,
        message,
        timestamp: new Date()
    });
    
    return this.save();
};

groupSchema.methods.generateInviteCode = function(expirationHours = 24) {
    this.inviteCode = Math.random().toString(36).substring(2, 15).toUpperCase();
    this.inviteCodeExpiresAt = new Date(Date.now() + (expirationHours * 60 * 60 * 1000));
    return this.save();
};

// Static methods
groupSchema.statics.findByGroupCode = function(groupCode) {
    return this.findOne({ 
        groupCode: groupCode.toUpperCase(),
        isActive: true,
        isArchived: false
    });
};

groupSchema.statics.findByInviteCode = function(inviteCode) {
    return this.findOne({
        inviteCode: inviteCode.toUpperCase(),
        inviteCodeExpiresAt: { $gt: new Date() },
        isActive: true,
        isArchived: false
    });
};

groupSchema.statics.getUserGroups = function(userId) {
    return this.find({
        'members.userId': userId,
        'members.isActive': true,
        isActive: true,
        isArchived: false
    }).sort({ updatedAt: -1 });
};

groupSchema.statics.generateUniqueGroupCode = async function() {
    let groupCode;
    let exists = true;
    
    while (exists) {
        groupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const existing = await this.findOne({ groupCode });
        exists = !!existing;
    }
    
    return groupCode;
};

// Pre-save middleware
groupSchema.pre('save', function(next) {
    // Ensure creator is in members list as admin
    if (this.isNew) {
        const creatorInMembers = this.members.find(m => m.userId.toString() === this.userId.toString());
        if (!creatorInMembers) {
            // We'll need the creator's username, this should be handled in the application layer
            console.warn('Creator should be added to members list with username');
        }
    }
    
    // Sort comments by timestamp
    this.comments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Sort bill splits by date
    this.billSplit.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    next();
});

export default mongoose.model("Group", groupSchema);