import * as React from 'react';


interface DrawIdea {
  author: string,
  prompt: string,
  short: string,
  score: number,
}

/**
 * The following are drawing ideas, offered to people.
 * Generated with: https://github.com/enricoros/big-AGI/issues/311#issuecomment-1909473441
 */
const allIdeas: DrawIdea[] = [
  { author: 'Beatriz', prompt: 'An intricate book nook with miniature worlds nestled between classic tomes, casting a magical glow over a cozy reading corner.', short: 'Magical book nook miniature', score: 46 },
  { author: 'Charlie', prompt: 'A powerful black-and-white portrait of diverse hands united, each marked with a word of hope, capturing the essence of solidarity.', short: 'United hands with words of hope', score: 45 },
  { author: 'Disha', prompt: 'A serene garden oasis with a violin resting against an ancient tree, as if the music itself could make flowers bloom.', short: 'Garden oasis with violin', score: 43 },
  { author: 'Fatima', prompt: 'A night sky canvas with constellations drawn by the city lights below, a blend of urban design and celestial wonder.', short: 'Night sky and city light constellations', score: 46 },
  { author: 'Hana', prompt: 'A vibrant mural of the Earth, with real plants growing out of the painting, blurring the lines between art and environmental activism.', short: 'Earth mural with real plants', score: 47 },
  { author: 'Julia', prompt: 'A child\'s hand gently holding a bird, with the shadow cast forming a heart, capturing a moment of pure connection with nature.', short: 'Heart shadow with bird in hand', score: 49 },
  { author: 'Julia', prompt: 'A whimsical photo of a deck of cards mid-shuffle, with birds seemingly flying out of the fanned cards into a sunset sky.', short: 'Cards with birds in sunset', score: 48 },
  { author: 'Lina', prompt: 'A stop-motion of a pottery wheel spinning, each frame capturing a different historical era\'s pottery style coming to life.', short: 'Pottery wheel through historical eras', score: 45 },
  { author: 'Mason', prompt: 'A heartwarming snapshot of a loyal golden retriever patiently waiting at a train station, its reflection mirroring in the glossy floor, encapsulating the themes of loyalty and anticipation.', short: 'Loyal dog awaiting its owner', score: 47 },
  { author: 'Nia', prompt: 'A fairytale book with plants growing from the pages, creating a living story that captures the imagination of both young and old.', short: 'Fairytale book with living plants', score: 50 },
  { author: 'Omar', prompt: 'A building being \'drawn\' in the sky by a crane, as if architecture is being sketched in real-time.', short: 'Building \'drawn\' in the sky', score: 43 },
  { author: 'Priya', prompt: 'A photo capturing the fluid motion of a traditional dance, with colorful fabric swirling around the dancer like a living painting.', short: 'Traditional dance with colorful fabric', score: 43 },
  { author: 'Quin', prompt: 'A breathtaking summit view with a single flag planted, the colors of which morph into a vibrant time-lapse of the sky changing.', short: 'Summit view with time-lapse sky', score: 45 },
  { author: 'Quin', prompt: 'A cliffside yoga pose with the sun setting into the ocean below, embodying the perfect balance between adventure and tranquility.', short: 'Cliffside yoga at sunset', score: 48 },
  { author: 'Rosa', prompt: 'An experiment in color: vibrant chemical reactions captured in crystal-clear glassware, showcasing the beauty of science.', short: 'Colorful science reactions', score: 48 },
  { author: 'Samir', prompt: 'A stunning photo of ancient script carved into a mountain, juxtaposed with the modern skyline in the distance.', short: 'Ancient script and modern skyline', score: 48 },
  { author: 'Sofia', prompt: 'A whimsical and vibrant image of a capybara sculpted entirely from pink cotton candy, set against a minimalist backdrop with splashes of bright, contrasting colors.', short: 'Cotton candy capybara in color splashes', score: 49 },
  { author: 'Tanya', prompt: 'A mural blending street art with digital pixels, where the physical wall seems to dissolve into a virtual game world.', short: 'Street art to digital game world mural', score: 45 },
  { author: 'Tanya', prompt: 'A paintbrush touching a canvas, where each stroke animates into a scene from an indie game, illustrating the art behind the code.', short: 'Animated indie game art', score: 50 },
].sort(() => Math.random() - 0.5); // shuffle the ideas, once

function _randomDrawIdea() {
  return allIdeas[Math.floor(Math.random() * allIdeas.length)];
}


export function useDrawIdeas() {
  // state
  const [currentIdea, setCurrentIdea] = React.useState<DrawIdea>(_randomDrawIdea());

  const nextRandomIdea = React.useCallback(() => {
    setCurrentIdea(prevIdea => {
      let nextIdea = _randomDrawIdea();
      while (nextIdea === prevIdea)
        nextIdea = _randomDrawIdea();
      return nextIdea;
    });
  }, []);

  return { allIdeas, currentIdea, nextRandomIdea };
}