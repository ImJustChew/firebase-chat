"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { DialogTrigger } from "@radix-ui/react-dialog"
import { useUsersCol, createRoom, useIsUserBlocked } from '@/hooks/firestore';
import { useAuthState } from "react-firebase-hooks/auth"
import { auth, db } from "@/config/firebase"
import { Ban, Bot } from "lucide-react"
import { toast } from "sonner"
import { initUserBotRoom } from "@/services/bot-service"
import { useLoveContext } from './love-provider'
import { doc, getDoc } from "firebase/firestore"
import { useNavigate } from "react-router"

export default function CreateChatDialog({
    children,
}: {
    children: React.ReactNode
}) {
    const [chatName, setChatName] = useState("")
    const [selectedFriends, setSelectedFriends] = useState<string[]>([])
    const [open, setOpen] = useState(false)
    const [creatingBotChat, setCreatingBotChat] = useState(false)
    const [users = [], loading, error] = useUsersCol();
    const [user] = useAuthState(auth);
    const isUserBlocked = useIsUserBlocked();
    const navigate = useNavigate();
    const { handleNewRoomCreated, handleNewBotChatAdded } = useLoveContext();

    // Filter out the current user but keep blocked users visible
    const friends = users.filter(friend => friend.id !== user?.uid);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        if (!chatName.trim() || selectedFriends.length === 0) return

        try {
            const roomId = await createRoom({
                title: chatName,
                members: [...selectedFriends, user.uid],
            });

            // Notify the romantic bot about the new room
            handleNewRoomCreated(chatName);
            // Reset form and close dialog
            setChatName("");
            setSelectedFriends([]);
            setOpen(false);

            // Navigate to the new room
            navigate(`/${roomId}`);
        } catch (error) {
            console.error("Error creating chat:", error);
            toast.error("Failed to create chat room");
        }
    }

    const toggleFriend = (friendId: string, isBlocked: boolean) => {
        // Don't allow selecting blocked users
        if (isBlocked) return;

        setSelectedFriends((prev) => (
            prev.includes(friendId)
                ? prev.filter((id) => id !== friendId)
                : [...prev, friendId]
        ));
    }

    const handleCreateBotChat = async () => {
        if (!user || creatingBotChat) return;

        try {
            setCreatingBotChat(true);
            // Pass a navigation callback to immediately redirect after creation
            // Also pass null as specificBotName to use getRandomBotName with default exclusions
            await initUserBotRoom(
                user.uid,
                async (roomId) => {
                    // Get the bot type from the created room
                    try {
                        const roomDoc = await getDoc(doc(db, "rooms", roomId));
                        if (roomDoc.exists()) {
                            const roomData = roomDoc.data();
                            const botType = roomData.bot;

                            // Only trigger the romantic bot's reaction if it's not a romantic_bot room
                            if (botType && botType !== "romantic_bot") {
                                // Delay the notification to after navigation
                                setTimeout(() => {
                                    handleNewBotChatAdded(roomId, botType);
                                }, 2000); // Wait 2 seconds after navigation before notifying romantic bot
                            }
                        }
                    } catch (error) {
                        console.error("Error getting new bot room details:", error);
                    }

                    setCreatingBotChat(false); // Reset state before navigation
                    setOpen(false); // Close the dialog first
                    navigate(`/${roomId}`); // Then navigate
                }
            );
        } catch (error) {
            console.error("Error creating bot chat:", error);
            toast.error("Failed to create AI chat companion");
            setCreatingBotChat(false);
        } finally {
            // Ensure state is reset even if navigation fails
            setTimeout(() => {
                setCreatingBotChat(false);
            }, 3000); // Safety timeout in case navigation doesn't happen
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New Chat</DialogTitle>
                </DialogHeader>

                {/* Bot Chat Creation Button */}
                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <Bot className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-medium">Create AI Chat Companion</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                                Start a private chat with an AI assistant that can answer questions and help with tasks.
                            </p>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleCreateBotChat}
                                disabled={creatingBotChat}
                            >
                                {creatingBotChat ? "Creating AI Chat..." : "Create AI Chat"}
                            </Button>
                        </div>
                    </div>
                </div>

                <Separator className="my-2" />

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="chatName">Chat Name</Label>
                        <Input
                            id="chatName"
                            value={chatName}
                            onChange={(e) => setChatName(e.target.value)}
                            placeholder="Enter chat name"
                            required
                        />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <Label className="block mb-2">Select Friends</Label>
                        <ScrollArea className="h-60 border rounded-md p-2">
                            {friends.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No friends available. Add friends to create a chat.</p>
                            ) : (
                                <div className="space-y-2">
                                    {friends.map((friend) => {
                                        const isBlocked = isUserBlocked(friend.id);

                                        return (
                                            <div
                                                key={friend.id}
                                                className={`flex items-center space-x-2 p-2 rounded-md hover:bg-muted ${isBlocked ? 'opacity-70' : ''}`}
                                            >
                                                <Checkbox
                                                    id={`friend-${friend.id}`}
                                                    checked={selectedFriends.includes(friend.id)}
                                                    onCheckedChange={() => toggleFriend(friend.id, isBlocked)}
                                                    disabled={isBlocked}
                                                />
                                                <Label
                                                    htmlFor={`friend-${friend.id}`}
                                                    className={`flex items-center gap-3 cursor-pointer flex-1 ${isBlocked ? 'cursor-not-allowed' : ''}`}
                                                >
                                                    <div className="relative">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={friend.profilePicture || "/placeholder.svg"} alt={friend.username} />
                                                            <AvatarFallback>{friend.username.charAt(0).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        {isBlocked && (
                                                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-full">
                                                                <Ban className="h-4 w-4 text-destructive" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">
                                                            {friend.username}
                                                            {isBlocked && <span className="ml-2 text-xs text-destructive">(Blocked)</span>}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">{friend.email}</p>
                                                    </div>
                                                </Label>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={!chatName.trim() || selectedFriends.length === 0}>
                            Create Chat
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
