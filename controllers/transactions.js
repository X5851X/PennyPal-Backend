import Transaction from "../models/transaction.js";
import mongoose from "mongoose";

export const ErrorMessage = (status, message) => {
    const error = new Error();
    error.status = status;
    error.message = message;
    return error;
};

export const addTransaction = async(req, res) => {
    try {
        const transactionData = {
            userId: req.body.userId,
            type: req.body.type,
            category: req.body.category,
            amount: req.body.amount,
            currency: req.body.currency || 'IDR',
            timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
            title: req.body.title,
            description: req.body.description || '',
            source: req.body.source,
            tags: req.body.tags || [],
            receiptId: req.body.receiptId || null,
            billId: req.body.billId || null,
            recurring: req.body.recurring || 'none',
            status: req.body.status || 'completed'
        };

        const transaction = new Transaction(transactionData);
        await transaction.save();
        
        res.status(200).json({
            success: true,
            message: 'Transaction added successfully',
            transaction
        });

    } catch(err) {
        console.error('Error adding transaction:', err);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message
        });
    }
};

export const getTransactions = async(req, res) => {
    const userId = req.params.userId;
    
    try {
        const transactions = await Transaction.find({ userId: userId })
            .sort({ timestamp: -1 })
            .populate('receiptId', 'storeName total')
            .populate('billId', 'title amount')
            .exec();
            
        res.status(200).json({
            success: true,
            transactions
        });
    } catch(err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({
            success: false,
            message: "No transactions found",
            error: err.message
        });
    }
};

export const editTransaction = async(req, res) => {
    try {
        const transactionId = req.params.id;
        const updateFields = {};

        // Only update fields that are provided
        if (req.body.type) updateFields.type = req.body.type;
        if (req.body.category) updateFields.category = req.body.category;
        if (req.body.amount) updateFields.amount = req.body.amount;
        if (req.body.currency) updateFields.currency = req.body.currency;
        if (req.body.timestamp) updateFields.timestamp = new Date(req.body.timestamp);
        if (req.body.title) updateFields.title = req.body.title;
        if (req.body.description !== undefined) updateFields.description = req.body.description;
        if (req.body.source) updateFields.source = req.body.source;
        if (req.body.tags) updateFields.tags = req.body.tags;
        if (req.body.recurring) updateFields.recurring = req.body.recurring;
        if (req.body.status) updateFields.status = req.body.status;

        const transaction = await Transaction.findByIdAndUpdate(
            transactionId,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Transaction updated successfully",
            transaction
        });
    } catch(err) {
        console.error('Error editing transaction:', err);
        res.status(500).json({
            success: false,
            message: "Unable to edit transaction",
            error: err.message
        });
    }
};

export const deleteTransaction = async(req, res) => {
    try {
        const transaction = await Transaction.findByIdAndDelete(req.params.id);
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Transaction deleted successfully"
        });
    } catch(err) {
        console.error('Error deleting transaction:', err);
        res.status(500).json({
            success: false,
            message: "Unable to delete transaction",
            error: err.message
        });
    }
};

export const getTransactionsByFilter = async(req, res) => {
    try {
        const { userId, category, startDate, endDate, type, currency } = req.body;
        
        let filter = { userId: new mongoose.Types.ObjectId(userId) };
        
        if (category && category !== '') {
            filter.category = category;
        }
        
        if (type && type !== '') {
            filter.type = type;
        }
        
        if (currency && currency !== '') {
            filter.currency = currency;
        }
        
        if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const transactions = await Transaction.find(filter)
            .sort({ timestamp: -1 })
            .populate('receiptId', 'storeName total')
            .populate('billId', 'title amount')
            .exec();
        
        res.status(200).json({
            success: true,
            transactions
        });
    } catch (err) {
        console.error('Error filtering transactions:', err);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: err.message
        });
    }
};

export const getTotalStats = async(req, res) => {
    try {
        const userId = req.params.userId;
        
        const stats = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        let totalIncome = 0;
        let totalExpense = 0;
        let incomeCount = 0;
        let expenseCount = 0;

        stats.forEach(stat => {
            if (stat._id === 'income') {
                totalIncome = stat.total;
                incomeCount = stat.count;
            } else if (stat._id === 'expense') {
                totalExpense = stat.total;
                expenseCount = stat.count;
            }
        });

        const balance = totalIncome - totalExpense;

        res.status(200).json({
            success: true,
            stats: {
                totalIncome: Math.floor(totalIncome),
                totalExpense: Math.floor(totalExpense),
                balance: Math.floor(balance),
                incomeCount,
                expenseCount
            }
        });
    } catch(err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({
            success: false,
            message: "No stats found",
            error: err.message
        });
    }
};

export const getWeeklyTransaction = async (req, res) => {
    try {
        const userId = req.params.userId;
        const currentDate = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(currentDate.getDate() - 7);

        const weeklyData = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    timestamp: { $gte: sevenDaysAgo, $lte: currentDate },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
                    },
                    totalIncome: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0]
                        }
                    },
                    totalExpense: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0]
                        }
                    }
                }
            },
            {
                $project: {
                    date: '$_id',
                    totalIncome: 1,
                    totalExpense: 1,
                    _id: 0
                }
            },
            {
                $sort: { date: 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            weeklyData
        });
    } catch (err) {
        console.error('Error fetching weekly data:', err);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: err.message
        });
    }
};

