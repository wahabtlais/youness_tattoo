import { Nav } from './components/Nav';
import { RegistrationMarks } from './components/RegistrationMarks';
import { HeroSwitch } from './components/dev/HeroSwitch';
import { Hero } from './sections/Hero';
import { HeroV2 } from './sections/HeroV2';
import { Work } from './sections/Work';
import { Studio } from './sections/Studio';
import { Book } from './sections/Book';
import { showHeroSwitch, useHeroVersion } from './hooks/useHeroVersion';
import './App.css';

export default function App() {
  const [hero, setHero] = useHeroVersion();

  return (
    <div className="app">
      <Nav variant={hero} />
      <RegistrationMarks />
      <main>
        {hero === 'v2' ? <HeroV2 /> : <Hero />}
        <Work />
        <Studio />
        <Book />
      </main>
      {showHeroSwitch && <HeroSwitch value={hero} onChange={setHero} />}
    </div>
  );
}
