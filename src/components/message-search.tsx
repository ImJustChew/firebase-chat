import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import Fuse from 'fuse.js';
import { toast } from "sonner";
import { Message } from "@/hooks/firestore";

interface MessageSearchProps {
    messages: Message[]; // Array of messages to search through
}

export default function MessageSearch({ messages }: MessageSearchProps) {
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [searchResults, setSearchResults] = useState<Array<{ item: any; refIndex: number }>>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(0);
    const [showControls, setShowControls] = useState<boolean>(false);
    const [fuseInstance, setFuseInstance] = useState<Fuse<any> | null>(null);

    // Initialize or update Fuse instance when messages change
    useEffect(() => {
        if (messages.length > 0) {
            const options = {
                includeScore: true,
                keys: ["content", "user.username"],
                threshold: 0.4
            };

            if (fuseInstance) {
                fuseInstance.setCollection(messages);
            } else {
                setFuseInstance(new Fuse(messages, options));
            }
        }
    }, [messages, fuseInstance]);

    const handleSearch = () => {
        if (!searchQuery.trim() || !fuseInstance) {
            setSearchResults([]);
            setShowControls(false);
            return;
        }

        const results = fuseInstance.search(searchQuery);
        setSearchResults(results);
        setCurrentSearchIndex(results.length > 0 ? 0 : -1);
        setShowControls(results.length > 0);

        if (results.length > 0) {
            scrollToMessage(results[0].refIndex);
        } else {
            toast.info("No messages found");
        }
    };

    const handleClear = () => {
        setSearchQuery("");
        setSearchResults([]);
        setShowControls(false);
    };

    const scrollToMessage = (index: number) => {
        const messageElement = document.getElementById(`message-${messages[index].id}`);
        if (messageElement) {
            messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
            messageElement.classList.add("bg-primary/10");
            setTimeout(() => {
                messageElement.classList.remove("bg-primary/10");
            }, 2000);
        }
    };

    const navigateSearchResults = (direction: 'next' | 'prev') => {
        if (searchResults.length === 0) return;

        let newIndex;
        if (direction === 'next') {
            newIndex = (currentSearchIndex + 1) % searchResults.length;
        } else {
            newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        }

        setCurrentSearchIndex(newIndex);
        scrollToMessage(searchResults[newIndex].refIndex);
    };

    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <Input
                    placeholder="Search messages"
                    className="h-7 w-36 bg-secondary/50 border-none text-sm pl-7"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            handleSearch();
                        }
                    }}
                />
                <Search
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground cursor-pointer"
                    onClick={handleSearch}
                />
                {searchQuery && (
                    <X
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground cursor-pointer"
                        onClick={handleClear}
                    />
                )}
            </div>

            {showControls && (
                <div className="flex items-center gap-1 bg-secondary/50 rounded px-2 py-1">
                    <span className="text-xs text-muted-foreground">
                        {currentSearchIndex + 1}/{searchResults.length}
                    </span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => navigateSearchResults('prev')}
                                >
                                    <ChevronUp className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Previous result</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => navigateSearchResults('next')}
                                >
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Next result</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}
        </div>
    );
}

// Helper function to expose search results to parent component
export const useMessageSearchResults = () => {
    return (messageIndex: number, resultIndices: number[]): {
        isSearchResult: boolean;
        isCurrentResult: boolean;
    } => {
        const isSearchResult = resultIndices.includes(messageIndex);
        const isCurrentResult = resultIndices[0] === messageIndex;

        return {
            isSearchResult,
            isCurrentResult
        };
    };
};
