import React from 'react';

export const ANON_ANIMALS = [
  { name: 'Wolf', body: 'M12 4.2 17.5 7.8 20 5.8 18.7 13.2 21 16.5 16.7 16.2 14.2 19.8 12 17 9.8 19.8 7.3 16.2 3 16.5 5.3 13.2 4 5.8 6.5 7.8z' },
  { name: 'Fox', body: 'M12 5 16.8 7.3 20 4.8 18.5 13.7 20.2 17.8 15.2 16.4 12 19.2 8.8 16.4 3.8 17.8 5.5 13.7 4 4.8 7.2 7.3z' },
  { name: 'Lynx', body: 'M6.2 5.2 10.4 8.5 12 6.9 13.6 8.5 17.8 5.2 17 12.7 19.2 15.4 15 16.5 12 19.3 9 16.5 4.8 15.4 7 12.7z' },
  { name: 'Hare', body: 'M8.6 12.3 C6.5 7.8 6.5 3.9 8.2 3.4 C10 5.6 10.5 8.6 10.5 11.1 C11.1 11 11.7 11 12.3 11.1 C12.3 8.5 13 5.1 15.1 3.1 C16.7 3.9 16.4 8.2 14.6 12.3 C17.1 13.2 18.8 15.3 18.8 17.8 C16.8 19 14.5 19.6 12 19.6 C9.5 19.6 7.2 19 5.2 17.8 C5.2 15.3 6.9 13.2 8.6 12.3z' },
  { name: 'Bull', body: 'M4.3 7.1 C6.8 7.1 7.9 8.7 8.9 10.1 C9.8 9.6 10.8 9.4 12 9.4 C13.2 9.4 14.2 9.6 15.1 10.1 C16.1 8.7 17.2 7.1 19.7 7.1 C18.8 9.8 17.7 11.7 16.6 13 C17 14.1 17.1 15.2 17 16.5 C15.6 18 13.8 18.8 12 18.8 C10.2 18.8 8.4 18 7 16.5 C6.9 15.2 7 14.1 7.4 13 C6.3 11.7 5.2 9.8 4.3 7.1z' },
  { name: 'Manta', body: 'M2.8 12.5 C6.6 7.8 9.3 6.1 12 6.1 C14.7 6.1 17.4 7.8 21.2 12.5 C17.7 13.2 15.4 14.6 13.3 17.4 L12 20 L10.7 17.4 C8.6 14.6 6.3 13.2 2.8 12.5z' },
];

const NAME_WORDS = {
  a: ['Agile', 'Amber', 'Astral'], b: ['Bold', 'Bright', 'Brisk'], c: ['Cosmic', 'Clever', 'Crimson'],
  d: ['Daring', 'Dusky', 'Drift'], e: ['Electric', 'Emerald', 'Echo'], f: ['Feral', 'Frost', 'Fleet'],
  g: ['Golden', 'Ghost', 'Glowing'], h: ['Hidden', 'Hollow', 'Hyper'], i: ['Ivory', 'Ion', 'Iron'],
  j: ['Jade', 'Jolly', 'Jet'], k: ['Keen', 'Kinetic', 'Kindled'], l: ['Lucky', 'Lunar', 'Lucid'],
  m: ['Mystic', 'Magnetic', 'Molten'], n: ['Neon', 'Noble', 'Nomad'], o: ['Obsidian', 'Oracle', 'Orbit'],
  p: ['Prime', 'Phantom', 'Polar'], q: ['Quick', 'Quiet', 'Quantum'], r: ['Radiant', 'Rogue', 'Rapid'],
  s: ['Solar', 'Sharp', 'Silver'], t: ['Turbo', 'Twilight', 'True'], u: ['Ultra', 'Umber', 'Unbound'],
  v: ['Vivid', 'Velvet', 'Vector'], w: ['Wild', 'White', 'Wired'], x: ['Xeno', 'Xray', 'Xtra'],
  y: ['Young', 'Yellow', 'Yonder'], z: ['Zealous', 'Zenith', 'Zesty'],
};

const NAME_CREATURES = {
  a: ['Albatross', 'Antelope', 'Axolotl'], b: ['Badger', 'Bobcat', 'Bison'], c: ['Cougar', 'Cobra', 'Crane'],
  d: ['Dolphin', 'Dragonfly', 'Deer'], e: ['Eagle', 'Egret', 'Elk'], f: ['Falcon', 'Fox', 'Finch'],
  g: ['Gecko', 'Gazelle', 'Gull'], h: ['Heron', 'Hawk', 'Hare'], i: ['Ibis', 'Impala', 'Ibex'],
  j: ['Jaguar', 'Jay', 'Jackal'], k: ['Kestrel', 'Koala', 'Koi'], l: ['Lynx', 'Lion', 'Lark'],
  m: ['Manta', 'Marten', 'Magpie'], n: ['Nightingale', 'Narwhal', 'Newt'], o: ['Ocelot', 'Otter', 'Orca'],
  p: ['Panther', 'Puffin', 'Python'], q: ['Quail', 'Quokka', 'Quetzal'], r: ['Raven', 'Ray', 'Robin'],
  s: ['Swan', 'Stingray', 'Sparrow'], t: ['Tiger', 'Toucan', 'Tern'], u: ['Urchin', 'Umbrellabird', 'Uakari'],
  v: ['Viper', 'Vicuna', 'Vole'], w: ['Wolf', 'Whale', 'Wren'], x: ['Xerus', 'Xenops', 'Xolo'],
  y: ['Yak', 'Yabby', 'Yellowtail'], z: ['Zebra', 'Zebu', 'Zorilla'],
};

export const hashAddress = (addr = '') => {
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = addr.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
};

export const gradientForWallet = (addr = '') => {
  const h1 = hashAddress(addr) % 360;
  const h2 = (h1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 65%, 55%) 0%, hsl(${h2}, 65%, 45%) 100%)`;
};

export const getAnonAnimal = (addr = '') => ANON_ANIMALS[hashAddress(addr) % ANON_ANIMALS.length];

const wordForLetter = (dict, letter, hash) => {
  const words = dict[letter.toLowerCase()] || dict.a;
  return words[hash % words.length];
};

export const buildWalletName = (addr = '') => {
  const suffix = (addr.match(/[a-z0-9]+$/i)?.[0] || addr).slice(-6);
  const letters = suffix.match(/[a-z]/gi) || [];
  const digits = suffix.match(/\d/g) || [];
  const fallbackLetters = (addr.match(/[a-z]/gi) || ['a', 'n']).slice(-2);
  const [adjInitial, nounInitial] = (letters.length >= 2 ? letters.slice(-2) : fallbackLetters).map((c) => c.toLowerCase());
  const hash = hashAddress(addr);
  const numberTag = digits.length ? ` ${digits.slice(-2).join('')}` : '';
  return `${wordForLetter(NAME_WORDS, adjInitial, hash)} ${wordForLetter(NAME_CREATURES, nounInitial, Math.floor(hash / 7))}${numberTag}`;
};

export const shortWalletAddress = (address) => (address ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'Unknown');

export const AnimalSilhouetteAvatar = ({ address, className = 'wallet-animal-avatar' }) => {
  const animal = getAnonAnimal(address);
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={animal.body} />
    </svg>
  );
};