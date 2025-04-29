"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, X, UserPlus, MoreHorizontal, Shield, Ban, Bot, Trash2 } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useAuthState } from "react-firebase-hooks/auth"
import { auth, db } from "@/config/firebase"
import { useBlockUser, useIsUserBlocked, useRoomDoc, useRoomMembers } from '@/hooks/firestore';
import { BOT_CONFIGS } from "@/services/bot-service"
import { deleteDoc, doc } from "firebase/firestore"
import { useNavigate } from "react-router"

type User = {
    id: string
    username: string
    email: string
    profilePicture?: string
    status?: "online" | "idle" | "dnd" | "offline"
    isBot?: boolean
}

type ParticipantsListProps = {
    roomId: string
    onClose?: () => void
    onBlockUser?: (userId: string) => void
}

export default function ParticipantsList({ roomId, onClose, onBlockUser }: ParticipantsListProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [user] = useAuthState(auth);
    const blockUser = useBlockUser();
    const isUserBlocked = useIsUserBlocked();
    const [roomDoc] = useRoomDoc(roomId)
    const navigate = useNavigate();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const [participants = [], loading, error] = useRoomMembers(roomId)

    const filteredParticipants = participants.filter((user) =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()),
    )

    const handleBlockUser = async (userId: string) => {
        try {
            await blockUser(userId);
            toast("User blocked successfully");

            if (onBlockUser) {
                onBlockUser(userId);
            }
        } catch (error) {
            toast("Failed to block user");
        }
    };

    const handleDeleteRoom = async () => {
        if (!roomDoc || !roomDoc.bot) return;

        try {
            await deleteDoc(doc(db, "rooms", roomId));
            toast.success("Room deleted successfully");
            if (onClose) onClose();
            navigate("/");
        } catch (error) {
            console.error("Error deleting room:", error);
            toast.error("Failed to delete room");
        }
    };

    return (
        <div className="flex flex-col h-full md:relative fixed inset-0 bg-background z-50 md:z-auto md:inset-auto">
            <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-medium">Participants ({participants.length})</h3>
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div className="p-3 border-b">
                <div className="relative">
                    <Input
                        placeholder="Search participants..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                    />
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-3 space-y-1">
                    {filteredParticipants.map((participant) => {
                        const isBlocked = isUserBlocked(participant.id);

                        return (
                            <div key={participant.id} className={`flex items-center justify-between p-2 rounded-md hover:bg-secondary/50 `}>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar className={`h-8 w-8`}>
                                            <AvatarImage src={participant.profilePicture || "/placeholder.svg"} alt={participant.username} />
                                            <AvatarFallback>{participant.username.charAt(0).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        {isBlocked && (
                                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-full">
                                                <Ban className="h-4 w-4 text-destructive" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">
                                            {participant.username}
                                            {isBlocked && <span className="ml-2 text-xs text-destructive">(Blocked)</span>}
                                        </p>
                                    </div>
                                </div>
                                {participant.id !== user!.uid && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem>
                                                <UserPlus className="h-4 w-4 mr-2" />
                                                <span>Add Friend</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <Shield className="h-4 w-4 mr-2" />
                                                <span>View Profile</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => handleBlockUser(participant.id)}
                                                className={isBlocked ? "text-muted-foreground" : "text-destructive"}
                                                disabled={isBlocked}
                                            >
                                                <Ban className="h-4 w-4 mr-2" />
                                                <span>{isBlocked ? "User Blocked" : "Block User"}</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        );
                    })}
                    {roomDoc && roomDoc.bot && (
                        <div className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/50">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={BOT_CONFIGS[roomDoc.bot].profilePicture} alt={BOT_CONFIGS[roomDoc.bot].name} />
                                    <AvatarFallback>{BOT_CONFIGS[roomDoc.bot].name.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium text-sm">{BOT_CONFIGS[roomDoc.bot].name}</p>
                                </div>
                            </div>
                            <Bot className="h-4 w-4 text-muted-foreground" />
                        </div>
                    )}
                </div>
            </ScrollArea>

            {roomDoc && roomDoc.bot && (
                <>
                    <div className="p-3 border-t">
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => setIsDeleteDialogOpen(true)}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Room
                        </Button>
                    </div>

                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete your chat room with {roomDoc.bot && BOT_CONFIGS[roomDoc.bot].name} and remove all associated messages. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteRoom} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
        </div>
    )
}
