
import User from "../models/user.js";
import Group from "../models/group.js";

export const createGroup = async(req, res) => {
    try {
        const { userId, title, description, defaultCurrency, maxMembers } = req.body;
        
        // Get user information
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate unique group code
        const groupCode = await Group.generateUniqueGroupCode();
        
        const groupData = {
            groupCode,
            userId,
            title,
            description: description || '',
            defaultCurrency: defaultCurrency || 'IDR',
            maxMembers: maxMembers || 50,
            members: [{
                userId,
                username: user.username,
                role: 'admin',
                isActive: true
            }]
        };

        const newGroup = new Group(groupData);
        await newGroup.save();

        // Update user's groups array
        await User.findByIdAndUpdate(
            userId,
            { $push: { groups: newGroup._id.toString() } },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: 'Group created successfully',
            group: newGroup
        });
    } catch (err) {
        console.error('Error creating group:', err);
        res.status(500).json({
            success: false,
            message: 'Error creating group',
            error: err.message
        });
    }
};

export const joinGroup = async(req, res) => {
    try {
        const { userId, groupCode } = req.body;
        
        // Get user information
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find group by code
        const group = await Group.findByGroupCode(groupCode);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Add member to group using model method
        await group.addMember(userId, user.username);

        // Update user's groups array
        await User.findByIdAndUpdate(
            userId,
            { $push: { groups: group._id.toString() } },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: 'Successfully joined group',
            group
        });
    } catch (err) {
        console.error('Error joining group:', err);
        res.status(500).json({
            success: false,
            message: err.message || 'Error joining group',
            error: err.message
        });
    }
};

export const getGroups = async(req, res) => {
    try {
        const userId = req.params.id;
        
        const userGroups = await Group.getUserGroups(userId);
        
        res.status(200).json({
            success: true,
            groups: userGroups
        });
    } catch(err) {
        console.error('Error fetching groups:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching groups',
            error: err.message
        });
    }
};

export const getGroup = async(req, res) => {
    try {
        const groupId = req.params.id;
        
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
        
        res.status(200).json({
            success: true,
            group
        });
    } catch(err) {
        console.error('Error fetching group:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching group',
            error: err.message
        });
    }
};

export const getMembers = async(req, res) => {
    try {
        const groupId = req.params.id;
        
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Get detailed member information
        const memberDetails = await Promise.all(
            group.members
                .filter(member => member.isActive)
                .map(async member => {
                    const user = await User.findById(member.userId).select('username email image');
                    return {
                        ...member.toObject(),
                        userDetails: user
                    };
                })
        );
        
        res.status(200).json({
            success: true,
            members: memberDetails
        });
    } catch(err) {
        console.error('Error fetching members:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching members',
            error: err.message
        });
    }
};

export const addExpense = async(req, res) => {
    try {
        const groupId = req.params.id;
        const {
            description,
            amount,
            currency,
            paidBy,
            splitBetween,
            category,
            receiptUrl,
            notes
        } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Get payer's username
        const payer = await User.findById(paidBy);
        if (!payer) {
            return res.status(404).json({
                success: false,
                message: 'Payer not found'
            });
        }

        // Add usernames to split array
        const splitWithUsernames = await Promise.all(
            splitBetween.map(async split => {
                const user = await User.findById(split.userId);
                return {
                    userId: split.userId,
                    username: user.username,
                    amount: split.amount
                };
            })
        );

        await group.addExpense(
            description,
            amount,
            currency || group.defaultCurrency,
            paidBy,
            payer.username,
            splitWithUsernames,
            category,
            receiptUrl,
            notes
        );

        res.status(200).json({
            success: true,
            message: 'Expense added successfully',
            group
        });
    } catch(err) {
        console.error('Error adding expense:', err);
        res.status(500).json({
            success: false,
            message: err.message || 'Error adding expense',
            error: err.message
        });
    }
};

export const getDebts = async(req, res) => {
    try {
        const groupId = req.params.groupId;
        
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
        
        res.status(200).json({
            success: true,
            debts: group.simplifyDebt
        });
    } catch (err) {
        console.error('Error fetching debts:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching debts',
            error: err.message
        });
    }
};

export const settleDebt = async(req, res) => {
    try {
        const groupId = req.params.id;
        const { debtId, settledBy } = req.body;
        
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        await group.settleDebt(debtId, settledBy);
        
        res.status(200).json({
            success: true,
            message: 'Debt settled successfully',
            group
        });
    } catch(err) {
        console.error('Error settling debt:', err);
        res.status(500).json({
            success: false,
            message: err.message || 'Error settling debt',
            error: err.message
        });
    }
};

