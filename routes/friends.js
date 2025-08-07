import express from "express";
import User from '../models/user.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// PUT: Send friend request
router.put("/sendRequest/:userId", async (req, res) => {
  try {
    const senderId = req.user.id;
    const receiverId = req.params.userId;

    // Check if trying to send request to self
    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend request to yourself'
      });
    }

    // Find both users
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId)
    ]);

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already friends
    if (sender.friends.includes(receiverId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already friends with this user'
      });
    }

    // Check if request already sent
    if (sender.sentRequests.includes(receiverId)) {
      return res.status(400).json({
        success: false,
        message: 'Friend request already sent'
      });
    }

    // Check if request already received from this user
    if (sender.receivedRequests.includes(receiverId)) {
      return res.status(400).json({
        success: false,
        message: 'This user has already sent you a friend request. Please accept it instead.'
      });
    }

    // Add to sender's sentRequests and receiver's receivedRequests
    await Promise.all([
      User.findByIdAndUpdate(senderId, {
        $addToSet: { sentRequests: receiverId }
      }),
      User.findByIdAndUpdate(receiverId, {
        $addToSet: { receivedRequests: senderId }
      })
    ]);

    res.json({
      success: true,
      message: `Friend request sent to ${receiver.username}`,
      data: {
        receiverId,
        receiverUsername: receiver.username
      }
    });

  } catch (error) {
    console.error('❌ Error sending friend request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send friend request',
      error: error.message
    });
  }
});

// PUT: Accept friend request
router.put("/acceptRequest/:userId", async (req, res) => {
  try {
    const accepterId = req.user.id;
    const requesterId = req.params.userId;

    // Check if trying to accept request from self
    if (accepterId === requesterId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      });
    }

    // Find both users
    const [accepter, requester] = await Promise.all([
      User.findById(accepterId),
      User.findById(requesterId)
    ]);

    if (!requester) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if request exists
    if (!accepter.receivedRequests.includes(requesterId) || 
        !requester.sentRequests.includes(accepterId)) {
      return res.status(400).json({
        success: false,
        message: 'No friend request found from this user'
      });
    }

    // Check if already friends (shouldn't happen, but just in case)
    if (accepter.friends.includes(requesterId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already friends with this user'
      });
    }

    // Update both users: add to friends list and remove from request lists
    await Promise.all([
      User.findByIdAndUpdate(accepterId, {
        $addToSet: { friends: requesterId },
        $pull: { receivedRequests: requesterId }
      }),
      User.findByIdAndUpdate(requesterId, {
        $addToSet: { friends: accepterId },
        $pull: { sentRequests: accepterId }
      })
    ]);

    res.json({
      success: true,
      message: `You are now friends with ${requester.username}`,
      data: {
        friendId: requesterId,
        friendUsername: requester.username
      }
    });

  } catch (error) {
    console.error('❌ Error accepting friend request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept friend request',
      error: error.message
    });
  }
});

// PUT: Reject friend request
router.put("/rejectRequest/:userId", async (req, res) => {
  try {
    const rejecterId = req.user.id;
    const requesterId = req.params.userId;

    // Find both users
    const [rejecter, requester] = await Promise.all([
      User.findById(rejecterId),
      User.findById(requesterId)
    ]);

    if (!requester) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if request exists
    if (!rejecter.receivedRequests.includes(requesterId) || 
        !requester.sentRequests.includes(rejecterId)) {
      return res.status(400).json({
        success: false,
        message: 'No friend request found from this user'
      });
    }

    // Remove from request lists
    await Promise.all([
      User.findByIdAndUpdate(rejecterId, {
        $pull: { receivedRequests: requesterId }
      }),
      User.findByIdAndUpdate(requesterId, {
        $pull: { sentRequests: rejecterId }
      })
    ]);

    res.json({
      success: true,
      message: `Friend request from ${requester.username} rejected`
    });

  } catch (error) {
    console.error('❌ Error rejecting friend request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject friend request',
      error: error.message
    });
  }
});

// DELETE: Remove friend
router.delete("/removeFriend/:userId", async (req, res) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.userId;

    // Check if trying to remove self
    if (userId === friendId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      });
    }

    // Find both users
    const [user, friend] = await Promise.all([
      User.findById(userId),
      User.findById(friendId)
    ]);

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if they are actually friends
    if (!user.friends.includes(friendId) || !friend.friends.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are not friends with this user'
      });
    }

    // Remove from both friends lists
    await Promise.all([
      User.findByIdAndUpdate(userId, {
        $pull: { friends: friendId }
      }),
      User.findByIdAndUpdate(friendId, {
        $pull: { friends: userId }
      })
    ]);

    res.json({
      success: true,
      message: `Removed ${friend.username} from your friends list`
    });

  } catch (error) {
    console.error('❌ Error removing friend:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove friend',
      error: error.message
    });
  }
});

// GET: Get user's friends list
router.get("/getFriends", async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate('friends', 'username email image')
      .select('friends');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        friends: user.friends,
        count: user.friends.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching friends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friends list',
      error: error.message
    });
  }
});

