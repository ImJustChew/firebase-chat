"use client";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sidebar, useSidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInput, SidebarProvider, SidebarInset, SidebarFooter } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth, db } from "@/config/firebase";
import { Dialog, DialogTitle } from "@radix-ui/react-dialog";
import { doc, FirestoreDataConverter, setDoc, Timestamp } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useAuthState, useCreateUserWithEmailAndPassword, useSignInWithEmailAndPassword } from "react-firebase-hooks/auth";
import { toast } from "sonner";
import { useCollectionData } from "react-firebase-hooks/firestore";
import { collection, query } from "firebase/firestore";
import { format, formatDistanceToNow } from "date-fns";
import { Attachment, useRoomDoc, useRoomMessagesCol, useRoomsCol, useUserDoc } from '@/hooks/firestore';
import { AtSign, Bot, File, Gift, Hash, ImageIcon, LogOut, Plus, Send, Smile, Trash2, Users, Video } from "lucide-react";
import CreateChatDialog from '@/components/create-chat-dialog';
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function SignInForm() {
  const [signIn, registered, loading, error] = useSignInWithEmailAndPassword(auth);
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const user = await signIn(email, password)
      if (!user) {
        throw new Error("User not found")
      }
      toast("Successfully signed in")
    } catch (error) {
      toast("Error signing in", {
        description: "Please check your email and password",
        action: {
          label: "Retry",
          onClick: () => {
            setEmail("")
            setPassword("")
          },
        },
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">
          EMAIL
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border-none bg-accent"
        />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="password" className="text-sm font-medium">
            PASSWORD
          </Label>
          <button type="button" className="text-xs text-primary hover:underline">
            Forgot Password?
          </button>
        </div>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="bg-accent border-none"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  )
}

function SignUpForm() {
  const [createUserWithEmailAndPassword, user, loading, error] = useCreateUserWithEmailAndPassword(auth);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    phoneNumber: "",
    address: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      toast("Passwords don't match")
      return
    }

    try {
      const user = await createUserWithEmailAndPassword(formData.email, formData.password)
      if (!user) {
        throw new Error("User creation failed")
      }
      await setDoc(
        doc(db, "users", user.user.uid),
        {
          username: formData.username,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          address: formData.address,
        }
      )
      toast("Account created successfully")
    } catch (error) {
      toast("Error creating account")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username" className="text-sm font-medium">
          USERNAME
        </Label>
        <Input
          id="username"
          name="username"
          placeholder="johndoe"
          value={formData.username}
          onChange={handleChange}
          required
          className="bg-accent border-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">
          EMAIL
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="your@email.com"
          value={formData.email}
          onChange={handleChange}
          required
          className="bg-accent border-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">
          PASSWORD
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          required
          className="bg-accent border-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-sm font-medium">
          CONFIRM PASSWORD
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          className="bg-accent border-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phoneNumber" className="text-sm font-medium">
          PHONE NUMBER (OPTIONAL)
        </Label>
        <Input
          id="phoneNumber"
          name="phoneNumber"
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={formData.phoneNumber}
          onChange={handleChange}
          className="bg-accent border-none"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account..." : "Sign Up"}
      </Button>
    </form>
  )
}



