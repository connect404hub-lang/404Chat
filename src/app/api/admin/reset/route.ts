import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User, Chat, Message, Otp } from "@/lib/models";

export async function POST() {
  try {
    await connectToDatabase();
    
    // Clear all collections
    const userResult = await User.deleteMany({});
    const chatResult = await Chat.deleteMany({});
    const msgResult = await Message.deleteMany({});
    const otpResult = await Otp.deleteMany({});

    return NextResponse.json({
      success: true,
      message: "Database wiped clean.",
      deleted: {
        users: userResult.deletedCount,
        chats: chatResult.deletedCount,
        messages: msgResult.deletedCount,
        otps: otpResult.deletedCount
      }
    });
  } catch (error: any) {
    console.error("Database reset error:", error);
    return NextResponse.json({ error: error.message || "Failed to reset database" }, { status: 500 });
  }
}
