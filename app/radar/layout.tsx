import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subsurface Radar — Schema',
  description: 'A simulated ground-penetrating radar and tilt-sensor demonstration with AI inversion, for screening before construction. Not a certified geotechnical or disaster-warning system.',
};

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
