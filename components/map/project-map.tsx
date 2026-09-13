'use client';

import dynamic from 'next/dynamic';

export type MapProject = {
  id: string;
  city: string;
  project: string;
  tone: 'green' | 'amber' | 'red';
  latitude: number;
  longitude: number;
};

const ProjectMapInner = dynamic(() => import('./project-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="grid h-[370px] place-items-center bg-[#eaf0f2] text-sm font-medium text-[#71818b]">
      Memuat peta proyek...
    </div>
  ),
});

export function ProjectMap({
  projects,
  onSelect,
}: {
  projects: MapProject[];
  onSelect: (projectId: string) => void;
}) {
  return <ProjectMapInner projects={projects} onSelect={onSelect} />;
}
