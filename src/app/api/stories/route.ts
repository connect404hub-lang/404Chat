import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Story } from "@/lib/models";

// GET /api/stories - Fetch all active (unexpired) stories
export async function GET() {
  try {
    await connectToDatabase();
    
    // Find stories that haven't expired yet
    const now = new Date();
    const activeStories = await Story.find({
      expiresAt: { $gt: now }
    }).sort({ createdAt: 1 }); // Ascending order so they play chronologically
    
    return NextResponse.json(activeStories);
  } catch (error: any) {
    console.error("GET /api/stories error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch active stories" },
      { status: 500 }
    );
  }
}

// POST /api/stories - Create a new developer story
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    
    const { userId, username, userAvatar, image, bgGradient, caption, musicTrack } = body;
    
    if (!userId || !username || (!image && !caption)) {
      return NextResponse.json(
        { error: "Missing required parameters (userId, username, and either image or caption are required)" },
        { status: 400 }
      );
    }
    
    // Auto-calculate expiration target (exactly 24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const newStory = new Story({
      userId,
      username,
      userAvatar: userAvatar || "",
      image: image || undefined,
      bgGradient: bgGradient || "",
      caption: caption || "",
      musicTrack: musicTrack || undefined,
      expiresAt
    });
    
    const savedStory = await newStory.save();
    return NextResponse.json(savedStory);
  } catch (error: any) {
    console.error("POST /api/stories error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload story payload" },
      { status: 500 }
    );
  }
}

// DELETE /api/stories - Delete a story
export async function DELETE(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get("storyId");
    
    if (!storyId) {
      return NextResponse.json(
        { error: "Missing required query parameter (storyId)" },
        { status: 400 }
      );
    }
    
    const deletedStory = await Story.findByIdAndDelete(storyId);
    if (!deletedStory) {
      return NextResponse.json(
        { error: "Story node not found or already purged" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, storyId });
  } catch (error: any) {
    console.error("DELETE /api/stories error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete story node" },
      { status: 500 }
    );
  }
}

