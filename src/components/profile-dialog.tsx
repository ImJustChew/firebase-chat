"use client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { useState } from "react"
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { useUserDoc } from "@/hooks/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/config/firebase";
import { DialogTrigger } from "@radix-ui/react-dialog";

// function ProfileEditor() {

//     const [formData, setFormData] = useState({
//         username: user?.username || "",
//         email: user?.email || "",
//         phoneNumber: user?.phoneNumber || "",
//         address: user?.address || "",
//         profilePicture: user?.profilePicture || "",
//     })

//     const [uploadingImage, setUploadingImage] = useState(false)

//     const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//         const { name, value } = e.target
//         setFormData((prev) => ({ ...prev, [name]: value }))
//     }

//     const handleSubmit = async (e: React.FormEvent) => {
//         e.preventDefault()

//         try {
//             await updateProfile({
//                 username: formData.username,
//                 email: formData.email,
//                 phoneNumber: formData.phoneNumber,
//                 address: formData.address,
//                 profilePicture: formData.profilePicture,
//             })

//             toast({
//                 title: "Profile updated",
//                 description: "Your profile has been updated successfully.",
//             })
//         } catch (error) {
//             toast({
//                 title: "Error updating profile",
//                 description: "Please try again later.",
//                 variant: "destructive",
//             })
//         }
//     }

//     const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
//         const files = e.target.files
//         if (!files || files.length === 0 || !user) return

//         const file = files[0]
//         setUploadingImage(true)

//         try {
//             // In a real implementation, you would upload to Firebase Storage
//             // const path = `users/${user.id}/profile-${Date.now()}.${file.name.split('.').pop()}`;
//             // const url = await uploadFile(file, path);

//             // For demo purposes, create a local object URL
//             const url = URL.createObjectURL(file)

//             setFormData((prev) => ({ ...prev, profilePicture: url }))

//             toast({
//                 title: "Image uploaded",
//                 description: "Your profile picture has been uploaded.",
//             })
//         } catch (error) {
//             toast({
//                 title: "Error uploading image",
//                 description: "Please try again later.",
//                 variant: "destructive",
//             })
//         } finally {
//             setUploadingImage(false)
//         }
//     }

//     if (!user) return null

//     return (
//         <form onSubmit={handleSubmit} className="space-y-4 py-2">
//             <div className="flex justify-center mb-4">
//                 <div className="relative">
//                     <Avatar className="h-24 w-24">
//                         <AvatarImage src={formData.profilePicture || "/placeholder.svg"} alt={formData.username} />
//                         <AvatarFallback>{formData.username.charAt(0).toUpperCase()}</AvatarFallback>
//                     </Avatar>
//                     <Button
//                         type="button"
//                         variant="secondary"
//                         size="sm"
//                         className="absolute bottom-0 right-0 rounded-full h-8 w-8 p-0"
//                         onClick={() => document.getElementById("profile-picture-upload")?.click()}
//                         disabled={uploadingImage}
//                     >
//                         {uploadingImage ? (
//                             <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
//                         ) : (
//                             <svg
//                                 xmlns="http://www.w3.org/2000/svg"
//                                 width="24"
//                                 height="24"
//                                 viewBox="0 0 24 24"
//                                 fill="none"
//                                 stroke="currentColor"
//                                 strokeWidth="2"
//                                 strokeLinecap="round"
//                                 strokeLinejoin="round"
//                                 className="h-4 w-4"
//                             >
//                                 <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
//                                 <path d="M12 12v9" />
//                                 <path d="m16 16-4-4-4 4" />
//                             </svg>
//                         )}
//                     </Button>
//                     <input
//                         type="file"
//                         id="profile-picture-upload"
//                         className="hidden"
//                         accept="image/*"
//                         onChange={handleImageUpload}
//                         disabled={uploadingImage}
//                     />
//                 </div>
//             </div>

//             <div className="space-y-2">
//                 <Label htmlFor="username">Username</Label>
//                 <Input id="username" name="username" value={formData.username} onChange={handleChange} required />
//             </div>

//             <div className="space-y-2">
//                 <Label htmlFor="email">Email</Label>
//                 <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
//             </div>

//             <Separator />

//             <div className="space-y-2">
//                 <Label htmlFor="phoneNumber">Phone Number</Label>
//                 <Input
//                     id="phoneNumber"
//                     name="phoneNumber"
//                     type="tel"
//                     value={formData.phoneNumber}
//                     onChange={handleChange}
//                     placeholder="+1 (555) 123-4567"
//                 />
//             </div>

//             <div className="space-y-2">
//                 <Label htmlFor="address">Address</Label>
//                 <Input
//                     id="address"
//                     name="address"
//                     value={formData.address}
//                     onChange={handleChange}
//                     placeholder="123 Main St, City, Country"
//                 />
//             </div>

//             <Button type="submit" className="w-full" disabled={isLoading}>
//                 {isLoading ? "Saving..." : "Save Changes"}
//             </Button>
//         </form>
//     )
// }

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
                    </TabsList>
                    <TabsContent value="profile">
                        {/* <ProfileEditor /> */}
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