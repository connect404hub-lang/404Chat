import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Chat, User, Message } from "@/lib/models";

// GET /api/chats?userId=sanjai_dev - Fetch chats that this user is a member of
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
    }

    // Find chats where the user is a member
    const chats = await Chat.find({ members: userId })
      .populate("members")
      .sort({ updatedAt: -1 });

    // Populate last message for each chat
    const chatsWithLastMessage = await Promise.all(
      chats.map(async (chat) => {
        const lastMsg = await Message.findOne({ chatId: chat._id })
          .sort({ createdAt: -1 })
          .lean();
        return {
          ...chat.toObject(),
          lastMessage: lastMsg || null,
        };
      })
    );

    return NextResponse.json(chatsWithLastMessage);
  } catch (error: any) {
    console.error("GET /api/chats error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch chats" }, { status: 500 });
  }
}

// POST /api/chats - Create a direct chat or a group chat
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { type, name, avatar, members } = body;

    if (!type || !members || !Array.isArray(members) || members.length < 2) {
      return NextResponse.json(
        { error: "type ('private'|'group') and at least 2 members are required" },
        { status: 400 }
      );
    }

    // Direct private chat: check for existing chat first
    if (type === "private") {
      if (members.length !== 2) {
        return NextResponse.json({ error: "Private chats must have exactly 2 members" }, { status: 400 });
      }

      // Check if a direct chat between these two users already exists
      const existingChat = await Chat.findOne({
        type: "private",
        members: { $all: members, $size: 2 },
      }).populate("members");

      if (existingChat) {
        return NextResponse.json(existingChat);
      }
    }

    // Create the new chat
    const newChat = new Chat({
      type,
      name: type === "group" ? name || "New Dev Group" : "",
      avatar: avatar || "",
      members,
    });

    await newChat.save();

    // Populate members for the returned object
    const populatedChat = await Chat.findById(newChat._id).populate("members");

    return NextResponse.json(populatedChat);
  } catch (error: any) {
    console.error("POST /api/chats error:", error);
    return NextResponse.json({ error: error.message || "Failed to create chat" }, { status: 500 });
  }
}
