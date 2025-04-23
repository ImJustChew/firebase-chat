"use client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { useEffect, useState } from "react"
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { LogOut, UserX } from "lucide-react";
import {
    useUserDoc,
    useUpdateUserProfile,
    useGetUserById,
    useUnblockUser,
    useGetBlockedUsers
} from '@/hooks/firestore';
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/config/firebase";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { toast } from "sonner";

function ProfileEditor() {
    const [user] = useAuthState(auth)
    const [userProfile] = useUserDoc()

    const updateUserProfile = useUpdateUserProfile();
    const [isLoading, setIsLoading] = useState(false)

    const [formData, setFormData] = useState({
        username: userProfile?.username || "",
        email: user?.email || "",
        phoneNumber: userProfile?.phoneNumber || "",
        address: userProfile?.address || "",
    })

    useEffect(() => {
        if (userProfile) {
            setFormData({
                username: userProfile.username || "",
                email: user?.email || "",
                phoneNumber: userProfile.phoneNumber || "",
                address: userProfile.address || "",
            })
        }
    }, [userProfile, user])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            setIsLoading(true)
            await updateUserProfile({
                username: formData.username,
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                address: formData.address,
            })
            setIsLoading(false)

            toast("Profile updated")
        } catch (error) {
            toast("Error updating profile");
        }
    }

    if (!user) return null

    return (
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" value={formData.username} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
            </div>

            <Separator />

            <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    placeholder="+1 (555) 123-4567"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="123 Main St, City, Country"
                />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
            </Button>
        </form>
    )
}

function BlockedUsersList() {
    const [blockedUserProfiles, setBlockedUserProfiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const getBlockedUsers = useGetBlockedUsers();
    const unblockUser = useUnblockUser();
    const [userProfile] = useUserDoc();

    const fetchBlockedUsers = async () => {
        setIsLoading(true);
        try {
            const blockedUsers = await getBlockedUsers();
            setBlockedUserProfiles(blockedUsers);
        } catch (error) {
            console.error("Error fetching blocked users:", error);
            toast("Failed to load blocked users");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBlockedUsers();
    }, [userProfile?.blockedUsers]);

    const handleUnblock = async (userId: string) => {
        try {
            await unblockUser(userId);
            toast("User unblocked successfully");
            fetchBlockedUsers();
        } catch (error) {
            toast("Failed to unblock user");
        }
    };

    if (isLoading) {
        return <div className="py-8 text-center text-muted-foreground">Loading blocked users...</div>;
    }

    if (!blockedUserProfiles.length) {
        return <div className="py-8 text-center text-muted-foreground">You haven't blocked any users</div>;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium">Blocked Users</h3>
            <div className="space-y-2">
                {blockedUserProfiles.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={profile.profilePicture || "/placeholder.svg"} />
                                <AvatarFallback>{profile.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-sm font-medium">{profile.username}</p>
                                <p className="text-xs text-muted-foreground">{profile.email}</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnblock(profile.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            Unblock
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}

const ProfileDialog = ({ children }: { children: React.ReactNode }) => {
    const [user] = useAuthState(auth);
    const [userProfile] = useUserDoc();

    return (
        <Dialog>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>User Settings</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="profile">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                        <TabsTrigger value="account">Account</TabsTrigger>
                        <TabsTrigger value="blocked">
                            <UserX className="h-4 w-4 mr-2" />
                            Blocked
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="profile">
                        <ProfileEditor />
                    </TabsContent>
                    <TabsContent value="account">
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium">
                                    EMAIL
                                </Label>
                                <Input id="email" value={userProfile?.email} className="bg-secondary/50 border-none" readOnly />
                            </div>

                            <Separator />

                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button variant="outline" onClick={() => auth.signOut()} className="w-full sm:w-auto">
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Sign Out
                                </Button>
                            </DialogFooter>
                        </div>
                    </TabsContent>
                    <TabsContent value="blocked">
                        <BlockedUsersList />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

export default ProfileDialog;