// GET: Get pending friend requests (received)
router.get("/getPendingRequests", async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate('receivedRequests', 'username email image')
      .select('receivedRequests');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        pendingRequests: user.receivedRequests,
        count: user.receivedRequests.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching pending requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending requests',
      error: error.message
    });
  }
});

// GET: Get sent friend requests
router.get("/getSentRequests", async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate('sentRequests', 'username email image')
      .select('sentRequests');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        sentRequests: user.sentRequests,
        count: user.sentRequests.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching sent requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sent requests',
      error: error.message
    });
  }
});

// GET: Search users (for adding friends)
router.get("/searchUsers", async (req, res) => {
  try {
    const userId = req.user.id;
    const { query, page = 1, limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    
    // Find users matching the search query, excluding current user
    const users = await User.find({
      _id: { $ne: userId },
      $or: [
        { username: searchRegex },
        { email: searchRegex }
      ]
    })
    .select('username email image')
    .limit(limit * 1)
    .skip((page - 1) * limit);

    // Get current user's friend data to determine relationship status
    const currentUser = await User.findById(userId)
      .select('friends sentRequests receivedRequests');

    // Add relationship status to each user
    const usersWithStatus = users.map(user => {
      let relationshipStatus = 'none';
      
      if (currentUser.friends.includes(user._id)) {
        relationshipStatus = 'friends';
      } else if (currentUser.sentRequests.includes(user._id)) {
        relationshipStatus = 'request_sent';
      } else if (currentUser.receivedRequests.includes(user._id)) {
        relationshipStatus = 'request_received';
      }

      return {
        ...user.toObject(),
        relationshipStatus
      };
    });

    const total = await User.countDocuments({
      _id: { $ne: userId },
      $or: [
        { username: searchRegex },
        { email: searchRegex }
      ]
    });

    res.json({
      success: true,
      data: {
        users: usersWithStatus,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: users.length,
          totalRecords: total
        }
      }
    });

  } catch (error) {
    console.error('❌ Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error.message
    });
  }
});

// GET: Get friend suggestions (mutual friends, etc.)
router.get("/getSuggestions", async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const currentUser = await User.findById(userId)
      .populate('friends', '_id friends')
      .select('friends sentRequests receivedRequests');

    if (!currentUser || currentUser.friends.length === 0) {
      return res.json({
        success: true,
        data: {
          suggestions: [],
          count: 0
        }
      });
    }

    // Get friends of friends (mutual connections)
    const friendsOfFriends = [];
    currentUser.friends.forEach(friend => {
      if (friend.friends) {
        friend.friends.forEach(friendOfFriend => {
          // Don't suggest current user, existing friends, or users with pending requests
          if (!friendOfFriend.equals(userId) && 
              !currentUser.friends.some(f => f._id.equals(friendOfFriend)) &&
              !currentUser.sentRequests.includes(friendOfFriend) &&
              !currentUser.receivedRequests.includes(friendOfFriend)) {
            friendsOfFriends.push(friendOfFriend);
          }
        });
      }
    });

    // Count mutual friends and get unique suggestions
    const suggestionMap = new Map();
    friendsOfFriends.forEach(friendId => {
      const count = suggestionMap.get(friendId.toString()) || 0;
      suggestionMap.set(friendId.toString(), count + 1);
    });

    // Get top suggestions sorted by mutual friend count
    const topSuggestionIds = Array.from(suggestionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (topSuggestionIds.length === 0) {
      return res.json({
        success: true,
        data: {
          suggestions: [],
          count: 0
        }
      });
    }

    // Get user details for suggestions
    const suggestions = await User.find({
      _id: { $in: topSuggestionIds }
    })
    .select('username email image');

    // Add mutual friend count to each suggestion
    const suggestionsWithMutualCount = suggestions.map(user => ({
      ...user.toObject(),
      mutualFriends: suggestionMap.get(user._id.toString())
    }));

    res.json({
      success: true,
      data: {
        suggestions: suggestionsWithMutualCount,
        count: suggestions.length
      }
    });

  } catch (error) {
    console.error('❌ Error getting friend suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get friend suggestions',
      error: error.message
    });
  }
});

// GET: Get mutual friends with a specific user
router.get("/getMutualFriends/:userId", async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    if (currentUserId === otherUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot get mutual friends with yourself'
      });
    }

    const [currentUser, otherUser] = await Promise.all([
      User.findById(currentUserId).select('friends'),
      User.findById(otherUserId).select('friends username')
    ]);

    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find mutual friends
    const mutualFriendIds = currentUser.friends.filter(friendId =>
      otherUser.friends.includes(friendId)
    );

    // Get details of mutual friends
    const mutualFriends = await User.find({
      _id: { $in: mutualFriendIds }
    }).select('username email image');

    res.json({
      success: true,
      data: {
        mutualFriends,
        count: mutualFriends.length,
        otherUser: {
          id: otherUser._id,
          username: otherUser.username
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting mutual friends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mutual friends',
      error: error.message
    });
  }
});

export default router;