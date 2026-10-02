'use client';

import { useEffect, useId, useState } from 'react';
import Particles from '@tsparticles/react';
import { type Container, type ISourceOptions, tsParticles } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';
import { cn } from '@/lib/utils';
import { motion, useAnimation } from 'motion/react';

type ParticlesProps = {
  id?: string;
  className?: string;
  background?: string;
  particleSize?: number;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleColor?: string;
  particleDensity?: number;
};

export const SparklesCore = (props: ParticlesProps) => {
  const {
    id,
    className,
    background,
    minSize,
    maxSize,
    particleSize,
    speed,
    particleColor,
    particleDensity,
  } = props;

  const [init, setInit] = useState(false);
  const controls = useAnimation();

  useEffect(() => {
    let mounted = true;

    void loadSlim(tsParticles).then(() => {
      if (mounted) setInit(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const particlesLoaded = async (container?: Container) => {
    if (container) {
      controls.start({
        opacity: 1,
        transition: {
          duration: 1,
        },
      });
    }
  };

  const generatedId = useId();

  const options: ISourceOptions = {
    background: {
      color: {
        value: background || '#0d47a1',
      },
    },
    fullScreen: {
      enable: false,
      zIndex: 1,
    },
    fpsLimit: 120,
    interactivity: {
      events: {
        onClick: {
          enable: true,
          mode: 'push',
        },
        onHover: {
          enable: false,
          mode: 'repulse',
        },
      },
      modes: {
        push: {
          quantity: 4,
        },
        repulse: {
          distance: 200,
          duration: 0.4,
        },
      },
    },
    particles: {
      color: {
        value: particleColor || '#ffffff',
      },
      move: {
        direction: 'none',
        enable: true,
        outModes: {
          default: 'out',
        },
        speed: speed || 1,
      },
      number: {
        density: {
          enable: true,
          width: 400,
          height: 400,
        },
        value: particleDensity || 120,
      },
      opacity: {
        value: {
          min: 0.1,
          max: 1,
        },
        animation: {
          enable: true,
          speed: speed || 4,
          sync: false,
        },
      },
      shape: {
        type: 'circle',
      },
      size: {
        value: {
          min: minSize || 1,
          max: maxSize || particleSize || 3,
        },
      },
    },
    detectRetina: true,
  };

  return (
    <motion.div animate={controls} className={cn('opacity-0', className)}>
      {init ? (
        <Particles
          id={id || generatedId}
          className="h-full w-full"
          particlesLoaded={particlesLoaded}
          options={options}
        />
      ) : null}
    </motion.div>
  );
};
