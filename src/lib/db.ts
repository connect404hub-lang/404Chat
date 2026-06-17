import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://sanjai:sanjai30812@ac-zd6hyln-shard-00-00.huoyyod.mongodb.net:27017,ac-zd6hyln-shard-00-01.huoyyod.mongodb.net:27017,ac-zd6hyln-shard-00-02.huoyyod.mongodb.net:27017/devconnect?ssl=true&replicaSet=atlas-qy6hpu-shard-0&authSource=admin&tlsAllowInvalidCertificates=true";

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable inside next.config.ts or as a string.");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Global is used here to maintain a cached connection across hot-reloads in development.
let cached: MongooseCache = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      family: 4, // Force IPv4 to prevent IPv6 DNS timeout
      tlsAllowInvalidCertificates: true, // Allow connection behind SSL-intercepting proxies
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
