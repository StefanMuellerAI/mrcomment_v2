// Removed imports for unused sections
// import { features, faqs, footerNavigation, testimonials } from './contentSections';
// import { footerNavigation } from './contentSections'; // Keep footer navigation for now
import Hero from './components/Hero';
// import Clients from './components/Clients';
// import Features from './components/Features';
// import Testimonials from './components/Testimonials';
// import FAQ from './components/FAQ';
// import Footer from './components/Footer';

export default function LandingPage() {
  return (
    // The outer div might be redundant now if App.tsx provides a background
    <div className='bg-white dark:text-white dark:bg-boxdark-2'>
      <main className='isolate dark:bg-boxdark-2'>
        <Hero />
        {/* Removed Clients, Features, Testimonials, FAQ sections */}
      </main>
      {/* Removed Footer component rendering */}
    </div>
  );
}
