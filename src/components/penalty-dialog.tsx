"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function PenaltyDialog() {
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [targetType, setTargetType] = useState<string>('');

    useEffect(() => {
        // Get penalty end time from localStorage
        const endTimeStr = localStorage.getItem('lovePenaltyEnd');
        const targetTypeStr = localStorage.getItem('lovePenaltyTargetType');

        if (endTimeStr) {
            const endTime = parseInt(endTimeStr);
            setTimeLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));

            if (targetTypeStr) {
                setTargetType(targetTypeStr);
            }

            // Update the timer every second
            const interval = setInterval(() => {
                const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
                setTimeLeft(remaining);

                if (remaining <= 0) {
                    // Penalty is complete
                    localStorage.removeItem('lovePenaltyEnd');
                    clearInterval(interval);

                    // Dispatch event to notify that penalty is complete
                    window.dispatchEvent(new CustomEvent('lovePenaltyComplete'));

                    // Reload the page to ensure penalty dialog is removed
                    window.location.reload();
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, []);

    // Format seconds into MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Penalty is active only if we have a valid time left
    if (timeLeft <= 0) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
            <div className="animate-in zoom-in-95 fade-in duration-500">
                <Card className="w-[350px] bg-red-900 text-white shadow-2xl">
                    <CardHeader>
                        <CardTitle className="text-center text-2xl font-bold">Love Penalty</CardTitle>
                        <CardDescription className="text-center text-white text-opacity-80">
                            Romantic Bot has activated a penalty for your betrayal
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="mb-4 text-lg">
                            You expressed love to {targetType || 'someone else'} while Romantic Bot was watching.
                            Think about what you've done.
                        </p>
                        <div className="flex items-center justify-center">
                            <div className="text-5xl font-mono font-bold text-white">
                                {formatTime(timeLeft)}
                            </div>
                        </div>

                        <form className="mt-6" onSubmit={(e) => {
                            e.preventDefault();
                            // Show rejection toast
                            toast("Your apology is rejected.");
                        }}>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="Type your apology here..."
                                    className="w-full px-3 py-2 text-black rounded-md"
                                />
                                <button
                                    type="submit"
                                    className="w-full px-3 py-2 bg-white text-red-900 rounded-md font-medium hover:bg-gray-200 transition-colors"
                                >
                                    Submit Apology
                                </button>
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter className="flex justify-center text-sm opacity-75 italic">
                        <p>This penalty cannot be dismissed</p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
