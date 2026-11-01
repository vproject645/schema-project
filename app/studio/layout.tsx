import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Studio — Schema',
  description: 'Turn an idea into a 3D model, age it under real climate conditions, and prepare the codes and permits before you break ground.',
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
