import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Typing, Chat } from "@/lib/models";

// GET /api/chats/typing?userId=sanjai_dev OR ?chatId=...
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const chatId = searchParams.get("chatId");

    let chatIds: string[] = [];

    if (userId) {
      // Find all chats this user is part of
      const chats = await Chat.find({ members: userId }).select("_id").lean();
      chatIds = chats.map((c) => c._id.toString());
    } else if (chatId) {
      chatIds = [chatId];
    } else {
      return NextResponse.json(
        { error: "Either userId or chatId parameter is required" },
        { status: 400 }
      );
    }

    if (chatIds.length === 0) {
      return NextResponse.json({});
    }

    // Find all active typing states for these chats
    const activeTyping = await Typing.find({
      chatId: { $in: chatIds },
      expiresAt: { $gt: new Date() },
    }).lean();

    // Group by chatId
    const result: Record<string, { userId: string; username: string }[]> = {};
    activeTyping.forEach((t) => {
      const cId = t.chatId.toString();
      if (!result[cId]) {
        result[cId] = [];
      }
      result[cId].push({
        userId: t.userId,
        username: t.username,
      });
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/chats/typing error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch typing states" },
      { status: 500 }
    );
  }
}

// POST /api/chats/typing - Update typing status for a user
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { chatId, userId, username, isTyping } = body;

    if (!chatId || !userId || !username) {
      return NextResponse.json(
        { error: "chatId, userId, and username are required fields" },
        { status: 400 }
      );
    }

    if (isTyping) {
      // Upsert: valid for 5 seconds
      const expiresAt = new Date(Date.now() + 5000);
      await Typing.findOneAndUpdate(
        { chatId, userId },
        { username, expiresAt },
        { upsert: true, new: true }
      );
    } else {
      // Delete
      await Typing.deleteOne({ chatId, userId });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/chats/typing error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update typing status" },
      { status: 500 }
    );
  }
}
