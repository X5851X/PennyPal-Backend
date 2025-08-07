import Bill from "../models/bills.js";

//controllers for bills and dues
export const addBill = async(req, res) => {
    try {
        // Create bill with proper data structure
        const billData = {
            userId: req.body.userId,
            title: req.body.title,
            amount: req.body.amount,
            currency: req.body.currency || 'IDR',
            toWhom: req.body.toWhom,
            recurring: req.body.recurring || 'none',
            dueDate: new Date(req.body.dueDate),
            category: req.body.category || 'other',
            notes: req.body.notes || '',
            reminders: req.body.reminders || [7, 3, 1]
        };

        const bill = new Bill(billData);
        await bill.save();
        
        res.status(200).json({
            success: true,
            message: 'Bill added successfully',
            bill
        });

    } catch(err) {
        console.error('Error adding bill:', err);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message
        });
    }
};

export const getBills = async(req, res) => {
    const userId = req.params.userId;
    
    try {
        const bills = await Bill.find({ userId: userId })
            .sort({ dueDate: 1 }) // Sort by due date ascending
            .exec();
            
        res.status(200).json({
            success: true,
            bills
        });
    } catch(err) {
        console.error('Error fetching bills:', err);
        res.status(500).json({
            success: false,
            message: "No bills found",
            error: err.message
        });
    }
};

export const editBill = async(req, res) => {
    try {
        const billId = req.params.id;
        const updateFields = {};

        // Only update fields that are provided
        if (req.body.title) updateFields.title = req.body.title;
        if (req.body.dueDate) updateFields.dueDate = new Date(req.body.dueDate);
        if (req.body.amount) updateFields.amount = req.body.amount;
        if (req.body.toWhom) updateFields.toWhom = req.body.toWhom;
        if (req.body.currency) updateFields.currency = req.body.currency;
        if (req.body.category) updateFields.category = req.body.category;
        if (req.body.notes !== undefined) updateFields.notes = req.body.notes;
        if (req.body.recurring) updateFields.recurring = req.body.recurring;

        const bill = await Bill.findByIdAndUpdate(
            billId,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Bill updated successfully",
            bill
        });
    } catch(err) {
        console.error('Error editing bill:', err);
        res.status(500).json({
            success: false,
            message: "Cannot edit the bill",
            error: err.message
        });
    }
};

export const deleteBill = async(req, res) => {
    try {
        const bill = await Bill.findByIdAndDelete(req.params.id);
        
        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Bill deleted successfully"
        });
    } catch(err) {
        console.error('Error deleting bill:', err);
        res.status(500).json({
            success: false,
            message: "Cannot delete the bill",
            error: err.message
        });
    }
};

// Additional useful endpoints based on the model's static methods
export const getUpcomingBills = async(req, res) => {
    try {
        const userId = req.params.userId;
        const days = req.query.days || 30;
        
        const upcomingBills = await Bill.getUpcoming(userId, parseInt(days));
        
        res.status(200).json({
            success: true,
            bills: upcomingBills
        });
    } catch(err) {
        console.error('Error fetching upcoming bills:', err);
        res.status(500).json({
            success: false,
            message: "Error fetching upcoming bills",
            error: err.message
        });
    }
};

export const getOverdueBills = async(req, res) => {
    try {
        const userId = req.params.userId;
        
        const overdueBills = await Bill.getOverdue(userId);
        
        res.status(200).json({
            success: true,
            bills: overdueBills
        });
    } catch(err) {
        console.error('Error fetching overdue bills:', err);
        res.status(500).json({
            success: false,
            message: "Error fetching overdue bills",
            error: err.message
        });
    }
};

export const markBillAsPaid = async(req, res) => {
    try {
        const billId = req.params.id;
        const paidAmount = req.body.paidAmount || null;
        
        const bill = await Bill.findById(billId);
        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found"
            });
        }

        await bill.markAsPaid(paidAmount);
        
        res.status(200).json({
            success: true,
            message: "Bill marked as paid",
            bill
        });
    } catch(err) {
        console.error('Error marking bill as paid:', err);
        res.status(500).json({
            success: false,
            message: "Error marking bill as paid",
            error: err.message
        });
    }
};

export const getBillsByCategory = async(req, res) => {
    try {
        const userId = req.params.userId;
        const startDate = new Date(req.query.startDate || new Date().setMonth(new Date().getMonth() - 1));
        const endDate = new Date(req.query.endDate || new Date());
        
        const categoryTotals = await Bill.getTotalByCategory(userId, startDate, endDate);
        
        res.status(200).json({
            success: true,
            categoryTotals
        });
    } catch(err) {
        console.error('Error fetching bills by category:', err);
        res.status(500).json({
            success: false,
            message: "Error fetching bills by category",
            error: err.message
        });
    }
};