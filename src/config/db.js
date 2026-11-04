const mongoose = require('mongoose');

/**
 * Sanitizes and formats MongoDB connection URI:
 * 1. Safely URL-encodes passwords that contain special characters (like '@')
 * 2. Ensures the database name '/faa_organic' is present if omitted
 * @param {string} rawUri
 * @returns {string} sanitizedUri
 */
const formatMongoUri = (rawUri) => {
  if (!rawUri || typeof rawUri !== 'string') return rawUri;

  const trimmed = rawUri.trim();
  const protocolIndex = trimmed.indexOf('://');
  if (protocolIndex === -1) return trimmed;

  const protocol = trimmed.slice(0, protocolIndex + 3);
  const rest = trimmed.slice(protocolIndex + 3);

  const lastAtIndex = rest.lastIndexOf('@');
  if (lastAtIndex === -1) return trimmed;

  const userInfo = rest.slice(0, lastAtIndex);
  let hostAndQuery = rest.slice(lastAtIndex + 1);

  const colonIndex = userInfo.indexOf(':');
  if (colonIndex === -1) return trimmed;

  const username = userInfo.slice(0, colonIndex);
  const password = userInfo.slice(colonIndex + 1);

  // Safely encode password if it contains special characters and is not already encoded
  let encodedPassword = password;
  try {
    const decoded = decodeURIComponent(password);
    encodedPassword = encodeURIComponent(decoded);
  } catch {
    encodedPassword = encodeURIComponent(password);
  }

  // Ensure database name 'faa_organic' exists before query parameters
  const queryIndex = hostAndQuery.indexOf('?');
  let hostPath = queryIndex === -1 ? hostAndQuery : hostAndQuery.slice(0, queryIndex);
  const queryParams = queryIndex === -1 ? '' : hostAndQuery.slice(queryIndex);

  if (!hostPath.includes('/') || hostPath.endsWith('/')) {
    hostPath = hostPath.endsWith('/') ? `${hostPath}faa_organic` : `${hostPath}/faa_organic`;
  }

  return `${protocol}${username}:${encodedPassword}@${hostPath}${queryParams}`;
};

/**
 * Connect to MongoDB Atlas via Mongoose
 */
const connectDB = async () => {
  const rawUri = process.env.MONGODB_URI;

  if (!rawUri || rawUri.includes('<username>') || rawUri.includes('<password>')) {
    console.warn(
      '⚠️  [Database] MONGODB_URI is missing or contains placeholder credentials.'
    );
    console.warn(
      '👉 [Database] In production (Render): Add MONGODB_URI in Render Dashboard > Environment.'
    );
    console.warn(
      '👉 [Database] In local development: Set MONGODB_URI in your .env file.'
    );
    return null;
  }

  const sanitizedUri = formatMongoUri(rawUri);

  try {
    const conn = await mongoose.connect(sanitizedUri, {
      serverSelectionTimeoutMS: 8000,
      autoIndex: process.env.NODE_ENV !== 'production', // Build indexes in dev, skip in high-scale prod
    });

    console.log(`✅ [Database] MongoDB Atlas Connected Successfully!`);
    console.log(`📦 [Database] Host     : ${conn.connection.host}`);
    console.log(`🗄️  [Database] Database : ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ [Database] MongoDB Connection Failed: ${error.message}`);

    // Provide actionable diagnostic tips
    if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error(
        '💡 [Tip] Verify your MongoDB Atlas Database User credentials in MongoDB Atlas > Database Access.'
      );
    } else if (
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('querySrv ETIMEOUT') ||
      error.message.includes('ECONNREFUSED')
    ) {
      console.error(
        '💡 [Tip] Ensure your IP address is whitelisted in MongoDB Atlas > Network Access (Allow Access from Anywhere: 0.0.0.0/0 for dev).'
      );
    }

    return null;
  }
};

/**
 * Disconnect from MongoDB (useful for graceful shutdown and tests)
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('🔌 [Database] MongoDB connection closed.');
  } catch (error) {
    console.error(`[Database] Error while disconnecting: ${error.message}`);
  }
};

/**
 * Check active MongoDB connection status
 * @returns {string} 'connected' | 'connecting' | 'disconnecting' | 'disconnected'
 */
const getDBStatus = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
};

// Listen to Mongoose runtime events
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  [Database] MongoDB connection lost / disconnected.');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 [Database] MongoDB reconnected.');
});

connectDB.connectDB = connectDB;
connectDB.disconnectDB = disconnectDB;
connectDB.getDBStatus = getDBStatus;
connectDB.formatMongoUri = formatMongoUri;

module.exports = connectDB;
