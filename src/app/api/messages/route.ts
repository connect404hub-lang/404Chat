import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Message, Chat } from "@/lib/models";

// GET /api/messages?chatId=...&since=... - Fetch messages for a chat, optionally since a given timestamp
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");
    const since = searchParams.get("since");

    if (!chatId) {
      return NextResponse.json({ error: "chatId query parameter is required" }, { status: 400 });
    }

    const query: any = { chatId };

    if (since) {
      query.createdAt = { $gt: new Date(since) };
    }

    const messages = await Message.find(query).sort({ createdAt: 1 });
    return NextResponse.json(messages);
  } catch (error: any) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch messages" }, { status: 500 });
  }
}

// POST /api/messages - Post a message
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { chatId, senderId, senderName, text, code, codeLanguage, image } = body;

    if (!chatId || !senderId || !senderName) {
      return NextResponse.json(
        { error: "chatId, senderId, and senderName are required fields" },
        { status: 400 }
      );
    }

    // Verify chat exists
    const chatExists = await Chat.exists({ _id: chatId });
    if (!chatExists) {
      return NextResponse.json({ error: "Chat does not exist" }, { status: 404 });
    }

    // Create the message
    const newMessage = new Message({
      chatId,
      senderId,
      senderName,
      text: text || "",
      code: code || "",
      codeLanguage: codeLanguage || "",
      image: image || "",
    });

    await newMessage.save();

    // Touch the chat updatedAt so it bubbles to the top of active lists
    await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() });

    return NextResponse.json(newMessage);
  } catch (error: any) {
    console.error("POST /api/messages error:", error);
    return NextResponse.json({ error: error.message || "Failed to save message" }, { status: 500 });
  }
}

// PUT /api/messages - Edit an existing message
export async function PUT(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { messageId, senderId, text } = body;

    if (!messageId || !senderId || text === undefined) {
      return NextResponse.json(
        { error: "messageId, senderId, and text are required fields" },
        { status: 400 }
      );
    }

    // Update message only if sender matches
    const updatedMessage = await Message.findOneAndUpdate(
      { _id: messageId, senderId },
      { text, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedMessage) {
      return NextResponse.json({ error: "Message not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json(updatedMessage);
  } catch (error: any) {
    console.error("PUT /api/messages error:", error);
    return NextResponse.json({ error: error.message || "Failed to edit message" }, { status: 500 });
  }
}

// DELETE /api/messages - Delete a message
export async function DELETE(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");
    const senderId = searchParams.get("senderId");

    if (!messageId || !senderId) {
      return NextResponse.json(
        { error: "messageId and senderId query parameters are required" },
        { status: 400 }
      );
    }

    // Delete message only if sender matches
    const result = await Message.deleteOne({ _id: messageId, senderId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Message not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/messages error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete message" }, { status: 500 });
  }
}