export const deleteGroup = async (req, res) => {
    try {
        const groupId = req.params.id;
        
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        // Check if there are outstanding debts
        const hasOutstandingDebts = group.simplifyDebt.some(debt => debt.status === 'pending');
        if (hasOutstandingDebts) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete group with outstanding debts"
            });
        }

        // Remove group from all members' groups array
        const memberUpdates = group.members.map(member => 
            User.findByIdAndUpdate(
                member.userId,
                { $pull: { groups: groupId } }
            )
        );
        await Promise.all(memberUpdates);

        // Delete the group
        await Group.findByIdAndDelete(groupId);

        res.status(200).json({
            success: true,
            message: "Group deleted successfully"
        });
    } catch (err) {
        console.error('Error deleting group:', err);
        res.status(500).json({
            success: false,
            message: "Unable to delete group",
            error: err.message
        });
    }
};

export const addComment = async (req, res) => {
    try {
        const { groupId, userId, message } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        await group.addComment(userId, user.username, message);

        res.status(200).json({
            success: true,
            message: 'Comment added successfully',
            group
        });
    } catch (err) {
        console.error('Error adding comment:', err);
        res.status(500).json({
            success: false,
            message: 'Error adding comment',
            error: err.message
        });
    }
};

export const getAllComments = async (req, res) => {
    try {
        const groupId = req.params.id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        res.status(200).json({
            success: true,
            comments: group.comments
        });
    } catch (err) {
        console.error('Error fetching comments:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching comments',
            error: err.message
        });
    }
};

export const addFriendsToGroup = async(req, res) => {
    try {
        const groupId = req.params.id;
        const { friendUsernames } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const addedFriends = [];
        const errors = [];

        for (const username of friendUsernames) {
            try {
                const friend = await User.findOne({ username });
                if (!friend) {
                    errors.push(`User ${username} not found`);
                    continue;
                }

                await group.addMember(friend._id, friend.username);
                
                // Update friend's groups array
                await User.findByIdAndUpdate(
                    friend._id,
                    { $push: { groups: groupId } }
                );

                addedFriends.push(username);
            } catch (error) {
                errors.push(`Error adding ${username}: ${error.message}`);
            }
        }

        res.status(200).json({
            success: true,
            message: `Added ${addedFriends.length} friends to group`,
            addedFriends,
            errors: errors.length > 0 ? errors : undefined,
            group
        });
    } catch(err) {
        console.error('Error adding friends to group:', err);
        res.status(500).json({
            success: false,
            message: 'Error adding friends to group',
            error: err.message
        });
    }
};

export const generateInviteCode = async(req, res) => {
    try {
        const groupId = req.params.id;
        const { expirationHours } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        await group.generateInviteCode(expirationHours || 24);

        res.status(200).json({
            success: true,
            message: 'Invite code generated successfully',
            inviteCode: group.inviteCode,
            expiresAt: group.inviteCodeExpiresAt
        });
    } catch(err) {
        console.error('Error generating invite code:', err);
        res.status(500).json({
            success: false,
            message: 'Error generating invite code',
            error: err.message
        });
    }
};

export const joinByInviteCode = async(req, res) => {
    try {
        const { userId, inviteCode } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const group = await Group.findByInviteCode(inviteCode);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired invite code'
            });
        }

        await group.addMember(userId, user.username);

        // Update user's groups array
        await User.findByIdAndUpdate(
            userId,
            { $push: { groups: group._id.toString() } }
        );

        res.status(200).json({
            success: true,
            message: 'Successfully joined group via invite',
            group
        });
    } catch(err) {
        console.error('Error joining by invite code:', err);
        res.status(500).json({
            success: false,
            message: err.message || 'Error joining group',
            error: err.message
        });
    }
};

export const removeMember = async(req, res) => {
    try {
        const groupId = req.params.id;
        const { userId } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        await group.removeMember(userId);

        // Remove group from user's groups array
        await User.findByIdAndUpdate(
            userId,
            { $pull: { groups: groupId } }
        );

        res.status(200).json({
            success: true,
            message: 'Member removed successfully',
            group
        });
    } catch(err) {
        console.error('Error removing member:', err);
        res.status(500).json({
            success: false,
            message: err.message || 'Error removing member',
            error: err.message
        });
    }
};

export const calculateGroupDebts = async(req, res) => {
    try {
        const groupId = req.params.id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        group.calculateDebts();
        await group.save();

        res.status(200).json({
            success: true,
            message: 'Debts calculated successfully',
            debts: group.simplifyDebt
        });
    } catch(err) {
        console.error('Error calculating debts:', err);
        res.status(500).json({
            success: false,
            message: 'Error calculating debts',
            error: err.message
        });
    }
};