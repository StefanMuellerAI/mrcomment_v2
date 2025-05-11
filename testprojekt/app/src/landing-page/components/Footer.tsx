// Removed WaspRouterLink import as we'll use standard <a> tags
// import { Link as WaspRouterLink } from 'wasp/client/router'; 
import type { footerNavigation } from '../contentSections';

// Revert type inference, use simple string as standard <a> expects href
type FooterNavigationItem = {
  name: string;
  to: string; // Using 'to' from contentSections, but will map to 'href'
}

export default function Footer({ footerNavigation: propFooterNavigation }: { 
  footerNavigation: {
    app?: FooterNavigationItem[] 
    company: FooterNavigationItem[] 
  }
}) {
  return (
    <div className='mx-auto mt-6 max-w-7xl px-6 lg:px-8 dark:bg-boxdark-2'>
      <footer
        aria-labelledby='footer-heading'
        className='relative border-t border-gray-900/10 dark:border-gray-200/10 py-12 sm:py-16'
      >
        <h2 id='footer-heading' className='sr-only'>
          Footer
        </h2>
        <div className='flex justify-center sm:justify-start mt-4'>
          <div>
            <ul role='list' className='space-y-4 sm:flex sm:space-y-0 sm:space-x-6'> 
              {propFooterNavigation.company.map((item) => (
                <li key={item.name}>
                  {/* Use standard <a> tag with href mapped from item.to */}
                  <a href={item.to} className='text-sm leading-6 text-gray-600 hover:text-gray-900 dark:text-white'>
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  )
}
