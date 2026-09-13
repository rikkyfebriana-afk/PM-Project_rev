'use client';

import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

import type { MapProject } from './project-map';

const markerIcons = {
  green: L.divIcon({
    className: '',
    html: '<span class="project-map-marker marker-green"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  }),
  amber: L.divIcon({
    className: '',
    html: '<span class="project-map-marker marker-amber"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  }),
  red: L.divIcon({
    className: '',
    html: '<span class="project-map-marker marker-red"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  }),
};

export default function ProjectMapInner({
  projects,
  onSelect,
}: {
  projects: MapProject[];
  onSelect: (projectId: string) => void;
}) {
  return (
    <div className="relative h-[370px] overflow-hidden">
      <MapContainer
        center={[-6.65, 109.8]}
        zoom={7}
        scrollWheelZoom={false}
        className="h-full w-full"
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {projects.map((project) => (
          <Marker
            key={project.id}
            position={[project.latitude, project.longitude]}
            icon={markerIcons[project.tone]}
          >
            <Popup>
              <div className="min-w-40">
                <strong className="text-sm text-[#17364a]">
                  {project.city}
                </strong>
                <p className="mt-1 text-xs text-[#657782]">{project.project}</p>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => onSelect(project.id)}
                    className="text-xs font-semibold text-[#d85832]"
                  >
                    Lihat proyek
                  </button>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${project.latitude},${project.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[#315a70]"
                  >
                    Google Maps ↗
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-4 left-5 z-[500] flex items-center gap-4 bg-white/95 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#687680] shadow-sm ring-1 ring-[#d8e0e4]">
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-[#1c9377]" /> On track
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-[#e4a23a]" /> Attention
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-[#e35645]" /> Critical
        </span>
      </div>
    </div>
  );
}
