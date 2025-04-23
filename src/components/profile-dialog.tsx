"use client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { useEffect, useState } from "react"
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { useUserDoc, useUpdateUserProfile } from '@/hooks/firestore';
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

    // Update the form data when userProfile changes
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
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                        <TabsTrigger value="account">Account</TabsTrigger>
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
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

export default ProfileDialog