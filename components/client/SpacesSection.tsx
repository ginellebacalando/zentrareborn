import React from 'react';

import { AutoplayVenueVideo } from './AutoplayVenueVideo';

const spaces = [
  {
    id: 1,
    titleLine1: 'The',
    titleLine2: 'Selah Hall',
    video: '/zion-media/ILESEVENTSITALY_pindown.io_1784857577.mp4',
    poster: '/zion-media/wedding_.webp',
  },
  {
    id: 2,
    titleLine1: 'The',
    titleLine2: 'Pavilion garden',
    video: '/zion-media/HolaMinasan_pindown.io_1784857654.mp4',
    poster: '/zion-media/Gorgeous Wedding Decor.webp',
  },
  {
    id: 3,
    titleLine1: 'The pool',
    titleLine2: '',
    video: '/zion-media/genderrevealdubai_pindown.io_1784858148.mp4',
    poster: '/zion-media/Spring Garden Wedding of EJ & Jaira - Khim Cruz _ Wedding and Event Designer + Florist + Stylist.webp',
  }
];

export default function SpacesSection() {
  return (
    <section className="bg-transparent w-full px-4 pt-12 pb-10 md:pt-16 md:pb-12 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-center w-full overflow-hidden">
          <div className="group relative flex w-full min-w-0 items-center justify-center gap-3 md:gap-6 cursor-default" data-motion="decorative">
            {/* Left elegant fading line */}
            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-r from-transparent to-[#D4AF37]/80 opacity-70 transition-all duration-700 ease-out group-hover:to-[#D4AF37] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />

            <h2 className="shrink-0 text-center font-serif text-[1.05rem] uppercase tracking-[0.08em] text-neutral-900 transition-colors duration-700 ease-out group-hover:text-[#D4AF37] min-[360px]:text-xl min-[360px]:tracking-[0.1em] md:text-4xl md:tracking-[0.2em] md:group-hover:tracking-[0.24em]">
              OUR SPACES
            </h2>

            {/* Right elegant fading line */}
            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-l from-transparent to-[#D4AF37]/80 opacity-70 transition-all duration-700 ease-out group-hover:to-[#D4AF37] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {spaces.map((space) => (
            <div
              key={space.id}
              className={`relative aspect-[4/5] md:aspect-[3/4] overflow-hidden group cursor-pointer transition-all duration-500 ${
                space.id === 1 ? 'rounded-b-2xl md:rounded-bl-none md:rounded-r-2xl' :
                space.id === 2 ? 'rounded-2xl' :
                space.id === 3 ? 'rounded-t-2xl md:rounded-tr-none md:rounded-l-2xl' : ''
              }`}
            >
              <AutoplayVenueVideo
                src={space.video}
                poster={space.poster}
              />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />

              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white drop-shadow-md">
                <h3 className="font-script text-4xl md:text-5xl text-center leading-tight">
                  {space.titleLine1}
                </h3>
                {space.titleLine2 && (
                  <h3 className="font-script text-4xl md:text-5xl text-center leading-tight">
                    {space.titleLine2}
                  </h3>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
