"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, X, UserPlus, MoreHorizontal, Shield, Ban } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { useAuthState } from "react-firebase-hooks/auth"
import { auth } from "@/config/firebase"
import { useRoomParticipants } from '@/hooks/firestore';

type User = {
    id: string
    username: string
    email: string
    profilePicture?: string
    status?: "online" | "idle" | "dnd" | "offline"
}

type ParticipantsListProps = {
    roomId: string
    onClose?: () => void
    onBlockUser?: (userId: string) => void
}

export default function ParticipantsList({ roomId, onClose, onBlockUser }: ParticipantsListProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [user] = useAuthState(auth);

    const [participants = [], loading, error] = useRoomParticipants(roomId)

    const filteredParticipants = participants.filter((user) =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()),
    )


    return (
        <div className="flex flex-col h-full">
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
                    {filteredParticipants.map((participant) => (
                        <div key={participant.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/50">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={participant.profilePicture || "/placeholder.svg"} alt={participant.username} />
                                        <AvatarFallback>{participant.username.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                </div>
                                <div>
                                    <p className="font-medium text-sm">{participant.username}</p>
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
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}
