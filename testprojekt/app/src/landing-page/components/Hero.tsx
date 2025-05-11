import { routes } from 'wasp/client/router';
import { Link } from 'wasp/client/router';

export default function Hero() {
  return (
    <div className='relative pt-14 w-full'>
      <div className='py-24 sm:py-32'>
        <div className='mx-auto max-w-8xl px-6 lg:px-8'>
          <div className='lg:mb-18 mx-auto max-w-3xl text-center'>
            <h1 className='text-4xl font-bold text-gray-900 sm:text-6xl dark:text-white'>
              Generate Engaging <span className='text-yellow-500'>LinkedIn Comments</span> Instantly
            </h1>
            <p className='mt-6 mx-auto max-w-2xl text-lg leading-8 text-gray-600 dark:text-white'>
              Struggling to find the right words for LinkedIn? Mr.Comment uses AI to craft positive, neutral, or critical comments based on any post, helping you engage meaningfully.
            </p>
            <div className='mt-10 flex items-center justify-center gap-x-6'>
              <Link
                to={routes.CommentsRoute.to}
                className='rounded-md bg-yellow-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-yellow-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500'
              >
                Generate Comments Now <span aria-hidden='true'>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}