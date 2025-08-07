import User from "../models/user.js";

// Send friend request
export const sendRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const { friendName } = req.body; // username of friend

        // Validate input
        if (!friendName || friendName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Friend username is required'
            });
        }

        // Get sender information
        const sender = await User.findById(userId);
        if (!sender) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find friend by username
        const friendUser = await User.findOne({ username: friendName.trim() });
        if (!friendUser) {
            return res.status(404).json({
                success: false,
                message: 'Friend not found'
            });
        }

        // Check if trying to add themselves
        if (friendUser._id.toString() === userId) {
            return res.status(400).json({
                success: false,
                message: 'You cannot send a friend request to yourself'
            });
        }

        // Check if already friends
        if (friendUser.friends.includes(sender.username)) {
            return res.status(400).json({
                success: false,
                message: 'You are already friends with this user'
            });
        }

        // Check if request already sent
        if (friendUser.receivedRequests.includes(sender.username)) {
            return res.status(400).json({
                success: false,
                message: 'You have already sent a request to this user'
            });
        }

        // Check if there's a pending request from the friend (reverse request)
        if (sender.receivedRequests.includes(friendName)) {
            return res.status(400).json({
                success: false,
                message: 'This user has already sent you a friend request. Check your received requests.'
            });
        }

        // Send the friend request
        const senderUpdate = await User.findByIdAndUpdate(
            userId,
            { 
                $addToSet: { sentRequests: friendName } // Use $addToSet to avoid duplicates
            },
            { new: true }
        );

        const receiverUpdate = await User.findByIdAndUpdate(
            friendUser._id,
            { 
                $addToSet: { 
                    receivedRequests: sender.username,
                    inbox: `${sender.username} sent you a friend request`
                }
            },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: "Friend request sent successfully",
            data: {
                sentTo: friendName,
                sentBy: sender.username
            }
        });

    } catch (err) {
        console.error('Error sending friend request:', err);
        res.status(500).json({
            success: false,
            message: "Unable to send friend request",
            error: err.message
        });
    }
};

// Accept friend request
export const acceptRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const { friendName } = req.body; // username of friend who sent the request

        // Validate input
        if (!friendName || friendName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Friend username is required'
            });
        }

        // Get user information
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find friend by username
        const friendUser = await User.findOne({ username: friendName.trim() });
        if (!friendUser) {
            return res.status(404).json({
                success: false,
                message: 'Friend not found'
            });
        }

        // Check if there's actually a pending request
        if (!user.receivedRequests.includes(friendName)) {
            return res.status(400).json({
                success: false,
                message: 'No pending friend request from this user'
            });
        }

        // Check if already friends
        if (user.friends.includes(friendName)) {
            return res.status(400).json({
                success: false,
                message: 'You are already friends with this user'
            });
        }

        // Accept the friend request - update both users
        const userUpdate = await User.findByIdAndUpdate(
            userId,
            { 
                $addToSet: { friends: friendName },
                $pull: { receivedRequests: friendName }
            },
            { new: true }
        );

        const friendUpdate = await User.findByIdAndUpdate(
            friendUser._id,
            { 
                $addToSet: { 
                    friends: user.username,
                    inbox: `${user.username} accepted your friend request`
                },
                $pull: { sentRequests: user.username }
            },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: "Friend request accepted successfully",
            data: {
                newFriend: friendName,
                acceptedBy: user.username
            }
        });

    } catch (err) {
        console.error('Error accepting friend request:', err);
        res.status(500).json({
            success: false,
            message: "Unable to accept friend request",
            error: err.message
        });
    }
};

// Reject friend request
export const rejectRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const { friendName } = req.body;

        if (!friendName || friendName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Friend username is required'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const friendUser = await User.findOne({ username: friendName.trim() });
        if (!friendUser) {
            return res.status(404).json({
                success: false,
                message: 'Friend not found'
            });
        }

        // Check if there's actually a pending request
        if (!user.receivedRequests.includes(friendName)) {
            return res.status(400).json({
                success: false,
                message: 'No pending friend request from this user'
            });
        }

        // Reject the request
        await User.findByIdAndUpdate(
            userId,
            { $pull: { receivedRequests: friendName } }
        );

        await User.findByIdAndUpdate(
            friendUser._id,
            { $pull: { sentRequests: user.username } }
        );

        res.status(200).json({
            success: true,
            message: "Friend request rejected successfully"
        });

    } catch (err) {
        console.error('Error rejecting friend request:', err);
        res.status(500).json({
            success: false,
            message: "Unable to reject friend request",
            error: err.message
        });
    }
};

