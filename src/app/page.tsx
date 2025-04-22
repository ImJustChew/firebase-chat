const PlaceholderPage = () => {
    return (
        <div className="flex-col items-center justify-center min-h-screen bg-gray-100 p-4 hidden md:flex">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                <h2 className="text-2xl font-bold mb-4">Welcome</h2>
                <p className="text-gray-600 mb-6">
                    Create a chatroom to continue, you can create chats with the + button
                </p>
            </div>
        </div>
    )
}

export default PlaceholderPage