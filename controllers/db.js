import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const connectDB = async () => {
  try {
    // Get MongoDB URI from environment variables
    const mongoURI = process.env.MONGO || process.env.MONGO || process.env.DATABASE_URL;
    
    if (!mongoURI) {
      throw new Error('MongoDB URI is not defined in environment variables. Please check your .env file.');
    }

    // MongoDB connection options
    const options = {
      // Remove deprecated options for newer versions of Mongoose
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      
      // Modern options
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(mongoURI, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔗 Connection state: ${getConnectionState(conn.connection.readyState)}`);

    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('📡 Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('📡 Mongoose disconnected from MongoDB');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔄 MongoDB connection closed through app termination');
      process.exit(0);
    });

    return conn;

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure MongoDB is running:');
      console.error('   • Local MongoDB: brew services start mongodb/brew/mongodb-community');
      console.error('   • Docker: docker run -d -p 27017:27017 mongo');
      console.error('   • Check if port 27017 is available');
    } else if (error.message.includes('authentication failed')) {
      console.error('💡 Check your MongoDB credentials in .env file');
    } else if (error.message.includes('not defined')) {
      console.error('💡 Add MONGO to your .env file:');
      console.error('   MONGO=mongodb://localhost:27017/pennypal');
    }
    
    process.exit(1);
  }
};

// Helper function to get readable connection state
const getConnectionState = (state) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[state] || 'unknown';
};

// Function to check database health
export const checkDBHealth = async () => {
  try {
    const state = mongoose.connection.readyState;
    const isConnected = state === 1;
    
    if (isConnected) {
      // Try to ping the database
      await mongoose.connection.db.admin().ping();
    }
    
    return {
      isConnected,
      state: getConnectionState(state),
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      port: mongoose.connection.port
    };
  } catch (error) {
    return {
      isConnected: false,
      state: 'error',
      error: error.message
    };
  }
};

export default connectDB;