import Saving from "../models/savings.js";

export const addSaving = async(req, res) => {
    try {
        const savingData = {
            userId: req.body.userId,
            targetAmt: req.body.targetAmt,
            currAmt: req.body.currAmt || 0,
            currency: req.body.currency || 'IDR',
            title: req.body.title,
            description: req.body.description || '',
            targetDate: req.body.targetDate ? new Date(req.body.targetDate) : null,
            category: req.body.category || 'other'
        };

        const saving = new Saving(savingData);
        await saving.save();
        
        res.status(200).json({
            success: true,
            message: 'Saving goal added successfully',
            saving
        });

    } catch(err) {
        console.error('Error adding saving:', err);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message
        });
    }
};

export const getSavings = async(req, res) => {
    const userId = req.params.userId;
    
    try {
        const savings = await Saving.find({ userId: userId })
            .sort({ createdAt: -1 })
            .exec();
            
        res.status(200).json({
            success: true,
            savings
        });
    } catch(err) {
        console.error('Error fetching savings:', err);
        res.status(500).json({
            success: false,
            message: "No savings found",
            error: err.message
        });
    }
};

export const editSaving = async(req, res) => {
    try {
        const savingId = req.params.id;
        const updateFields = {};

        // Only update fields that are provided
        if (req.body.targetAmt) updateFields.targetAmt = req.body.targetAmt;
        if (req.body.currAmt !== undefined) updateFields.currAmt = req.body.currAmt;
        if (req.body.currency) updateFields.currency = req.body.currency;
        if (req.body.title) updateFields.title = req.body.title;
        if (req.body.description !== undefined) updateFields.description = req.body.description;
        if (req.body.targetDate) updateFields.targetDate = new Date(req.body.targetDate);
        if (req.body.category) updateFields.category = req.body.category;
        if (req.body.status) updateFields.status = req.body.status;

        const saving = await Saving.findByIdAndUpdate(
            savingId,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!saving) {
            return res.status(404).json({
                success: false,
                message: "Saving goal not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Saving goal updated successfully",
            saving
        });
    } catch(err) {
        console.error('Error editing saving:', err);
        res.status(500).json({
            success: false,
            message: "Cannot edit the saving goal",
            error: err.message
        });
    }
};

export const deleteSaving = async(req, res) => {
    try {
        const saving = await Saving.findByIdAndDelete(req.params.id);
        
        if (!saving) {
            return res.status(404).json({
                success: false,
                message: "Saving goal not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Saving goal deleted successfully"
        });
    } catch(err) {
        console.error('Error deleting saving:', err);
        res.status(500).json({
            success: false,
            message: "Cannot delete the saving goal",
            error: err.message
        });
    }
};

// Additional endpoints based on model methods
export const addAmountToSaving = async(req, res) => {
    try {
        const savingId = req.params.id;
        const amount = req.body.amount;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be positive"
            });
        }

        const saving = await Saving.findById(savingId);
        if (!saving) {
            return res.status(404).json({
                success: false,
                message: "Saving goal not found"
            });
        }

        await saving.addAmount(amount);
        
        res.status(200).json({
            success: true,
            message: "Amount added to saving goal",
            saving
        });
    } catch(err) {
        console.error('Error adding amount to saving:', err);
        res.status(500).json({
            success: false,
            message: err.message || "Error adding amount to saving",
            error: err.message
        });
    }
};

export const withdrawFromSaving = async(req, res) => {
    try {
        const savingId = req.params.id;
        const amount = req.body.amount;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be positive"
            });
        }

        const saving = await Saving.findById(savingId);
        if (!saving) {
            return res.status(404).json({
                success: false,
                message: "Saving goal not found"
            });
        }

        await saving.withdrawAmount(amount);
        
        res.status(200).json({
            success: true,
            message: "Amount withdrawn from saving goal",
            saving
        });
    } catch(err) {
        console.error('Error withdrawing from saving:', err);
        res.status(500).json({
            success: false,
            message: err.message || "Error withdrawing from saving",
            error: err.message
        });
    }
};

export const getActiveSavings = async(req, res) => {
    try {
        const userId = req.params.userId;
        
        const activeSavings = await Saving.getActiveGoals(userId);
        
        res.status(200).json({
            success: true,
            savings: activeSavings
        });
    } catch(err) {
        console.error('Error fetching active savings:', err);
        res.status(500).json({
            success: false,
            message: "Error fetching active savings",
            error: err.message
        });
    }
};

export const getCompletedSavings = async(req, res) => {
    try {
        const userId = req.params.userId;
        
        const completedSavings = await Saving.getCompletedGoals(userId);
        
        res.status(200).json({
            success: true,
            savings: completedSavings
        });
    } catch(err) {
        console.error('Error fetching completed savings:', err);
        res.status(500).json({
            success: false,
            message: "Error fetching completed savings",
            error: err.message
        });
    }
};

export const getTotalSavingsStats = async(req, res) => {
    try {
        const userId = req.params.userId;
        
        const totalStats = await Saving.getTotalSavings(userId);
        
        res.status(200).json({
            success: true,
            stats: totalStats
        });
    } catch(err) {
        console.error('Error fetching total savings stats:', err);
        res.status(500).json({
            success: false,
            message: "Error fetching savings statistics",
            error: err.message
        });
    }
};

export const getSavingsByCategory = async(req, res) => {
    try {
        const userId = req.params.userId;
        
        const categoryStats = await Saving.getSavingsByCategory(userId);
        
        res.status(200).json({
            success: true,
            categoryStats
        });
    } catch(err) {
        console.error('Error fetching savings by category:', err);
        res.status(500).json({
            success: false,
            message: "Error fetching savings by category",
            error: err.message
        });
    }
};

export const updateSavingTarget = async(req, res) => {
    try {
        const savingId = req.params.id;
        const { newTargetAmount, newTargetDate } = req.body;

        if (!newTargetAmount || newTargetAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Target amount must be positive"
            });
        }

        const saving = await Saving.findById(savingId);
        if (!saving) {
            return res.status(404).json({
                success: false,
                message: "Saving goal not found"
            });
        }

        const parsedTargetDate = newTargetDate ? new Date(newTargetDate) : null;
        await saving.updateTarget(newTargetAmount, parsedTargetDate);
        
        res.status(200).json({
            success: true,
            message: "Saving target updated successfully",
            saving
        });
    } catch(err) {
        console.error('Error updating saving target:', err);
        res.status(500).json({
            success: false,
            message: err.message || "Error updating saving target",
            error: err.message
        });
    }
};