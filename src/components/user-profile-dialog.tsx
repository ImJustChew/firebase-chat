"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useState } from "react";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useUserDocById, useBlockUser, useIsUserBlocked } from '@/hooks/firestore';
import { Button } from "./ui/button";
import { Ban } from "lucide-react";
import { toast } from "sonner";

interface UserProfileDialogProps {
    userId: string;
    children: React.ReactNode;
    onBlock?: (userId: string) => void;
}

const UserProfileDialog = ({ userId, children, onBlock }: UserProfileDialogProps) => {
    const [userProfile, loading, error] = useUserDocById(userId);
    const blockUser = useBlockUser();
    const isUserBlocked = useIsUserBlocked();
    const [open, setOpen] = useState(false);

    // Check if the user is blocked
    const blocked = userId ? isUserBlocked(userId) : false;

    const handleBlockUser = async () => {
        try {
            await blockUser(userId);
            toast.success("User blocked successfully");

            if (onBlock) {
                onBlock(userId);
            }

            setOpen(false); // Close dialog after blocking
        } catch (error) {
            console.error("Error blocking user:", error);
            toast.error("Failed to block user");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>User Profile</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="profile">
                    <TabsList className="grid w-full grid-cols-1 mb-4">
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile">
                        {loading ? (
                            <div className="flex justify-center items-center py-8">
                                <div className="animate-pulse text-center">
                                    <div className="mx-auto h-16 w-16 rounded-full bg-secondary mb-4"></div>
                                    <div className="h-4 w-32 mx-auto bg-secondary rounded"></div>
                                    <div className="h-3 w-40 mx-auto bg-secondary rounded mt-3"></div>
                                </div>
                            </div>
                        ) : userProfile ? (
                            <div className="space-y-4">
                                <div className="flex flex-col items-center justify-center py-4">
                                    <Avatar className="h-24 w-24 mb-4">
                                        <AvatarImage src={userProfile.profilePicture || "/placeholder.svg"} alt={userProfile.username} />
                                        <AvatarFallback>{userProfile.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                                    </Avatar>
                                    <h3 className="text-xl font-semibold">{userProfile.username}</h3>
                                </div>

                                <Separator />

                                <div className="space-y-4 py-2">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-muted-foreground">
                                            EMAIL
                                        </Label>
                                        <div className="bg-secondary/50 px-3 py-2 rounded-md">
                                            {userProfile.email || "No email provided"}
                                        </div>
                                    </div>

                                    {userProfile.phoneNumber && (
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium text-muted-foreground">
                                                PHONE
                                            </Label>
                                            <div className="bg-secondary/50 px-3 py-2 rounded-md">
                                                {userProfile.phoneNumber}
                                            </div>
                                        </div>
                                    )}

                                    {userProfile.address && (
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium text-muted-foreground">
                                                LOCATION
                                            </Label>
                                            <div className="bg-secondary/50 px-3 py-2 rounded-md">
                                                {userProfile.address}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                <div className="py-2">
                                    <Button
                                        variant="destructive"
                                        className="w-full"
                                        onClick={handleBlockUser}
                                        disabled={blocked}
                                    >
                                        <Ban className="h-4 w-4 mr-2" />
                                        {blocked ? "User Blocked" : "Block User"}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p>User not found or profile is unavailable</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default UserProfileDialog;