const LoginDialog = () => {
  const [user, loading, error] = useAuthState(auth);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (user) {
        setOpen(false);
      } else {
        setOpen(true);
      }
    }
  }, [loading, user]);

  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogTitle className="hidden">
          Login Dialog
        </DialogTitle>
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <SignInForm />
          </TabsContent>
          <TabsContent value="signup">
            <SignUpForm />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [rooms = [], loading, error] = useRoomsCol();
  const [user, loadingUser, errorUser] = useUserDoc();

  return (
    <Sidebar collapsible="none" className="h-screen">
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-base font-medium text-foreground">
            Messages
          </div>
          <div className="flex items-center gap-2">
            <CreateChatDialog>
              <Button variant="ghost" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </CreateChatDialog>
          </div>
        </div>
        <SidebarInput placeholder="Type to search..." />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            {rooms.map((room) => (
              <a
                href="#"
                key={room.id}
                className="flex flex-col items-start gap-1 whitespace-nowrap border-b p-3 text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <div className="flex w-full items-center gap-2">
                  <span className="font-medium">{room.title}</span>{" "}
                  {room.teaser && <span className="ml-auto text-xs">{formatDistanceToNow(room.teaser.date.toDate(), {})}</span>}
                </div>
                {room.teaser && <span className="line-clamp-2 w-[260px] whitespace-break-spaces text-xs">
                  {room.teaser.message}
                </span>}
              </a>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {user && <div className="flex w-full items-center justify-between border-t p-4">
          <div className="flex items-center gap-2">
            <img
              src={user?.photoURL || "/placeholder.svg?height=200&width=200"}
              alt="User Avatar"
              className="h-8 w-8 rounded-full"
            />
            <span className="text-sm font-medium">{user.username}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => auth.signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>}
      </SidebarFooter>
    </Sidebar>
  )
}

const AttachmentViewerDialog = ({ attachment, children }: { attachment: Attachment, children: React.ReactNode }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="fixed inset-0 flex items-center justify-center bg-black/80">
        <div className="flex flex-col items-center justify-center bg-card p-4 rounded-md">
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
const MessagesPage = () => {
  const roomId = "sI9xT6aGtSWfbBT5T0tZ";
  const isMobile = useIsMobile();
  const [room, loadingRoom, errorRoom] = useRoomDoc(roomId);
  const [messages = [], loading, error] = useRoomMessagesCol(roomId);
  const [user, loadingUser, errorUser] = useAuthState(auth);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileInputKey, setFileInputKey] = useState<number>(Date.now())
  const [uploadingFile, setUploadingFile] = useState<boolean>(false)

  const [newMessage, setNewMessage] = useState<string>("")
  const [showGifPicker, setShowGifPicker] = useState<boolean>(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])


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
  const handleDeleteMessage = (messageId: string) => {
    // Implement delete message logic here
    toast("Message deleted");

  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      // your send message logic here, e.g.:
      // await sendMessageToFirestore(newMessage)
      setNewMessage("")
    } catch (error) {
      toast("Error sending message")
    }
  }


  return <div className="flex-1 flex flex-col overflow-hidden">
    {/* Channel header */}
    <div className="h-12 px-4 flex items-center justify-between border-b border-border shadow-sm">
      <div className="flex items-center gap-2">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 mr-1"
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
          Room Name
        </h2>
      </div>

      <div className="flex items-center gap-2">
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

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
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
              const showHeader =
                !prevMessage ||
                prevMessage.user.id !== message.user.id ||
                message.timestamp.toMillis() - prevMessage.timestamp.toMillis() >
                5 * 60 * 1000

              // Skip messages from blocked users
              // if (isUserBlocked(message.sender)) return null

              return (
                <div key={message.id} className={`${showHeader ? "mt-4" : "mt-0.5 pl-14"} group`}>
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
                            {format(message.timestamp.toDate(), "MM/dd/yyyy h:mm a")}
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
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>

    {/* Message input */}
    <div className="px-4 pb-6 pt-2">
      <form onSubmit={handleSendMessage} className="relative">
        <div className="flex items-center bg-secondary/70 rounded-md px-4 focus-within:ring-1 focus-within:ring-primary">
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                  >
                    <Plus className="h-5 w-5" />
                    <input
                      aria-label="Upload File"
                      type="file"
                      ref={fileInputRef}
                      key={fileInputKey}
                      className="hidden"
                      accept="image/*,video/*,application/*"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upload File</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const input = document.createElement("input")
                      input.type = "file"
                      input.accept = "image/*"
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0]
                        if (file) {
                          handleFileUpload({ target: { files: [file] } } as any)
                        }
                      }
                      input.click()
                    }}
                    disabled={uploadingFile}
                  >
                    <ImageIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upload Image</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const input = document.createElement("input")
                      input.type = "file"
                      input.accept = "video/*"
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0]
                        if (file) {
                          handleFileUpload({ target: { files: [file] } } as any)
                        }
                      }
                      input.click()
                    }}
                    disabled={uploadingFile}
                  >
                    <Video className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upload Video</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

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

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-foreground"
                  >
                    <AtSign className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mention</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-foreground"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Emoji</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <Button
          type="submit"
          size="icon"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full bg-primary text-primary-foreground"
          disabled={!newMessage.trim() || uploadingFile}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>

    {/* GIF Picker
        {showGifPicker && (
          <div className="fixed bottom-20 right-4 w-80 h-96 bg-card border border-border rounded-md shadow-lg z-10">
            <GifPicker onSelect={handleSendGif} onClose={() => setShowGifPicker(false)} />
          </div>
        )} */}
  </div>
}

const Page = () => {

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "280px",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <LoginDialog />
      <SidebarInset>
        <MessagesPage />
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Page;