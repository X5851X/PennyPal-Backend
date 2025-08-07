import express from "express";
import { 
    createGroup,
    joinGroup,
    getGroups,
    getGroup,
    getMembers,
    addExpense,
    getDebts,
    settleDebt,
    deleteGroup,
    addComment,
    getAllComments,
    addFriendsToGroup,
    generateInviteCode,
    joinByInviteCode,
    removeMember,
    calculateGroupDebts
} from "../controllers/groups.js";
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// POST: Create new group
router.post("/createGroup", async (req, res) => {
    try {
        await createGroup(req, res);
    } catch (error) {
        console.error('❌ Error in createGroup route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create group',
            error: error.message
        });
    }
});

// POST: Join existing group
router.post("/joinGroup", async (req, res) => {
    try {
        await joinGroup(req, res);
    } catch (error) {
        console.error('❌ Error in joinGroup route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to join group',
            error: error.message
        });
    }
});

// POST: Join group by invite code
router.post("/joinInvite", async (req, res) => {
    try {
        await joinByInviteCode(req, res);
    } catch (error) {
        console.error('❌ Error in joinInvite route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to join group via invite',
            error: error.message
        });
    }
});

// GET: Get user's groups
router.get("/getGroups/:userId", async (req, res) => {
    try {
        const requestUserId = req.params.userId;
        const authUserId = req.user.id;

        // Ensure user can only access their own groups
        if (requestUserId !== authUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You can only view your own groups'
            });
        }

        await getGroups(req, res);
    } catch (error) {
        console.error('❌ Error in getGroups route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch groups',
            error: error.message
        });
    }
});

// GET: Get specific group details
router.get("/getGroup/:id", async (req, res) => {
    try {
        await getGroup(req, res);
    } catch (error) {
        console.error('❌ Error in getGroup route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch group',
            error: error.message
        });
    }
});

// GET: Get group members
router.get("/getMembers/:id", async (req, res) => {
    try {
        await getMembers(req, res);
    } catch (error) {
        console.error('❌ Error in getMembers route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch group members',
            error: error.message
        });
    }
});

// POST: Add expense to group
router.post("/addExpense/:id", async (req, res) => {
    try {
        await addExpense(req, res);
    } catch (error) {
        console.error('❌ Error in addExpense route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add expense',
            error: error.message
        });
    }
});

// GET: Get group debts
router.get("/getDebts/:groupId", async (req, res) => {
    try {
        await getDebts(req, res);
    } catch (error) {
        console.error('❌ Error in getDebts route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch debts',
            error: error.message
        });
    }
});

// POST: Settle debt
router.post("/settleDebt/:id", async (req, res) => {
    try {
        await settleDebt(req, res);
    } catch (error) {
        console.error('❌ Error in settleDebt route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to settle debt',
            error: error.message
        });
    }
});

// POST: Calculate group debts
router.post("/calculateDebts/:id", async (req, res) => {
    try {
        await calculateGroupDebts(req, res);
    } catch (error) {
        console.error('❌ Error in calculateDebts route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate debts',
            error: error.message
        });
    }
});

// PUT: Add friends to group
router.put("/addFriendsGroup/:id", async (req, res) => {
    try {
        await addFriendsToGroup(req, res);
    } catch (error) {
        console.error('❌ Error in addFriendsGroup route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add friends to group',
            error: error.message
        });
    }
});

// DELETE: Remove member from group
router.delete("/removeMember/:id", async (req, res) => {
    try {
        await removeMember(req, res);
    } catch (error) {
        console.error('❌ Error in removeMember route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove member',
            error: error.message
        });
    }
});

// DELETE: Delete group
router.delete("/deleteGroup/:id", async (req, res) => {
    try {
        await deleteGroup(req, res);
    } catch (error) {
        console.error('❌ Error in deleteGroup route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete group',
            error: error.message
        });
    }
});

// POST: Add comment to group
router.post("/addComment", async (req, res) => {
    try {
        await addComment(req, res);
    } catch (error) {
        console.error('❌ Error in addComment route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add comment',
            error: error.message
        });
    }
});

// GET: Get group comments
router.get("/getComments/:id", async (req, res) => {
    try {
        await getAllComments(req, res);
    } catch (error) {
        console.error('❌ Error in getComments route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch comments',
            error: error.message
        });
    }
});

// POST: Generate invite code
router.post("/generateInvite/:id", async (req, res) => {
    try {
        await generateInviteCode(req, res);
    } catch (error) {
        console.error('❌ Error in generateInvite route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate invite code',
            error: error.message
        });
    }
});

export default router;