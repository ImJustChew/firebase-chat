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
import { useUsersCol, createRoom } from '@/hooks/firestore';
import { useAuthState } from "react-firebase-hooks/auth"
import { auth } from "@/config/firebase"

type Friend = {
    id: string
    username: string
    email: string
    profilePicture?: string
}

export default function CreateChatDialog({
    children,
}: {
    children: React.ReactNode
}) {
    const [chatName, setChatName] = useState("")
    const [selectedFriends, setSelectedFriends] = useState<string[]>([])
    const [open, setOpen] = useState(false)
    const [users = [], loading, error] = useUsersCol();
    const [user] = useAuthState(auth);

    const friends = users.filter((friend: Friend) => friend.id !== user?.uid)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        if (!chatName.trim() || selectedFriends.length === 0) return

        await createRoom({
            title: chatName,
            members: [...selectedFriends, user.uid],
        })

        // Reset form
        setChatName("")
        setSelectedFriends([])
        setOpen(false)
    }

    const toggleFriend = (friendId: string) => {
        setSelectedFriends((prev) => (prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]))
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New Chat</DialogTitle>
                </DialogHeader>
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
                                <p className="text-center text-muted-foreground py-4">No friends yet. Add friends to create a chat.</p>
                            ) : (
                                <div className="space-y-2">
                                    {friends.map((user) => (
                                        <div key={user.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                                            <Checkbox
                                                id={`friend-${user.id}`}
                                                checked={selectedFriends.includes(user.id)}
                                                onCheckedChange={() => toggleFriend(user.id)}
                                            />
                                            <Label htmlFor={`friend-${user.id}`} className="flex items-center gap-3 cursor-pointer flex-1">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={user.profilePicture || "/placeholder.svg"} alt={user.username} />
                                                    <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium text-sm">{user.username}</p>
                                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                                </div>
                                            </Label>
                                        </div>
                                    ))}
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
