'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
import { policiesData } from '@/config/policies';

export default function PoliciesClient() {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(policiesData[0]?.sections[0]?.id || null);

  const flatPolicies = useMemo(() => {
    const all = policiesData.flatMap(category => 
      category.sections.map(section => ({
        ...section,
        categoryName: category.category
      }))
    );
    
    if (!search.trim()) return all;
    
    const lowerSearch = search.toLowerCase();
    return all.filter(
      policy =>
        policy.title.toLowerCase().includes(lowerSearch) ||
        policy.content.some(paragraph => paragraph.toLowerCase().includes(lowerSearch)) ||
        policy.categoryName.toLowerCase().includes(lowerSearch)
    );
  }, [search]);

  return (
    <div className="w-full relative z-10 bg-transparent pb-32">
      <div className="mx-auto max-w-4xl px-6 pt-20">
        
        {/* Main Section */}
        <section className="flex flex-col items-center">
          <div className="text-center mb-12" style={{ animation: 'fadeInUp 0.8s ease-out both' }}>
            <span className="bg-gradient-to-r from-[#D4AF37] to-[#ECDD77] text-white px-5 py-2 rounded-full text-xs font-bold tracking-[0.2em] uppercase shadow-md mb-6 inline-block">
              Important Guidelines
            </span>
            <h2 className="font-serif text-4xl text-[#3A4B3C] md:text-5xl mt-2">
              Event & Venue Policies
            </h2>
          </div>

          {/* Search Bar */}
          <div 
            className="mb-10 flex w-full flex-col gap-3 rounded-full border border-[#D4AF37]/30 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md p-2 md:flex-row transition-all focus-within:shadow-[0_20px_40px_rgba(212,175,55,0.15)] focus-within:border-[#D4AF37]/60"
            style={{ animation: 'fadeInUp 0.8s ease-out 0.2s both' }}
          >
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-6 top-3.5 h-5 w-5 text-[#3A4B3C]/50" />
              <input
                type="text"
                placeholder="Search policies..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-full border-none bg-transparent py-3.5 pl-14 pr-6 font-serif text-lg text-[#3A4B3C] outline-none placeholder:text-[#3A4B3C]/50"
              />
            </label>
          </div>

          {/* Policies List */}
          <div className="flex w-full flex-col gap-5">
            {flatPolicies.length === 0 ? (
              <div 
                className="rounded-[2rem] border border-[#D4AF37]/20 bg-white/70 px-8 py-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md"
                style={{ animation: 'fadeIn 0.5s ease-out both' }}
              >
                <p className="font-serif text-2xl text-[#3A4B3C] mb-2">No policies found.</p>
                <p className="font-serif text-lg text-neutral-500">
                  We couldn&apos;t find anything matching &ldquo;{search}&rdquo;.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <Link href="/contact" className="inline-flex items-center gap-2 rounded-full border-2 border-[#D4AF37] px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-white transition-colors duration-300">
                    Contact Us
                  </Link>
                </div>
              </div>
            ) : (
              flatPolicies.map((policy, index) => {
                const isOpen = openId === policy.id;
                
                return (
                  <div 
                    key={policy.id} 
                    className={`overflow-hidden rounded-[2rem] border transition-all duration-500 ${
                      isOpen 
                        ? 'border-[#D4AF37]/50 bg-white shadow-[0_20px_40px_rgba(212,175,55,0.1)]' 
                        : 'border-[#D4AF37]/20 bg-white/60 hover:border-[#D4AF37]/40 hover:bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.05)]'
                    }`}
                    style={{ animation: `fadeInUp 0.6s ease-out ${0.3 + index * 0.05}s both` }}
                  >
                    <button
                      onClick={() => setOpenId(isOpen ? null : policy.id)}
                      className="flex w-full items-center justify-between gap-4 p-6 text-left md:p-8"
                    >
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37] mb-2">{policy.categoryName}</p>
                        <h3 className={`font-serif text-xl transition-colors duration-300 md:text-2xl ${isOpen ? 'text-[#D4AF37]' : 'text-[#3A4B3C]'}`}>
                          {policy.title}
                        </h3>
                      </div>
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ${
                        isOpen ? 'border-[#D4AF37] bg-[#D4AF37] text-white shadow-lg shadow-[#D4AF37]/30 rotate-180' : 'border-[#D4AF37]/30 text-[#D4AF37] bg-white group-hover:border-[#D4AF37]'
                      }`}>
                        <ChevronDown className="h-5 w-5" />
                      </div>
                    </button>
                    
                    <div 
                      className={`grid transition-all duration-500 ease-in-out ${
                        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="border-t border-[#D4AF37]/10 p-6 pt-2 md:p-8 md:pt-4">
                          <div className="space-y-4 font-serif text-lg leading-relaxed text-[#3A4B3C]/80">
                            {policy.content.map((paragraph, pIndex) => (
                              <p key={pIndex} className={paragraph.startsWith('•') ? "pl-6 relative before:content-[''] before:absolute before:left-2 before:top-2.5 before:w-1.5 before:h-1.5 before:bg-[#D4AF37] before:rounded-full" : ""}>
                                {paragraph.replace('•', '').trim()}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}} />
    </div>
  );
}