// Get user's friends list
export const getFriends = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('friends username');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get detailed friend information
        const friendsDetails = await User.find(
            { username: { $in: user.friends } }
        ).select('username email image _id');

        res.status(200).json({
            success: true,
            friends: friendsDetails
        });

    } catch (err) {
        console.error('Error getting friends:', err);
        res.status(500).json({
            success: false,
            message: "Unable to get friends list",
            error: err.message
        });
    }
};

// Get pending sent requests
export const getSentRequests = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('sentRequests');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            sentRequests: user.sentRequests
        });

    } catch (err) {
        console.error('Error getting sent requests:', err);
        res.status(500).json({
            success: false,
            message: "Unable to get sent requests",
            error: err.message
        });
    }
};

// Get pending received requests
export const getReceivedRequests = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('receivedRequests');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get sender details for received requests
        const requestDetails = await User.find(
            { username: { $in: user.receivedRequests } }
        ).select('username email image _id');

        res.status(200).json({
            success: true,
            receivedRequests: requestDetails
        });

    } catch (err) {
        console.error('Error getting received requests:', err);
        res.status(500).json({
            success: false,
            message: "Unable to get received requests",
            error: err.message
        });
    }
};

// Remove friend
export const removeFriend = async (req, res) => {
    try {
        const { userId } = req.params;
        const { friendName } = req.body;

        if (!friendName || friendName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Friend username is required'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const friendUser = await User.findOne({ username: friendName.trim() });
        if (!friendUser) {
            return res.status(404).json({
                success: false,
                message: 'Friend not found'
            });
        }

        // Check if they are actually friends
        if (!user.friends.includes(friendName)) {
            return res.status(400).json({
                success: false,
                message: 'You are not friends with this user'
            });
        }

        // Remove from both users' friends lists
        await User.findByIdAndUpdate(
            userId,
            { $pull: { friends: friendName } }
        );

        await User.findByIdAndUpdate(
            friendUser._id,
            { $pull: { friends: user.username } }
        );

        res.status(200).json({
            success: true,
            message: "Friend removed successfully"
        });

    } catch (err) {
        console.error('Error removing friend:', err);
        res.status(500).json({
            success: false,
            message: "Unable to remove friend",
            error: err.message
        });
    }
};

// Cancel sent friend request
export const cancelRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const { friendName } = req.body;

        if (!friendName || friendName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Friend username is required'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const friendUser = await User.findOne({ username: friendName.trim() });
        if (!friendUser) {
            return res.status(404).json({
                success: false,
                message: 'Friend not found'
            });
        }

        // Check if request was actually sent
        if (!user.sentRequests.includes(friendName)) {
            return res.status(400).json({
                success: false,
                message: 'No pending request to this user'
            });
        }

        // Cancel the request
        await User.findByIdAndUpdate(
            userId,
            { $pull: { sentRequests: friendName } }
        );

        await User.findByIdAndUpdate(
            friendUser._id,
            { $pull: { receivedRequests: user.username } }
        );

        res.status(200).json({
            success: true,
            message: "Friend request cancelled successfully"
        });

    } catch (err) {
        console.error('Error cancelling friend request:', err);
        res.status(500).json({
            success: false,
            message: "Unable to cancel friend request",
            error: err.message
        });
    }
};

// Search users by username (for adding friends)
export const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        const { userId } = req.params;

        if (!query || query.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Search for users by username (case insensitive)
        const users = await User.find({
            username: { $regex: query.trim(), $options: 'i' },
            _id: { $ne: userId } // Exclude current user
        }).select('username email image _id').limit(10);

        // Add friendship status to each user
        const usersWithStatus = users.map(user => ({
            ...user.toObject(),
            friendshipStatus: currentUser.friends.includes(user.username) ? 'friends' :
                            currentUser.sentRequests.includes(user.username) ? 'sent' :
                            currentUser.receivedRequests.includes(user.username) ? 'received' :
                            'none'
        }));

        res.status(200).json({
            success: true,
            users: usersWithStatus
        });

    } catch (err) {
        console.error('Error searching users:', err);
        res.status(500).json({
            success: false,
            message: "Unable to search users",
            error: err.message
        });
    }
};