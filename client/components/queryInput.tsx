import React, { useState } from 'react';

interface QueryInputProps {
  isLoading: boolean;
  onSubmit: (query: string) => void;
}

const QueryInput: React.FC<QueryInputProps> = ({ isLoading, onSubmit }) => {
  const [topicQuery, setTopicQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(topicQuery);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='bg-gray-800/95 p-6 md:p-8 rounded-xl shadow-2xl mb-12 border border-cyan-800 backdrop-blur-sm'
    >
      <p className='text-gray-400 text-sm mb-4'>Input your query</p>
      <div className='flex flex-col md:flex-row gap-4 mb-4'>
        <div className='flex-grow'>
          <label
            htmlFor='topic-input'
            className='block text-sm font-medium text-gray-300 mb-1'
          >
            Topic Query
          </label>
          <input
            id='topic-input'
            type='text'
            value={topicQuery}
            onChange={(e) => setTopicQuery(e.target.value)}
            placeholder='What news are you looking for?'
            className='w-full p-3 border border-gray-600 bg-gray-900 text-white rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 shadow-inner'
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <button
        type='submit'
        className={`w-full py-3 px-4 rounded-lg text-black font-semibold shadow-lg transition duration-150 flex items-center justify-center ${
          isLoading
            ? 'bg-cyan-600/50 cursor-not-allowed'
            : 'bg-cyan-400 hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900'
        }`}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <svg
              className='animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900'
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
            Deploying Agent...
          </>
        ) : (
          'Deploy Agent'
        )}
      </button>
    </form>
  );
};

export default QueryInput;
