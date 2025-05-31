import Chat from './components/Chat';

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Nekoly Chat
          </h1>
        </div>
      </header>
      <main>
        <Chat />
      </main>
    </div>
  );
}