import { useState } from 'react';
import NewsFeed from '../components/newsfeed';
import QueryInput from '../components/queryInput';
import SpaceBackground from '../components/spaceBackground';
import type { Article } from '../../server/model/article';

const API_ENDPOINT = 'http://localhost:3000/api/news-query';

export function App() {
  const [newsFeed, setNewsFeed] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuerySubmit = async (fullQuery: string) => {
    setError(null);
    setIsLoading(true);
    setNewsFeed([]);

    console.log(`Sending query to backend: "${fullQuery}"`);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // CHANGE: query -> userQuery
        body: JSON.stringify({ userQuery: fullQuery }),
      });

      console.log(fullQuery);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Server error! Status: ${response.status}. Details: ${errorText}`
        );
      }

      const data = await response.json();

      if (data && Array.isArray(data)) {
        const sortedData = data
          .filter((a) => a.summary)
          .sort(
            (a, b) =>
              new Date(b.publishedDate).getTime() -
              new Date(a.publishedDate).getTime()
          );
        setNewsFeed(sortedData);
      } else {
        setError('LLM returned an invalid or empty response structure.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      if (err instanceof Error) {
        setError(`Failed to process request: ${err.message}.`);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative font-['Inter']">
      <SpaceBackground />
      <div
        className='relative z-10 min-h-screen flex flex-col items-center p-4'
        style={{ color: '#E0F7FA' }}
      >
        <div className='w-full max-w-4xl'>
          <h1 className='text-4xl font-extrabold text-cyan-400 mb-8 text-center pt-4 tracking-wider'>
            Sigment Reader
          </h1>
          <QueryInput isLoading={isLoading} onSubmit={handleQuerySubmit} />
          <NewsFeed newsFeed={newsFeed} isLoading={isLoading} error={error} />
        </div>
      </div>
    </div>
  );
}

export default App;
