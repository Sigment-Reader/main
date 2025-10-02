import React from 'react';
import type { Article } from '../../server/model/article';

interface NewsFeedArticleProps {
  article: Article;
}

const NewsFeedArticle: React.FC<NewsFeedArticleProps> = ({ article }) => (
  <div className='bg-gray-800/95 p-6 md:p-8 rounded-xl shadow-2xl hover:shadow-cyan-400/30 transition duration-300 transform hover:-translate-y-0.5 border border-gray-700 backdrop-blur-sm'>
    <a
      href={article.url}
      target='_blank'
      rel='noopener noreferrer'
      className='block'
    >
      <h2 className='text-xl font-bold text-cyan-300 mb-2 hover:text-cyan-400 transition-colors'>
        {article.title}
      </h2>
    </a>
    <p className='text-sm text-gray-400 mb-2'>
      By {article.author || 'Unknown'} on{' '}
      {article.publishedDate ? new Date(article.publishedDate).toLocaleDateString() : 'Unknown Date'}
    </p>
    <div className='text-gray-200 leading-relaxed mb-4 border-l-4 border-cyan-500 pl-4 py-1 bg-gray-900/50 rounded-md'>
      <p className='font-semibold text-cyan-400 text-sm mb-1'>Summary:</p>
      <p>{article.summary}</p>
    </div>
    <a
      href={article.url}
      target='_blank'
      rel='noopener noreferrer'
      className='text-cyan-500 text-sm font-medium hover:text-cyan-400 flex items-center'
    >
      Access Transmission Log
      <svg
        xmlns='http://www.w3.org/2000/svg'
        className='h-4 w-4 ml-1'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M14 5l7 7m0 0l-7 7m7-7H3'
        />
      </svg>
    </a>
  </div>
);

export default NewsFeedArticle;