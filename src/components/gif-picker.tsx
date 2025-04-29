"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, X } from "lucide-react"

// Replace with your actual Tenor API key
const TENOR_API_KEY = "AIzaSyAmK07jT-b1iT4bkncT5yzE5s6jtQ4T4Yg"
const TENOR_CLIENT_KEY = "fir-chat-e7e3e"

type GifPickerProps = {
    onSelect: (gif: { url: string; title: string }) => void
    onClose: () => void
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [gifs, setGifs] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    // Function to search for GIFs
    const searchGifs = async (query = "") => {
        setLoading(true)
        try {
            // In a real implementation, you would use the Tenor API
            const endpoint = query
                ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=20`
                : `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=20`;

            const response = await fetch(endpoint);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to fetch GIFs")
            }
            setGifs(data.results);

        } catch (error) {
            console.error("Error fetching GIFs:", error)
        } finally {
            setLoading(false)
        }
    }

    // Load trending GIFs on mount
    useEffect(() => {
        searchGifs()
    }, [])

    // Handle search input
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        searchGifs(searchQuery)
    }

    // Handle GIF selection
    const handleSelectGif = (gif: any) => {
        onSelect({
            url: gif.media_formats.gif.url,
            title: gif.title,
        })
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-medium">GIF Picker</h3>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <form onSubmit={handleSearch} className="p-3 border-b">
                <div className="relative">
                    <Input
                        placeholder="Search GIFs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                    />
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
            </form>

            <ScrollArea className="flex-1 p-3 h-full overflow-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {gifs.map((gif) => (
                            <div
                                key={gif.id}
                                className="cursor-pointer rounded-md overflow-hidden hover:opacity-80 transition-opacity"
                                onClick={() => handleSelectGif(gif)}
                            >
                                <img
                                    src={gif.media_formats.tinygif.url || "/placeholder.svg"}
                                    alt={gif.title}
                                    className="w-full h-32 object-cover"
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}
