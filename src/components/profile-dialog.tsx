"use client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useEffect, useState, useCallback, useRef } from "react";
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
import { auth, storage } from "@/config/firebase";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { toast } from "sonner";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Cropper, { Area, Point } from "react-easy-crop";

function ProfileEditor() {
    const [user] = useAuthState(auth);
    const [userProfile] = useUserDoc();

    const updateUserProfile = useUpdateUserProfile();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        username: userProfile?.username || "",
        email: user?.email || "",
        phoneNumber: userProfile?.phoneNumber || "",
        address: userProfile?.address || "",
    });

    useEffect(() => {
        if (userProfile) {
            setFormData({
                username: userProfile.username || "",
                email: user?.email || "",
                phoneNumber: userProfile.phoneNumber || "",
                address: userProfile.address || "",
            });
        }
    }, [userProfile, user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setIsLoading(true);
            await updateUserProfile({
                username: formData.username,
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                address: formData.address,
            });
            setIsLoading(false);

            toast("Profile updated");
        } catch (error) {
            toast("Error updating profile");
        }
    };

    if (!user) return null;

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
    );
}

function ProfilePictureUploader() {
    const [user] = useAuthState(auth);
    const [userProfile] = useUserDoc();
    const [image, setImage] = useState<File | null>(null);
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showCropper, setShowCropper] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const updateUserProfile = useUpdateUserProfile();

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.size <= 5 * 1024 * 1024) { // 5 MB limit
            setImage(file);
            setShowCropper(true);
            // Reset crop and zoom when a new image is selected
            setCrop({ x: 0, y: 0 });
            setZoom(1);
        } else if (file) {
            toast("File size exceeds 5 MB");
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const uploadCroppedImage = async () => {
        if (!image || !croppedAreaPixels || !user) return;

        try {
            setIsUploading(true);

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();
            img.src = URL.createObjectURL(image);

            await new Promise((resolve) => {
                img.onload = resolve;
            });

            const { width, height, x, y } = croppedAreaPixels;
            canvas.width = width;
            canvas.height = height;
            ctx?.drawImage(img, x, y, width, height, 0, 0, width, height);

            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
            if (!blob) throw new Error("Failed to create blob");

            const storageRef = ref(storage, `profilePic/${user.uid}`);
            await uploadBytes(storageRef, blob, {
                // 10 minutes cache for the image
                cacheControl: "public,max-age=600",
            });

            const downloadURL = await getDownloadURL(storageRef);

            // Update user profile document and auth object
            await updateUserProfile({ profilePicture: downloadURL });
            toast("Profile picture updated successfully");
            setShowCropper(false);
        } catch (error) {
            console.error("Error uploading profile picture:", error);
            toast("Failed to upload profile picture");
        } finally {
            setIsUploading(false);
        }
    };

    const cancelCrop = () => {
        setImage(null);
        setShowCropper(false);
    };

    return (
        <div className="space-y-4 py-4">
            {!showCropper ? (
                <div className="flex flex-col items-center justify-center">
                    <div
                        className="relative cursor-pointer group"
                        onClick={triggerFileInput}
                    >
                        <Avatar className="h-24 w-24 border-2 border-primary/20 group-hover:border-primary/50 transition-all">
                            <AvatarImage src={userProfile?.profilePicture} />
                            <AvatarFallback>{userProfile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                        </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Click to change profile picture</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        aria-label="Upload profile picture"
                    />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="relative w-full h-64">
                        <Cropper
                            image={image ? URL.createObjectURL(image) : ""}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                        />
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label htmlFor="zoom" className="text-sm">Zoom: {zoom.toFixed(1)}x</label>
                            <input
                                id="zoom"
                                type="range"
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Drag the image to adjust the crop area</p>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={cancelCrop} disabled={isUploading}>
                            Cancel
                        </Button>
                        <Button onClick={uploadCroppedImage} disabled={isUploading}>
                            {isUploading ? "Uploading..." : "Save"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
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
                        <ProfilePictureUploader />
                        <Separator className="my-4" />
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
    );
};

export default ProfileDialog;