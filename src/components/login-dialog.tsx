"use client"
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auth, db } from '@/config/firebase';
import { Dialog, DialogTitle } from '@radix-ui/react-dialog';
import { doc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuthState, useCreateUserWithEmailAndPassword, useSignInWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { toast } from 'sonner';

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

export default LoginDialog;