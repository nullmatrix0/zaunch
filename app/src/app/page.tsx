import LandingHero from '@/components/home/LandingHero';
import LandingProblems from '@/components/home/LandingProblems';
import LandingSolutions from '@/components/home/LandingSolutions';
import LandingTechStack from '@/components/home/LandingTechStack';
import LandingGettingStarted from '@/components/home/LandingGettingStarted';
import LandingFAQ from '@/components/home/LandingFAQ';

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <LandingHero />
      <LandingProblems />
      <LandingSolutions />
      <LandingTechStack />
      <LandingGettingStarted />
      <LandingFAQ />
    </main>
  );
}
