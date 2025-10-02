import React from 'react';
import NewsFeedArticle from './newsFeedArticle';
import type { Article } from '../../server/model/article';

interface NewsFeedProps {
  newsFeed: Article[];
  isLoading: boolean;
  error: string | null;
}

const NewsFeed: React.FC<NewsFeedProps> = ({ newsFeed, isLoading, error }) => {
  return (
    <div className='w-full max-w-4xl'>
      <h2 className='text-3xl font-bold text-gray-100 mb-6 border-b border-cyan-600/50 pb-2'>
        Latest Summaries
      </h2>

      {isLoading && (
        <div className='p-10 bg-gray-900 rounded-xl text-center text-cyan-400 shadow-inner border border-cyan-800'>
          <svg
            className='animate-spin h-6 w-6 mx-auto mb-2 text-cyan-400'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
          >
            <circle
              className='opacity-25'
              cx='12'
              cy='12'
              r='10'
              stroke='currentColor'
              strokeWidth='4'
            ></circle>
            <path
              className='opacity-75'
              fill='currentColor'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
            ></path>
          </svg>
          <p>Processing data transmission...</p>
        </div>
      )}

      {error && (
        <div
          className='bg-red-900/30 border border-red-500 text-red-300 p-4 rounded-xl mb-8'
          role='alert'
        >
          <p className='font-bold'>Error:</p>
          <p className='text-sm'>{error}</p>
        </div>
      )}

      {newsFeed.length === 0 && !isLoading && !error && (
        <div className='p-10 bg-gray-800/95 rounded-xl text-center text-gray-400 shadow-inner border border-gray-700 backdrop-blur-sm'>
          <p>Awaiting incoming data stream...</p>
        </div>
      )}

      <div className='space-y-6'>
        {newsFeed.map((article) => (
          <NewsFeedArticle key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
};

export default NewsFeed;