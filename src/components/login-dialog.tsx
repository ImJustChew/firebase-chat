"use client"
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auth, db, storage } from '@/config/firebase';
import { Dialog, DialogTitle } from '@radix-ui/react-dialog';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthState, useCreateUserWithEmailAndPassword, useSignInWithEmailAndPassword, useSignInWithGoogle } from 'react-firebase-hooks/auth';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { initUserBotRoom } from '@/services/bot-service';
import { useNavigate } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Cropper, { Area, Point } from "react-easy-crop";
import { Separator } from '@/components/ui/separator';

// Schema for SignIn form
const signInSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters")
});

// Schema for SignUp form
const signUpSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

// Schema for Profile Completion
const profileCompletionSchema = z.object({
    username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(20, "Username cannot exceed 20 characters")
        .regex(/^[a-z0-9_-]+$/, "Username can only contain lowercase letters, numbers, underscores, and hyphens")
        .transform(val => val.toLowerCase()),
    phoneNumber: z.string().optional(),
    address: z.string().optional(),
});

function SignInForm() {
    const [signIn, registered, loading, error] = useSignInWithEmailAndPassword(auth);
    const [signInWithGoogle, googleUser, googleLoading, googleError] = useSignInWithGoogle(auth);

    const form = useForm<z.infer<typeof signInSchema>>({
        resolver: zodResolver(signInSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const onSubmit = async (values: z.infer<typeof signInSchema>) => {
        try {
            const user = await signIn(values.email, values.password);
            if (!user) {
                throw new Error("User not found");
            }
            toast("Successfully signed in");
        } catch (error) {
            toast("Error signing in", {
                description: "Please check your email and password",
                action: {
                    label: "Retry",
                    onClick: () => {
                        form.reset();
                    },
                },
            });
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            await signInWithGoogle();
            toast("Google sign-in successful");
        } catch (error) {
            toast("Error signing in with Google");
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel className="text-sm font-medium">EMAIL</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="your@email.com"
                                    type="email"
                                    {...field}
                                    className="border-none bg-accent"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <div className="flex justify-between items-center">
                                <FormLabel className="text-sm font-medium">PASSWORD</FormLabel>
                                <button type="button" className="text-xs text-primary hover:underline">
                                    Forgot Password?
                                </button>
                            </div>
                            <FormControl>
                                <Input
                                    type="password"
                                    {...field}
                                    className="bg-accent border-none"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                </Button>
                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
                    </div>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {googleLoading ? "Signing in..." : "Google"}
                </Button>
            </form>
        </Form>
    );
}

function SignUpForm() {
    const [createUserWithEmailAndPassword, user, loading, error] = useCreateUserWithEmailAndPassword(auth);
    const [signInWithGoogle, googleUser, googleLoading, googleError] = useSignInWithGoogle(auth);

    const form = useForm<z.infer<typeof signUpSchema>>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    const onSubmit = async (values: z.infer<typeof signUpSchema>) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(values.email, values.password);
            if (!userCredential) {
                throw new Error("User creation failed");
            }

            // No longer storing profile data at signup
            // The profile completion dialog will be shown automatically
            toast("Account created successfully");
        } catch (error) {
            toast("Error creating account");
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            await signInWithGoogle();
            toast("Google sign-in successful");
        } catch (error) {
            toast("Error signing in with Google");
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel className="text-sm font-medium">EMAIL</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="your@email.com"
                                    type="email"
                                    {...field}
                                    className="bg-accent border-none"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel className="text-sm font-medium">PASSWORD</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    {...field}
                                    className="bg-accent border-none"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel className="text-sm font-medium">CONFIRM PASSWORD</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    {...field}
                                    className="bg-accent border-none"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Sign Up"}
                </Button>

                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
                    </div>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {googleLoading ? "Signing in..." : "Google"}
                </Button>
            </form>
        </Form>
    );
}

function ProfileCompletionForm({ user, onProfileComplete }: { user: any; onProfileComplete: () => void }) {
    const form = useForm<z.infer<typeof profileCompletionSchema>>({
        resolver: zodResolver(profileCompletionSchema),
        defaultValues: {
            username: "",
            phoneNumber: "",
            address: "",
        },
    });
    const navigate = useNavigate();
    const [profileImage, setProfileImage] = useState<File | null>(null);
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showCropper, setShowCropper] = useState(false);
    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(user.photoURL || null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Try to get display name from Google auth if available
    useEffect(() => {
        if (user.displayName) {
            // Convert to lowercase and remove spaces/special characters
            const formattedUsername = user.displayName
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, "")
                .substring(0, 20);

            form.setValue("username", formattedUsername);
        }
    }, [user, form]);

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.size <= 5 * 1024 * 1024) { // 5 MB limit
            setProfileImage(file);
            setShowCropper(true);
            // Reset crop and zoom when a new image is selected
            setCrop({ x: 0, y: 0 });
            setZoom(1);
        } else if (file) {
            toast("File size exceeds 5 MB");
        }
    };

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const cancelCrop = () => {
        setProfileImage(null);
        setShowCropper(false);
    };

    const uploadCroppedImage = async () => {
        if (!profileImage || !croppedAreaPixels || !user) return;

        try {
            setIsUploading(true);

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();
            img.src = URL.createObjectURL(profileImage);

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
            await uploadBytes(storageRef, blob);

            const downloadURL = await getDownloadURL(storageRef);
            setProfilePictureUrl(downloadURL);
            setShowCropper(false);
            toast("Profile picture uploaded successfully");
        } catch (error) {
            console.error("Error uploading profile picture:", error);
            toast("Failed to upload profile picture");
        } finally {
            setIsUploading(false);
        }
    };

    const onSubmit = async (values: z.infer<typeof profileCompletionSchema>) => {
        // Check if profile picture URL exists
        if (!profilePictureUrl) {
            toast.error("Please upload a profile picture");
            return;
        }

        try {
            await setDoc(
                doc(db, "users", user.uid),
                {
                    username: values.username,
                    email: user.email,
                    phoneNumber: values.phoneNumber || "",
                    address: values.address || "",
                    profileCompleted: true,
                    profilePicture: profilePictureUrl
                },
                { merge: true }
            );

            // Create a romantic_bot chat room for the user (specifically passing "romantic_bot")
            await initUserBotRoom(user.uid, (roomId) => {
                navigate(`/${roomId}`);
            }, "romantic_bot");
            toast("Profile completed successfully! Your AI chat companion is ready.");
            onProfileComplete();
        } catch (error) {
            toast("Error completing profile");
        }
    };

    return (
        <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Complete Your Profile</h2>
                <p className="text-muted-foreground">
                    We need a little more information before you can continue
                </p>
            </div>

            <div className="flex flex-col items-center justify-center mb-6">
                {!showCropper ? (
                    <div className="flex flex-col items-center">
                        <div
                            className="relative cursor-pointer group"
                            onClick={triggerFileInput}
                        >
                            <Avatar className="h-24 w-24 border-2 border-primary/20 group-hover:border-primary/50 transition-all">
                                <AvatarImage src={profilePictureUrl || undefined} />
                                <AvatarFallback>
                                    {form.getValues("username")?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                    <path d="M12 20h9"></path>
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                </svg>
                            </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Profile picture <span className="text-destructive">*</span>
                            <span className="block">{profilePictureUrl ? "Click to change" : "Click to add (required)"}</span>
                        </p>
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
                    <div className="space-y-4 w-full">
                        <div className="relative w-full h-64">
                            <Cropper
                                image={profileImage ? URL.createObjectURL(profileImage) : ""}
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

            <Separator />

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel className="text-sm font-medium">
                                    USERNAME<span className="text-destructive">*</span>
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="johndoe"
                                        {...field}
                                        className="bg-accent border-none"
                                    />
                                </FormControl>
                                <FormDescription className="text-xs">
                                    This is how others will see you in the chat. Lowercase letters, numbers, underscores, and hyphens only.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel className="text-sm font-medium">PHONE NUMBER (OPTIONAL)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="tel"
                                        placeholder="+886 912 345 678"
                                        {...field}
                                        className="bg-accent border-none"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel className="text-sm font-medium">ADDRESS (OPTIONAL)</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Hsinchu, Taiwan"
                                        {...field}
                                        className="bg-accent border-none"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? "Completing Profile..." : "Complete Profile"}
                    </Button>
                </form>
            </Form>
        </div >
    );
}

const LoginDialog = () => {
    const [user, loading, error] = useAuthState(auth);
    const [open, setOpen] = useState(false);
    const [dialogState, setDialogState] = useState<'login' | 'profile-completion'>('login');
    const [checkingProfile, setCheckingProfile] = useState(false);

    useEffect(() => {
        const checkUserProfile = async (user: any) => {
            setCheckingProfile(true);
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const userData = userDoc.data();

                // User is fully set up if doc exists, has profileCompleted flag, and has username
                const isProfileComplete = userDoc.exists() &&
                    userData?.profileCompleted === true &&
                    userData?.username &&
                    userData.username.trim() !== '';

                if (!isProfileComplete) {
                    setDialogState('profile-completion');
                    setOpen(true);
                } else {
                    // User is properly set up, close the dialog
                    setOpen(false);
                }
            } catch (error) {
                console.error("Error checking user profile:", error);
                setDialogState('profile-completion');
                setOpen(true);
            } finally {
                setCheckingProfile(false);
            }
        };

        if (!loading) {
            if (user) {
                checkUserProfile(user);
            } else {
                // No user, show login dialog
                setOpen(true);
                setDialogState('login');
                setCheckingProfile(false);
            }
        }
    }, [loading, user]);

    // Handler for profile completion
    const handleProfileComplete = () => {
        setOpen(false);
    };

    // Don't show dialog when checking profile to prevent flashing
    if (loading || checkingProfile) return null;

    return (
        <Dialog open={open}>
            <DialogContent className={dialogState === 'profile-completion' ? "sm:max-w-md" : ""} hideCloseButton={true}>
                <DialogTitle className={dialogState === 'login' ? "hidden" : "sr-only"}>
                    Complete Your Profile
                </DialogTitle>
                {user && dialogState === 'profile-completion' ? (
                    <ProfileCompletionForm user={user} onProfileComplete={handleProfileComplete} />
                ) : (
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
                )}
            </DialogContent>
        </Dialog>
    )
}

export default LoginDialog;