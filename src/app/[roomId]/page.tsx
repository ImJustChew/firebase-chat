"use client";;
import { Button } from "@/components/ui/button";
import { DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { auth } from "@/config/firebase";
import { Dialog } from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
    Attachment,
    useDeleteMessage,
    useRoomDoc,
    useRoomMessagesCol,
    useSendMessage,
    useIsUserBlocked,
} from '@/hooks/firestore';
import { Bot, File, Gift, Hash, Send, Trash2, Users, Bell } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useParams, useRouter } from "next/navigation";
import GifPicker from "@/components/gif-picker";
import ParticipantsList from "@/components/participants-list";
import MessageSearch from "@/components/message-search";
import { generateAndSendBotResponses } from '@/services/bot-service';
import { useLoveContext } from '@/components/love-provider';

const AttachmentViewerDialog = ({ attachment, children }: { attachment: Attachment, children: React.ReactNode }) => {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <div>
                    {children}
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-2xl w-full">
                <div className="flex flex-col items-center justify-center bg-card p-4 rounded-md w-full">
                    {attachment.type === "image" && (
                        <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
                        />
                    )}
                    {attachment.type === "video" && (
                        <video
                            src={attachment.url}
                            controls
                            className="max-h-[90vh] max-w-[90vw] rounded-md"
                        />
                    )}
                    {attachment.type === "gif" && (
                        <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
const MessagesPage = ({ roomId }: { roomId: string }) => {
    const isMobile = useIsMobile();
    const [room, loadingRoom, errorRoom] = useRoomDoc(roomId);
    const [messages = [], loading, error] = useRoomMessagesCol(roomId);
    const [user, loadingUser, errorUser] = useAuthState(auth);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isUserBlocked = useIsUserBlocked();

    // Add state for notification permission
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);
    const [lastMessageId, setLastMessageId] = useState<string | null>(null);
    const [windowFocused, setWindowFocused] = useState<boolean>(true);

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [fileInputKey, setFileInputKey] = useState<number>(Date.now())
    const [uploadingFile, setUploadingFile] = useState<boolean>(false)

    const [newMessage, setNewMessage] = useState<string>("")
    const [showGifPicker, setShowGifPicker] = useState<boolean>(false)
    const [showParticipants, setShowParticipants] = useState<boolean>(false)
    const [isBotTyping, setIsBotTyping] = useState<boolean>(false);

    const router = useRouter();
    const { trackMessageToOthers } = useLoveContext();

    const sendMessage = useSendMessage(roomId);
    const deleteMessage = useDeleteMessage(roomId);

    // If roomdoc loaded and no room, redirect to home
    useEffect(() => {
        if (loadingRoom) return;
        if (!room && !loadingRoom) {
            router.push("/");
        }
    }, [room, loadingRoom, router]);

    // Request notification permission
    const requestNotificationPermission = async () => {
        console.log("Requesting notification permission...");
        if (typeof window === "undefined") return; // Ensure this runs only in the browser
        if (!("Notification" in window)) {
            console.log("This browser does not support notifications");
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
        } catch (error) {
            console.error("Error requesting notification permission:", error);
        }
    };

    // Check if window is focused
    useEffect(() => {
        if (typeof window === "undefined") return; // Ensure this runs only in the browser
        const handleFocus = () => setWindowFocused(true);
        const handleBlur = () => setWindowFocused(false);

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // Request notification permission on component mount
    useEffect(() => {
        if (typeof window === "undefined") return; // Ensure this runs only in the browser
        if ("Notification" in window) {
            setNotificationPermission(Notification.permission);

            if (Notification.permission !== "granted" && Notification.permission !== "denied") {
                requestNotificationPermission();
            }
        }
    }, []);

    // Check for new messages and show notifications
    useEffect(() => {
        if (messages.length === 0 || loadingUser || !user) return;

        const latestMessage = messages[messages.length - 1];

        // If this is a new message, not from the current user, and window is not focused
        if (
            latestMessage &&
            latestMessage.id !== lastMessageId &&
            latestMessage.user.id !== user.uid &&
            !windowFocused &&
            notificationPermission === "granted"
        ) {
            // Create and show notification
            const notification = new Notification(`${latestMessage.user.username} in ${room?.title}`, {
                body: latestMessage.content || 'Sent an attachment',
                icon: latestMessage.user.profilePicture || '/favicon.ico',
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            };

            // Update last message ID
            setLastMessageId(latestMessage.id);
        } else if (latestMessage && latestMessage.id !== lastMessageId) {
            // Just update the last seen message ID if it's a new message but we don't need to notify
            setLastMessageId(latestMessage.id);
        }
    }, [messages, user, loadingUser, windowFocused, notificationPermission, room, lastMessageId]);

    // Handle bot responses
    useEffect(() => {
        if (!room) return;
        if (room.bot && messages.length > 0 && !loading && user) {
            const lastMessage = messages[messages.length - 1];

            // If the last message is from the user (not the bot), generate a bot response
            if (lastMessage.user.id === user.uid) {
                setIsBotTyping(true);

                // Add a slight delay to make it feel more natural
                const timer = setTimeout(async () => {
                    try {
                        if (!room.bot) return; // Ensure the bot is still present in the room

                        // Use the enhanced function that handles sending messages to Firestore
                        await generateAndSendBotResponses(
                            roomId,
                            room.bot,
                            messages.slice(-10), // Use the last 10 messages for context
                            lastMessage.content
                        );
                    } catch (error) {
                        console.error("Error with bot response:", error);
                    } finally {
                        setIsBotTyping(false);
                    }
                }, 1000 + Math.random() * 1500); // Random delay between 1-2.5 seconds

                return () => clearTimeout(timer);
            }
        }
    }, [messages, room, loading, user, roomId]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingFile(true)
        try {
            // your upload logic here, e.g.:
            // await uploadFileToStorage(file)
        } finally {
            setUploadingFile(false)
            // reset input so same file can be re‑selected
            setFileInputKey(Date.now())
        }
    }
    const handleDeleteMessage = async (messageId: string) => {
        await deleteMessage(messageId);
        toast("Message deleted");

    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim()) return
        try {
            await sendMessage({
                content: newMessage,
            })
            trackMessageToOthers(roomId);
            setNewMessage("")
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        } catch (error) {
            toast.error("Error sending message")
        }
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    const handleSendGif = async (gif: { url: string; title: string }) => {
        try {
            await sendMessage({
                content: gif.title,
                attachments: [
                    {
                        id: Date.now().toString(),
                        type: "gif",
                        url: gif.url,
                        name: gif.title,
                        size: 0,
                    },
                ],
            })
            setShowGifPicker(false)
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        } catch (error) {
            toast.error("Error sending GIF")
        }
    }


    return <div className="flex-1 flex flex-col overflow-hidden">
        {/* Channel header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-border ">
            <div className="flex items-center gap-2">
                {isMobile && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 mr-1"
                        onClick={() => router.push(`/`)} // Navigate back to the rooms list
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                        >
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </Button>
                )}
                <Hash className="h-6 w-6 text-muted-foreground" />
                <h2 className="font-semibold">
                    {room?.title}
                </h2>
                {room?.bot && (
                    <div className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                        <div className="flex items-center gap-1">
                            <Bot className="h-3 w-3" />
                            <span>AI Bot</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2" suppressHydrationWarning={true} >
                <MessageSearch messages={messages} />

                {notificationPermission !== "granted" && typeof window !== 'undefined' && "Notification" in window && <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8"
                                onClick={requestNotificationPermission}
                            >
                                <Bell className="h-4 w-4 animate-ring" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Enable Notifications</TooltipContent>
                    </Tooltip>
                </TooltipProvider>}

                {!room?.bot && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                >
                                    <Bot className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Chatbot</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setShowParticipants((prev) => !prev)}
                            >
                                <Users className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Participants</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>

        {/* Messages area */}
        <div className="flex flex-1 overflow-hidden">
            <ScrollArea className="flex-1 px-4">
                <div className="py-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-10">
                            <div className="bg-secondary p-6 rounded-full mb-4">
                                <Hash className="h-12 w-12 text-primary" />
                            </div>
                            <h3 className="text-2xl font-bold mb-2">
                                Welcome to # {room?.title} !
                            </h3>
                            <p className="text-muted-foreground text-center max-w-md">
                                This is the start of the #
                                {room?.title}{" "}
                                channel. Send a message to start the conversation!
                            </p>
                        </div>
                    ) : (
                        messages.map((message, index) => {
                            const prevMessage = index > 0 ? messages[index - 1] : null
                            const isOwnMessage = message.user.id === user?.uid;
                            const isBlockedUser = isUserBlocked(message.user.id);
                            const showHeader =
                                !prevMessage ||
                                prevMessage.user.id !== message.user.id ||
                                (message.timestamp?.toMillis() ?? Date.now()) - prevMessage.timestamp!.toMillis() >
                                5 * 60 * 1000

                            // Display a placeholder for blocked user messages
                            if (isBlockedUser && !isOwnMessage) {
                                return (
                                    <div
                                        id={`message-${message.id}`}
                                        key={message.id}
                                        className="flex items-center opacity-50"
                                    >
                                        <div className="bg-muted rounded-md p-3 text-sm">
                                            <p className="italic text-muted-foreground">Message from blocked user</p>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    id={`message-${message.id}`}
                                    key={message.id}
                                    className={`${showHeader ? "mt-4" : "mt-0.5 pl-14"} group`}
                                >
                                    {showHeader && (
                                        <div className="flex items-start mb-1">
                                            <Avatar className="h-10 w-10 mr-4 mt-0.5">
                                                <AvatarImage
                                                    src={message.user.profilePicture || "/placeholder.svg"}
                                                    alt={message.user.username}
                                                />
                                                <AvatarFallback>{message.user.username.charAt(0).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-baseline">
                                                    <span className="font-medium mr-2">{message.user.username}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {format((message.timestamp?.toDate() ?? new Date()), "MM/dd/yyyy h:mm a")}
                                                    </span>
                                                    {message.user.id === user?.uid && !message.isDeleted && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                                                            onClick={() => handleDeleteMessage(message.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className={message.isDeleted ? "italic text-muted-foreground" : ""}>
                                                    <p className="break-words">{message.content}</p>
                                                </div>
                                                {message.attachments &&
                                                    !message.isDeleted &&
                                                    message.attachments.map((attachment) => (
                                                        <AttachmentViewerDialog
                                                            key={attachment.id}
                                                            attachment={attachment}
                                                        >
                                                            {/* trigger UI */}
                                                            {attachment.type === "image" && (
                                                                <img
                                                                    src={attachment.url || "/placeholder.svg"}
                                                                    alt={attachment.name}
                                                                    className="mt-2 max-h-96 max-w-md rounded-md object-contain cursor-pointer"
                                                                />
                                                            )}
                                                            {attachment.type === "video" && (
                                                                <video
                                                                    src={attachment.url}
                                                                    controls
                                                                    className="mt-2 max-w-full rounded-md cursor-pointer"
                                                                />
                                                            )}
                                                            {attachment.type === "gif" && (
                                                                <img
                                                                    src={attachment.url || "/placeholder.svg"}
                                                                    alt={attachment.name}
                                                                    className="mt-2 max-h-96 max-w-md rounded-md object-contain cursor-pointer"
                                                                />
                                                            )}
                                                            {attachment.type === "file" && (
                                                                <div className="mt-2 flex items-center gap-2 p-3 bg-secondary rounded-md cursor-pointer">
                                                                    <File className="h-5 w-5" />
                                                                    <span className="flex-1 truncate">{attachment.name}</span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            const a = document.createElement("a")
                                                                            a.href = attachment.url!
                                                                            a.download = attachment.name
                                                                            document.body.appendChild(a)
                                                                            a.click()
                                                                            document.body.removeChild(a)
                                                                        }}
                                                                    >
                                                                        Download
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </AttachmentViewerDialog>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                    {!showHeader && (
                                        <div className="group flex">
                                            <div className={message.isDeleted ? "italic text-muted-foreground flex-1" : "flex-1"}>
                                                <p className="break-words">{message.content}</p>
                                            </div>
                                            {message.user.id === user?.uid && !message.isDeleted && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                                                    onClick={() => handleDeleteMessage(message.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    {!showHeader &&
                                        message.attachments &&
                                        !message.isDeleted &&
                                        message.attachments.map((attachment) => (
                                            <AttachmentViewerDialog key={attachment.id} attachment={attachment}>
                                                {attachment.type === "image" && (
                                                    <img
                                                        src={attachment.url || "/placeholder.svg"}
                                                        alt={attachment.name}
                                                        className="mt-2 max-h-96 max-w-md rounded-md object-contain cursor-pointer"
                                                    />
                                                )}
                                                {attachment.type === "video" && (
                                                    <video
                                                        src={attachment.url}
                                                        controls
                                                        className="mt-2 max-w-full rounded-md cursor-pointer"
                                                    />
                                                )}
                                                {attachment.type === "gif" && (
                                                    <img
                                                        src={attachment.url || "/placeholder.svg"}
                                                        alt={attachment.name}
                                                        className="mt-2 max-h-96 max-w-md rounded-md object-contain cursor-pointer"
                                                    />
                                                )}
                                                {attachment.type === "file" && (
                                                    <div className="mt-2 flex items-center gap-2 p-3 bg-secondary rounded-md cursor-pointer">
                                                        <File className="h-5 w-5" />
                                                        <span className="flex-1 truncate">{attachment.name}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const a = document.createElement("a");
                                                                a.href = attachment.url!;
                                                                a.download = attachment.name;
                                                                document.body.appendChild(a);
                                                                a.click();
                                                                document.body.removeChild(a);
                                                            }}
                                                        >
                                                            Download
                                                        </Button>
                                                    </div>
                                                )}
                                            </AttachmentViewerDialog>
                                        ))}
                                </div>
                            )
                        })
                    )}
                    {/* Bot typing indicator */}
                    {isBotTyping && (
                        <div className="flex items-center gap-2 pl-14 text-muted-foreground">
                            <div className="flex space-x-1">
                                <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0s" }}></div>
                                <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0.2s" }}></div>
                                <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0.4s" }}></div>
                            </div>
                            <span className="text-xs">Bot is typing...</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>
            {/* Participants panel */}
            {showParticipants && (
                <div className="w-80 border-l border-border">
                    <ParticipantsList
                        roomId={roomId}
                        onClose={() => setShowParticipants(false)}
                    />
                </div>
            )}
        </div>

        {/* Message input */}
        <div className="px-4 pb-6 pt-2">
            <form onSubmit={handleSendMessage} className="relative">
                <div className="flex items-center bg-secondary/70 rounded-md px-1 focus-within:ring-1 focus-within:ring-primary">

                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={`Message #${room?.title}`}
                        className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    />

                    <div className="flex items-center gap-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowGifPicker((prev) => !prev)}
                                    >
                                        <Gift className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Send GIF</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Button
                            type="submit"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-primary text-primary-foreground"
                            disabled={!newMessage.trim() || uploadingFile}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

            </form>
        </div>


        {/* GIF Picker */}
        {showGifPicker && (
            <div className="fixed bottom-20 right-4 w-80 h-96 bg-card border border-border rounded-md shadow-lg z-10">
                <GifPicker onSelect={handleSendGif} onClose={() => setShowGifPicker(false)} />
            </div>
        )}
    </div>
}

const Page = () => {
    const { roomId } = useParams()
    return (
        <MessagesPage roomId={roomId as string} />
    )
}

export default Page;