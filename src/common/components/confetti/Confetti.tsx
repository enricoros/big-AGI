'use client';

import { useEffect, useMemo, useState } from 'react';
// import { type Container, type ISourceOptions, MoveDirection, OutMode } from '@tsparticles/engine';
import Particles, { initParticlesEngine } from '@tsparticles/react';
// import { loadAll } from "@tsparticles/all"; // if you are going to use `loadAll`, install the "@tsparticles/all" package too.
import { loadFull } from 'tsparticles'; // if you are going to use `loadFull`, install the "tsparticles" package too.
import { useIsClient } from '../../hooks/is-client';
import { useConfettiSettings } from './confetti-settings';
import { ConfettiToolbar } from './ConfettiToolbar';

export function Confetti() {
  const [init, setInit] = useState(false);
  const isClient = useIsClient();
  console.log(`is client: ${isClient}`);
  const [activeSetting, commands] = useConfettiSettings();

  // this should be run only once per application lifetime
  useEffect(() => {
    if (!isClient) {
      console.warn(`Invalid call of useParticlesEngine on the server`);
      return;
    }
    console.log(`Init particle engine`);
    initParticlesEngine(async (engine) => {
      // you can initiate the tsParticles instance (engine) here, adding custom shapes or presets
      // this loads the tsparticles package bundle, it's the easiest method for getting everything ready
      // starting from v2 you can add only the features you need reducing the bundle size
      //await loadAll(engine);
      console.log(`Awaiting Load Full`);
      await loadFull(engine);
      console.log(`LOADED Load Full`);
      //   await loadSlim(engine);
      //await loadBasic(engine);
    })
      .then(() => {
        setInit(true);
      })
      .catch((err) => {
        console.error(err);
      });
  }, [isClient]);

  const particlesLoaded = async (container: unknown) => {
    console.log(container);
  };

  const options = useMemo(() => activeSetting, [activeSetting]);

  if (isClient && init) {
    return (
      <>
        <ConfettiToolbar />
        <Particles id="tsparticles" particlesLoaded={particlesLoaded} options={options} />
      </>
    );
  }

  return <></>;
}
