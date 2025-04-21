"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"

type User = {
    id: string
    username: string
    email: string
    profilePicture?: string
    phoneNumber?: string
    address?: string
    blockedUsers?: string[]
}

type AuthContextType = {
    user: User | null
    isLoading: boolean
    signIn: (email: string, password: string) => Promise<void>
    signUp: (userData: Partial<User> & { password: string }) => Promise<void>
    signOut: () => void
    updateProfile: (userData: Partial<User>) => Promise<void>
    blockUser: (userId: string) => Promise<void>
    unblockUser: (userId: string) => Promise<void>
    isUserBlocked: (userId: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Check if user is logged in from localStorage
        const storedUser = localStorage.getItem("user")
        if (storedUser) {
            setUser(JSON.parse(storedUser))
        }
        setIsLoading(false)

        // In a real Firebase implementation, you would use onAuthStateChanged
        // const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        //   if (firebaseUser) {
        //     const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        //     if (userDoc.exists()) {
        //       setUser({
        //         id: firebaseUser.uid,
        //         ...userDoc.data() as Omit<User, 'id'>
        //       });
        //     }
        //   } else {
        //     setUser(null);
        //   }
        //   setIsLoading(false);
        // });

        // return () => unsubscribe();
    }, [])

    const signIn = async (email: string, password: string) => {
        // Mock authentication - in a real app, this would call Firebase
        setIsLoading(true)
        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000))

            // In a real implementation, you would use Firebase auth
            // const firebaseUser = await firebaseSignIn(email, password);
            // const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            // const userData = userDoc.data();

            // Mock user data - in a real app, this would come from Firebase
            const mockUser: User = {
                id: "user-1",
                username: email.split("@")[0],
                email,
                profilePicture: `/placeholder.svg?height=200&width=200`,
                blockedUsers: [],
            }

            setUser(mockUser)
            localStorage.setItem("user", JSON.stringify(mockUser))
        } finally {
            setIsLoading(false)
        }
    }

    const signUp = async (userData: Partial<User> & { password: string }) => {
        setIsLoading(true)
        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000))

            // In a real implementation, you would use Firebase auth
            // const firebaseUser = await createUser(userData.email!, userData.password, {
            //   username: userData.username || userData.email!.split("@")[0],
            //   profilePicture: userData.profilePicture || `/placeholder.svg?height=200&width=200`,
            //   phoneNumber: userData.phoneNumber,
            //   address: userData.address,
            // });

            // Mock user creation
            const newUser: User = {
                id: `user-${Date.now()}`,
                username: userData.username || userData.email!.split("@")[0],
                email: userData.email!,
                profilePicture: userData.profilePicture || `/placeholder.svg?height=200&width=200`,
                phoneNumber: userData.phoneNumber,
                address: userData.address,
                blockedUsers: [],
            }

            setUser(newUser)
            localStorage.setItem("user", JSON.stringify(newUser))
        } finally {
            setIsLoading(false)
        }
    }

    const signOut = () => {
        // In a real implementation, you would use Firebase auth
        // await firebaseSignOut();

        setUser(null)
        localStorage.removeItem("user")
    }

    const updateProfile = async (userData: Partial<User>) => {
        setIsLoading(true)
        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000))

            // In a real implementation, you would update Firebase
            // if (user) {
            //   await updateUserProfile(user.id, userData);
            // }

            if (user) {
                const updatedUser = { ...user, ...userData }
                setUser(updatedUser)
                localStorage.setItem("user", JSON.stringify(updatedUser))
            }
        } finally {
            setIsLoading(false)
        }
    }

    const blockUser = async (userId: string) => {
        if (!user) return

        // In a real implementation, you would update Firebase
        // await blockUser(user.id, userId);

        const blockedUsers = [...(user.blockedUsers || []), userId]
        const updatedUser = { ...user, blockedUsers }
        setUser(updatedUser)
        localStorage.setItem("user", JSON.stringify(updatedUser))
    }

    const unblockUser = async (userId: string) => {
        if (!user || !user.blockedUsers) return

        // In a real implementation, you would update Firebase
        // await unblockUser(user.id, userId);

        const blockedUsers = user.blockedUsers.filter((id) => id !== userId)
        const updatedUser = { ...user, blockedUsers }
        setUser(updatedUser)
        localStorage.setItem("user", JSON.stringify(updatedUser))
    }

    const isUserBlocked = (userId: string) => {
        return user?.blockedUsers?.includes(userId) || false
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                signIn,
                signUp,
                signOut,
                updateProfile,
                blockUser,
                unblockUser,
                isUserBlocked,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
