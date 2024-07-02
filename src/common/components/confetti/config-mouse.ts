export const configMouse = {
  key: 'mouseParticle',
  name: 'Mouse Particle',
  fullScreen: {
    zIndex: 10000,
  },
  particles: {
    number: {
      value: 0,
    },
    color: {
      value: ['#ff0000', '#00ff00', '#0000ff'],
      animation: {
        enable: true,
        speed: 180,
        sync: true,
      },
    },
    effect: {
      type: 'trail',
      options: {
        trail: {
          length: 10,
          minWidth: 2,
        },
      },
    },
    shape: {
      type: 'circle',
    },
    size: {
      value: 3,
    },
  },
  interactivity: {
    events: {
      onHover: {
        enable: true,
        mode: 'particle',
      },
    },
    modes: {
      particle: {
        replaceCursor: false,
        pauseOnStop: false,
      },
    },
  },
};

export default configMouse;