export const getMonthlyTransaction = async (req, res) => {
    try {
        const userId = req.params.userId;
        const currentDate = new Date();
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

        const monthlyData = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    timestamp: { $gte: firstDayOfMonth, $lte: currentDate },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m', date: '$timestamp' }
                    },
                    totalIncome: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0]
                        }
                    },
                    totalExpense: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0]
                        }
                    }
                }
            },
            {
                $project: {
                    month: '$_id',
                    totalIncome: 1,
                    totalExpense: 1,
                    _id: 0
                }
            },
            {
                $sort: { month: 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            monthlyData
        });
    } catch (err) {
        console.error('Error fetching monthly data:', err);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: err.message
        });
    }
};

export const getYearlyTransaction = async (req, res) => {
    try {
        const userId = req.params.userId;
        const currentDate = new Date();
        const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1);

        const yearlyData = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    timestamp: { $gte: firstDayOfYear, $lte: currentDate },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y', date: '$timestamp' }
                    },
                    totalIncome: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0]
                        }
                    },
                    totalExpense: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0]
                        }
                    }
                }
            },
            {
                $project: {
                    year: '$_id',
                    totalIncome: 1,
                    totalExpense: 1,
                    _id: 0
                }
            },
            {
                $sort: { year: 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            yearlyData
        });
    } catch (err) {
        console.error('Error fetching yearly data:', err);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: err.message
        });
    }
};

export const getCategoryWiseTransaction = async(req, res) => {
    try {
        const userId = req.params.userId;
        
        const categoryData = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: { $toLower: "$category" },
                    totalIncome: {
                        $sum: {
                            $cond: [{ $eq: ["$type", "income"] }, "$amount", 0]
                        }
                    },
                    totalExpense: {
                        $sum: {
                            $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0]
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { totalExpense: -1 }
            }
        ]);
        
        res.status(200).json({
            success: true,
            categoryData
        });
    } catch(err) {
        console.error('Error fetching category data:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching category data',
            error: err.message
        });
    }
};

// Additional useful endpoints based on model methods
export const getTransactionsByDateRange = async(req, res) => {
    try {
        const userId = req.params.userId;
        const { startDate, endDate, type } = req.query;
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const transactions = await Transaction.getByDateRange(userId, start, end, type || null);
        
        res.status(200).json({
            success: true,
            transactions
        });
    } catch(err) {
        console.error('Error fetching transactions by date range:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching transactions by date range',
            error: err.message
        });
    }
};

export const getTransactionsByCategory = async(req, res) => {
    try {
        const userId = req.params.userId;
        const { category, type } = req.query;
        
        const transactions = await Transaction.getByCategory(userId, category, type || null);
        
        res.status(200).json({
            success: true,
            transactions
        });
    } catch(err) {
        console.error('Error fetching transactions by category:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching transactions by category',
            error: err.message
        });
    }
};

export const getSpendingByCategory = async(req, res) => {
    try {
        const userId = req.params.userId;
        const startDate = new Date(req.query.startDate || new Date().setMonth(new Date().getMonth() - 1));
        const endDate = new Date(req.query.endDate || new Date());
        
        const spendingData = await Transaction.getSpendingByCategory(userId, startDate, endDate);
        
        res.status(200).json({
            success: true,
            spendingData
        });
    } catch(err) {
        console.error('Error fetching spending by category:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching spending by category',
            error: err.message
        });
    }
};

export const getIncomeBySource = async(req, res) => {
    try {
        const userId = req.params.userId;
        const startDate = new Date(req.query.startDate || new Date().setMonth(new Date().getMonth() - 1));
        const endDate = new Date(req.query.endDate || new Date());
        
        const incomeData = await Transaction.getIncomeBySource(userId, startDate, endDate);
        
        res.status(200).json({
            success: true,
            incomeData
        });
    } catch(err) {
        console.error('Error fetching income by source:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching income by source',
            error: err.message
        });
    }
};

export const getMonthlySummary = async(req, res) => {
    try {
        const userId = req.params.userId;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        
        const summary = await Transaction.getMonthlySummary(userId, year, month);
        
        res.status(200).json({
            success: true,
            summary
        });
    } catch(err) {
        console.error('Error fetching monthly summary:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching monthly summary',
            error: err.message
        });
    }
};

export const getRecurringTransactions = async(req, res) => {
    try {
        const userId = req.params.userId;
        const recurringType = req.query.type || null;
        
        const recurringTransactions = await Transaction.getRecurringTransactions(userId, recurringType);
        
        res.status(200).json({
            success: true,
            transactions: recurringTransactions
        });
    } catch(err) {
        console.error('Error fetching recurring transactions:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching recurring transactions',
            error: err.message
        });
    }
};

export const addTagToTransaction = async(req, res) => {
    try {
        const transactionId = req.params.id;
        const { tag } = req.body;
        
        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }
        
        await transaction.addTag(tag);
        
        res.status(200).json({
            success: true,
            message: "Tag added successfully",
            transaction
        });
    } catch(err) {
        console.error('Error adding tag:', err);
        res.status(500).json({
            success: false,
            message: 'Error adding tag',
            error: err.message
        });
    }
};

export const removeTagFromTransaction = async(req, res) => {
    try {
        const transactionId = req.params.id;
        const { tag } = req.body;
        
        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }
        
        await transaction.removeTag(tag);
        
        res.status(200).json({
            success: true,
            message: "Tag removed successfully",
            transaction
        });
    } catch(err) {
        console.error('Error removing tag:', err);
        res.status(500).json({
            success: false,
            message: 'Error removing tag',
            error: err.message
        });
    }
};